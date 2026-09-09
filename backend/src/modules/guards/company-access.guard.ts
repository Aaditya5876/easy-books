import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { isCompanyAccessible } from '../../../core/modules/company-access';
import { NotificationServiceImpl } from '../../application/services/notification.service.impl';

// Global, runs on every staff-authenticated request. Neither RolesGuard (only
// checks the user's global role string) nor ModuleAccessGuard (only checks
// plan entitlements) ever verify that the caller actually belongs to the
// companyId they're asking for — every controller just trusts whatever
// companyId the client sends in the query/body/params. That meant any
// authenticated staff user at Company A could read or write Company B's
// data by swapping the companyId parameter. This guard closes that hole at
// a single point instead of patching every controller individually.
//
// SUPER_ADMIN bypasses (matches RolesGuard's existing convention — it's the
// platform-operator role, legitimately cross-company).
@Injectable()
export class CompanyAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationServiceImpl,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true; // portal routes etc. — scoped by PortalGuard's own token claims instead

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return true; // no staff session on this request — nothing for this guard to check

    // Check EVERY companyId the request carries, not just whichever one is
    // found first. A handler might read companyId from the body while this
    // guard only validated the query string (or vice versa) — picking one
    // source let a caller satisfy this guard with their own company while
    // the actual operation, reading a different source, targeted a victim
    // company. (E.g. POST /vendors?companyId=<own> with body
    // {"companyId":"<victim>"} — the create only ever reads the body value.)
    const companyIds = [...new Set(
      [req.query?.companyId, req.params?.companyId, req.body?.companyId]
        .filter((v): v is string => typeof v === 'string' && v.length > 0),
    )];
    if (companyIds.length === 0) return true; // route doesn't touch a specific company — nothing to verify

    if (user.role === 'SUPER_ADMIN') return true;

    for (const companyId of companyIds) {
      const [membership, company] = await Promise.all([
        this.prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { id: true } }),
        this.prisma.company.findUnique({ where: { id: companyId }, select: { isActive: true, subscriptionExpiresAt: true } }),
      ]);
      if (!membership) {
        throw new ForbiddenException('You do not have access to this company');
      }
      // isActive/subscriptionExpiresAt are a real access gate here (unlike the
      // nightly-automation-only read isActive gets elsewhere) — a deactivated
      // or expired company is fully locked out of every companyId-scoped route
      // this guard covers, checked live so expiry takes effect to the second
      // rather than waiting for a nightly job. The company-by-:id routes
      // (company.controller.ts) never pass a "companyId"-named param, so
      // they're untouched by this — an ADMIN can still view/reactivate their
      // own deactivated company from Settings.
      if (company && !isCompanyAccessible(company)) {
        // Fire-and-forget, not awaited — the block itself must not wait on
        // it. Manual deactivation already notifies synchronously from
        // CompanyServiceImpl.setActive(), which also sets
        // accessBlockedNotifiedAt up front — so this only actually fires the
        // first time a subscription lapses passively (nothing else triggers
        // that moment), and never twice for the same lapse.
        this.notifyAccessSuspendedOnce(companyId).catch(() => {});
        const message = !company.isActive
          ? 'This company has been deactivated. Contact GeoInfosys to reactivate it.'
          : 'This company\'s subscription has expired. Contact GeoInfosys to renew it.';
        throw new ForbiddenException(message);
      }
    }
    return true;
  }

  // Atomic claim-and-notify: the conditional updateMany only matches (and
  // returns count 1) for whichever concurrent request gets there first, so
  // even a burst of simultaneous blocked requests only ever sends one
  // ACCESS_SUSPENDED notification per lapse.
  private async notifyAccessSuspendedOnce(companyId: string): Promise<void> {
    const claimed = await this.prisma.company.updateMany({
      where: { id: companyId, accessBlockedNotifiedAt: null },
      data: { accessBlockedNotifiedAt: new Date() },
    });
    if (claimed.count === 0) return;
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
    // Every non-SUPER_ADMIN role at the company is equally locked out by
    // this guard (only SUPER_ADMIN bypasses it above) — everyone actually
    // affected hears about it, not just the ADMIN. No `link` here on
    // purpose — TEACHER has no /settings route at all (App.jsx's
    // schoolRoutes only gives them an explicit allowlist), so it would 404
    // them, and there's nothing role-specific to send anyone to anyway.
    await this.notifications.notifyRole(companyId, ['ADMIN', 'ACCOUNTANT', 'STAFF', 'TEACHER'], {
      type: 'ACCESS_SUSPENDED',
      title: 'Temporarily paused',
      message: `${company?.name ?? 'Your company'}'s subscription has expired. Your data is safe and untouched — we'll be back up and running again as soon as this is renewed. Contact GeoInfosys to renew.`,
    });
  }
}
