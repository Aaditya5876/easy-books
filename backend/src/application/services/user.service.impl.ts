import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { MailService } from './mail.service';
import { MODULE_KEYS, ModuleKey } from '../../../core/modules/module-keys';
import { STAFF_TAGS } from '../../../core/modules/staff-tags';
import * as bcrypt from 'bcrypt';

const ROLE_HIERARCHY = ['STAFF', 'TEACHER', 'ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN'];
// Roles an ADMIN may grant (everything below ADMIN)
const ADMIN_GRANTABLE = ['STAFF', 'TEACHER', 'ACCOUNTANT'];

// staffTags is only meaningful for role === 'STAFF' — validated against the
// whitelist and silently cleared for every other role so a demote-then-
// promote cycle never leaves stale tags (e.g. an ex-librarian who becomes
// ACCOUNTANT then STAFF again shouldn't quietly regain LIBRARY access).
function resolveStaffTags(role: string, staffTags: unknown): string[] {
  if (role !== 'STAFF') return [];
  const tags = Array.isArray(staffTags) ? staffTags : [];
  const invalid = tags.filter((tg) => !STAFF_TAGS.includes(tg as any));
  if (invalid.length > 0) throw new BadRequestException(`Unknown staff tag(s): ${invalid.join(', ')}`);
  return [...new Set(tags)];
}

