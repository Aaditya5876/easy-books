import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() — any authenticated user may proceed
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    // If user not set yet (shouldn't happen when both guards are global), allow through
    if (!user) return true;

    // SUPER_ADMIN bypasses all role restrictions
    if (user.role === 'SUPER_ADMIN') return true;

    if (!required.includes(user.role)) {
      throw new ForbiddenException(`Role '${user.role}' cannot access this resource`);
    }

    return true;
  }
}
