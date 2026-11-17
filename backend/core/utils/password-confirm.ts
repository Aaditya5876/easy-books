import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../db/psql/prisma.client';
import { assertNotLocked, clearedLockout, recordFailedLogin } from './login-lockout';

// "Enter your password to continue" checks (inventory edits, recycle bin…).
// Same lockout as login: 5 wrong tries lock the account for 15 minutes, so the
// prompt can't be used to guess a password. 403 (not 401) for a wrong
// password — a 401 would make the browser think the session expired.
export async function confirmPassword(prisma: PrismaService, userId: string, password: unknown) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new BadRequestException('Please enter your password');
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, password: true, lockedUntil: true } });
  if (!user) throw new ForbiddenException('Incorrect password');
  assertNotLocked(user);
  if (!(await bcrypt.compare(password, user.password))) {
    await recordFailedLogin(prisma.user, { id: user.id });
    throw new ForbiddenException('Incorrect password');
  }
  await prisma.user.update({ where: { id: user.id }, data: clearedLockout });
}