@Injectable()
export class UserServiceImpl {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async inviteUser(
    companyId: string,
    data: { email: string; name: string; role: string; staffTags?: string[] },
    invitedByRole: string,
  ) {
    if (!ROLE_HIERARCHY.includes(data.role)) {
      throw new BadRequestException(`Invalid role: ${data.role}`);
    }

    if (invitedByRole === 'ADMIN' && !ADMIN_GRANTABLE.includes(data.role)) {
      throw new ForbiddenException('ADMIN can only invite STAFF, TEACHER or ACCOUNTANT');
    }

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    if (data.role === 'TEACHER' && company.businessType !== 'SCHOOL') {
      throw new BadRequestException('TEACHER role is only valid for school companies');
    }

    const staffTags = resolveStaffTags(data.role, data.staffTags);

    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });

    if (existing) {
      const link = await this.prisma.userCompany.findUnique({
        where: { userId_companyId: { userId: existing.id, companyId } },
      });
      if (link) throw new BadRequestException('User already belongs to this company');

      await this.prisma.userCompany.create({
        data: { userId: existing.id, companyId, isDefault: false },
      });

      // Deliberately not setting role here: `role` lives globally on User,
      // not per-company, so overwriting it to match this invite would also
      // silently change what this person can do at every OTHER company they
      // already belong to. If they need a different role at this company
      // specifically, that requires the role to become per-UserCompany —
      // out of scope for a link-existing-user action.
      return { message: 'Existing user linked to company', userId: existing.id };
    }

    const tempPassword = Math.random().toString(36).slice(-10);
    const hashed = await bcrypt.hash(tempPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashed,
        role: data.role as any,
        staffTags,
        emailVerified: true,
        mustChangePassword: true,
        userCompanies: {
          create: { companyId, isDefault: true },
        },
      },
      select: { id: true, email: true, name: true, role: true, staffTags: true },
    });

    await this.mailService.sendInvitation(data.email, data.name, company.name, tempPassword);

    return { message: 'User invited', userId: user.id, user };
  }

  // SUPER_ADMIN only (enforced by @Roles('SUPER_ADMIN') on the controller) —
  // creates a brand-new client company plus its first ADMIN login in one
  // step, for the sales-led onboarding flow (client pays off-platform, we
  // set them up and hand over credentials) rather than self-registration.
  // The requesting SUPER_ADMIN is also linked to the new company (non-default)
  // so they can switch into it afterward to manage its package/support it.
  async provisionClient(
    requesterId: string,
    data: { companyName: string; businessType: string; adminName: string; adminEmail: string; enabledModules?: string[] },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.adminEmail } });
    if (existing) throw new ConflictException('A user with this email already exists');

    const enabledModules = data.enabledModules ?? [];
    const invalid = enabledModules.filter((m) => !MODULE_KEYS.includes(m as ModuleKey));
    if (invalid.length > 0) throw new BadRequestException(`Unknown module key(s): ${invalid.join(', ')}`);

    const company = await this.prisma.company.create({
      data: { name: data.companyName, businessType: data.businessType, enabledModules },
    });

    const tempPassword = Math.random().toString(36).slice(-10);
    const hashed = await bcrypt.hash(tempPassword, 10);

    const admin = await this.prisma.user.create({
      data: {
        email: data.adminEmail,
        name: data.adminName,
        password: hashed,
        role: 'ADMIN',
        emailVerified: true,
        mustChangePassword: true,
        userCompanies: { create: { companyId: company.id, isDefault: true } },
      },
      select: { id: true, email: true, name: true },
    });

    const requesterLink = await this.prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: requesterId, companyId: company.id } },
    });
    if (!requesterLink) {
      await this.prisma.userCompany.create({ data: { userId: requesterId, companyId: company.id, isDefault: false } });
    }

    const emailSent = await this.mailService.sendInvitation(data.adminEmail, data.adminName, company.name, tempPassword);

    // tempPassword is still returned even when emailSent is true — the
    // frontend only displays it as a fallback if delivery failed, but the
    // caller (SUPER_ADMIN) has no other way to retrieve it after this response.
    return { company, admin, tempPassword, emailSent };
  }

  async changeRole(
    targetUserId: string,
    companyId: string,
    newRole: string,
    changedByRole: string,
    newStaffTags?: string[],
  ) {
    if (!ROLE_HIERARCHY.includes(newRole)) {
      throw new BadRequestException(`Invalid role: ${newRole}`);
    }

    if (changedByRole === 'ADMIN' && !ADMIN_GRANTABLE.includes(newRole)) {
      throw new ForbiddenException('ADMIN can only assign STAFF, TEACHER or ACCOUNTANT roles');
    }

    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot change the role of a SUPER_ADMIN');
    }

    const link = await this.prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: targetUserId, companyId } },
    });
    if (!link) throw new NotFoundException('User does not belong to this company');

    if (newRole === 'TEACHER') {
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (company?.businessType !== 'SCHOOL') {
        throw new BadRequestException('TEACHER role is only valid for school companies');
      }
    }

    const staffTags = resolveStaffTags(newRole, newStaffTags);

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole as any, staffTags },
      select: { id: true, email: true, name: true, role: true, staffTags: true },
    });

    return updated;
  }

  async removeUser(targetUserId: string, companyId: string, removedByRole: string, requesterId: string) {
    if (targetUserId === requesterId) {
      throw new BadRequestException('You cannot remove yourself from the company');
    }

    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot remove a SUPER_ADMIN');
    }

    if (removedByRole === 'ADMIN' && !ADMIN_GRANTABLE.includes(user.role)) {
      throw new ForbiddenException('ADMIN can only remove STAFF, TEACHER or ACCOUNTANT users');
    }

    const link = await this.prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: targetUserId, companyId } },
    });
    if (!link) throw new NotFoundException('User does not belong to this company');

    await this.prisma.userCompany.delete({ where: { id: link.id } });

    return { message: 'User removed from company' };
  }

  // ADMIN (within their company) or SUPER_ADMIN — generates a fresh temp
  // password, forces a change on next login, and kills any existing session
  // (nulling refreshToken) so a lost/compromised password can't still be used
  // to refresh. Mirrors inviteUser's temp-password/email-with-fallback pattern.
  async resetPassword(targetUserId: string, companyId: string, requesterRole: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot reset the password of a SUPER_ADMIN');
    }
    if (requesterRole === 'ADMIN' && !ADMIN_GRANTABLE.includes(user.role)) {
      throw new ForbiddenException('ADMIN can only reset passwords for STAFF, TEACHER or ACCOUNTANT users');
    }

    const link = await this.prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: targetUserId, companyId } },
    });
    if (!link) throw new NotFoundException('User does not belong to this company');

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });

    const tempPassword = Math.random().toString(36).slice(-10);
    const hashed = await bcrypt.hash(tempPassword, 10);
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { password: hashed, mustChangePassword: true, refreshToken: null },
    });

    const emailSent = await this.mailService.sendPasswordReset(user.email, user.name, company?.name ?? '', tempPassword);
    // tempPassword returned regardless, same fallback rationale as provisionClient.
    return { message: 'Password reset', tempPassword, emailSent };
  }

  // ADMIN (within their company) or SUPER_ADMIN — suspends/restores a single
  // login without touching the company (see Company.isActive for the
  // whole-company equivalent). Suspending also kills the existing session.
  async setUserActive(targetUserId: string, companyId: string, isActive: boolean, changedByRole: string, requesterId: string) {
    if (targetUserId === requesterId) {
      throw new BadRequestException('You cannot suspend yourself');
    }
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot suspend a SUPER_ADMIN');
    }
    if (changedByRole === 'ADMIN' && !ADMIN_GRANTABLE.includes(user.role)) {
      throw new ForbiddenException('ADMIN can only suspend STAFF, TEACHER or ACCOUNTANT users');
    }

    const link = await this.prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: targetUserId, companyId } },
    });
    if (!link) throw new NotFoundException('User does not belong to this company');

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive, ...(isActive ? {} : { refreshToken: null }) },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
  }

  async listCompanyUsers(companyId: string) {
    const links = await this.prisma.userCompany.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true, email: true, name: true, role: true, staffTags: true,
            createdAt: true, maxCompanies: true, isActive: true, lastLoginAt: true,
          },
        },
      },
    });
    return links.map((l) => ({ ...l.user, isDefault: l.isDefault }));
  }

  // SUPER_ADMIN-only (enforced by @Roles('SUPER_ADMIN') on the controller
  // route) — raises how many companies this user may self-serve create via
  // the Settings "Add Company" flow, e.g. after they buy a second school.
  async updateMaxCompanies(userId: string, maxCompanies: number) {
    if (!Number.isInteger(maxCompanies) || maxCompanies < 1) {
      throw new BadRequestException('maxCompanies must be a positive integer');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id: userId }, data: { maxCompanies } });
  }
}
