import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { maxUsersFor, productLineFor, addMonths, TRIAL_MONTHS, TRIAL_TIER } from '@easy-books/shared';

type Db = Prisma.TransactionClient | { userCompany: Prisma.TransactionClient['userCompany']; company: Prisma.TransactionClient['company'] };

// Logins that count towards a plan's user limit: active members of the
// company. GeoInfosys's own SUPER_ADMIN accounts are linked to every client
// they set up and never count.
export function countActiveLogins(db: Db, companyId: string, excludeUserId?: string) {
  return db.userCompany.count({
    where: {
      companyId,
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      user: { isActive: true, role: { not: 'SUPER_ADMIN' } },
    },
  });
}

// Before a login is added to a company or switched back on. Basic = the admin
// alone; Standard, Premium, the free trial and companies set up before plans
// existed have no limit.
export async function assertCanAddLogin(db: Db, companyId: string, excludeUserId?: string) {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { planTier: true } });
  const max = maxUsersFor(company?.planTier);
  if (max == null) return;
  if ((await countActiveLogins(db, companyId, excludeUserId)) >= max) {
    throw new ForbiddenException(
      'Your Basic plan includes only the admin login. Upgrade to Standard or Premium to add more users — contact GeoInfosys.',
    );
  }
}

// What a newly set-up company starts with: a month of Premium, free.
export function trialPlanFields(businessType: string | null | undefined, now = new Date()) {
  const ends = addMonths(now, TRIAL_MONTHS);
  return {
    productLine: productLineFor(businessType),
    planTier: TRIAL_TIER,
    planStatus: 'TRIAL',
    subscriptionStartedAt: now,
    trialEndsAt: ends,
    subscriptionExpiresAt: ends,
  };
}
