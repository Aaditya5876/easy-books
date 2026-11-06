import { HttpException, HttpStatus } from '@nestjs/common';

// Per-account lockout on top of the per-IP throttle: guessing spread across
// many IPs still stops after a few wrong passwords. Shared by staff (User)
// and parent/student (PortalUser) logins — both carry failedLoginCount and
// lockedUntil.
export const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

type Delegate = { update: (args: any) => Promise<any> };

export function isLocked(account: { lockedUntil: Date | null } | null | undefined) {
  return !!account?.lockedUntil && account.lockedUntil.getTime() > Date.now();
}

// Checked before the password is compared, so a locked account answers the
// same for right and wrong guesses.
export function assertNotLocked(account: { lockedUntil: Date | null } | null | undefined) {
  if (!isLocked(account)) return;
  const minutes = Math.ceil((account!.lockedUntil!.getTime() - Date.now()) / 60000);
  throw new HttpException(
    `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

export async function recordFailedLogin(delegate: Delegate, where: object) {
  const { failedLoginCount } = await delegate.update({
    where, data: { failedLoginCount: { increment: 1 } }, select: { failedLoginCount: true },
  });
  if (failedLoginCount >= MAX_FAILED_LOGINS) {
    await delegate.update({ where, data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MS) } });
  }
}

export const clearedLockout = { failedLoginCount: 0, lockedUntil: null };
