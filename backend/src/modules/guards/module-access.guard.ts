import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
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
    // Check EVERY companyId the request carries (see CompanyAccessGuard for
    // why picking just one source is unsafe) — a handler might enforce the
    // module against a different companyId than whichever one this check
    // used to validate, letting a caller with an entitled company satisfy
    // this guard while the actual operation targeted an unentitled one.
    const companyIds = [...new Set(
      [req.query?.companyId, req.params?.companyId, req.body?.companyId]
        .filter((v): v is string => typeof v === 'string' && v.length > 0),
    )];
    // Fail closed — an omitted companyId must never silently skip a licensing
    // check (it previously did, letting any request without the field bypass
    // module entitlements entirely).
    if (companyIds.length === 0) throw new BadRequestException('companyId is required');

    for (const companyId of companyIds) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { enabledModules: true },
      });
      if (!company || company.enabledModules.length === 0) continue;

      if (!company.enabledModules.includes(required)) {
        throw new ForbiddenException(`Your plan does not include the ${required} module`);
      }
    }
    return true;
  }
}
