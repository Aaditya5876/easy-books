import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_MODULE_KEY } from '../decorators/requires-module.decorator';
import { ModuleKey } from '../../../core/modules/module-keys';
import { PrismaService } from '../../../core/db/psql/prisma.client';

// Enforces per-company module licensing for routes tagged with @RequiresModule().
// Routes without the decorator are unaffected. A company with an empty
// enabledModules list is treated as unrestricted (legacy/full-access) — this
// only bites once a company has actually been scoped to a specific plan.
@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<ModuleKey>(REQUIRES_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest();
    const companyId: string | undefined =
      req.query?.companyId || req.params?.companyId || req.body?.companyId;
    if (!companyId) return true; // let normal validation reject the missing companyId

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { enabledModules: true },
    });
    if (!company || company.enabledModules.length === 0) return true;

    if (!company.enabledModules.includes(required)) {
      throw new ForbiddenException(`Your plan does not include the ${required} module`);
    }
    return true;
  }
}
