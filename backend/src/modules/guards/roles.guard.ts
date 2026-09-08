import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { STAFF_TAG_KEY } from '../decorators/requires-staff-tag.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredTag = this.reflector.getAllAndOverride<string>(STAFF_TAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() and no @RequiresStaffTag() — any authenticated user may proceed
    if ((!required || required.length === 0) && !requiredTag) return true;

    const { user } = context.switchToHttp().getRequest();
    // If user not set yet (shouldn't happen when both guards are global), allow through
    if (!user) return true;

    // SUPER_ADMIN bypasses all role and tag restrictions
    if (user.role === 'SUPER_ADMIN') return true;

    if (required && required.length > 0 && !required.includes(user.role)) {
      throw new ForbiddenException(`Role '${user.role}' cannot access this resource`);
    }

    // @RequiresStaffTag() narrows access further within the STAFF role only —
    // ADMIN/ACCOUNTANT/TEACHER already cleared the @Roles() check above and
    // are never tag-gated. Tags exist to split the shared STAFF bucket into
    // assignable duties (e.g. librarian, hostel warden, HR officer) instead
    // of every STAFF login getting every facility module by default.
    if (requiredTag && user.role === 'STAFF') {
      const tags: string[] = user.tags || [];
      if (!tags.includes(requiredTag)) {
        throw new ForbiddenException(`Missing '${requiredTag}' assignment for this module`);
      }
    }

    return true;
  }
}
