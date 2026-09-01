import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { MailService } from './mail.service';
import { MODULE_KEYS, ModuleKey } from '../../../core/modules/module-keys';
import * as bcrypt from 'bcrypt';

const ROLE_HIERARCHY = ['STAFF', 'TEACHER', 'LIBRARIAN', 'ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN'];
// Roles an ADMIN may grant (everything below ADMIN)
const ADMIN_GRANTABLE = ['STAFF', 'TEACHER', 'LIBRARIAN', 'ACCOUNTANT'];

@Injectable()
export class UserServiceImpl {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async inviteUser(companyId: string, data: { email: string; name: string; role: string }, invitedByRole: string) {
    if (!ROLE_HIERARCHY.includes(data.role)) {
      throw new BadRequestException(`Invalid role: ${data.role}`);
    }

    if (invitedByRole === 'ADMIN' && !ADMIN_GRANTABLE.includes(data.role)) {
      throw new ForbiddenException('ADMIN can only invite STAFF, TEACHER, LIBRARIAN or ACCOUNTANT');
    }

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    if ((data.role === 'TEACHER' || data.role === 'LIBRARIAN') && company.businessType !== 'SCHOOL') {
      throw new BadRequestException('TEACHER and LIBRARIAN roles are only valid for school companies');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });

    if (existing) {
      const link = await this.prisma.userCompany.findUnique({
        where: { userId_companyId: { userId: existing.id, companyId } },
      });
      if (link) throw new BadRequestException('User already belongs to this company');

      await this.prisma.userCompany.create({
        data: { userId: existing.id, companyId, isDefault: false },
      });

      await this.prisma.user.update({ where: { id: existing.id }, data: { role: data.role as any } });

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
        emailVerified: true,
        mustChangePassword: true,
        userCompanies: {
          create: { companyId, isDefault: true },
        },
      },
      select: { id: true, email: true, name: true, role: true },
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

    try {
      await this.mailService.sendInvitation(data.adminEmail, data.adminName, company.name, tempPassword);
    } catch (err) {
      console.error('Client-provisioning invite email failed:', (err as Error).message);
    }

    return { company, admin, tempPassword };
  }

  async changeRole(targetUserId: string, companyId: string, newRole: string, changedByRole: string) {
    if (!ROLE_HIERARCHY.includes(newRole)) {
      throw new BadRequestException(`Invalid role: ${newRole}`);
    }

    if (changedByRole === 'ADMIN' && !ADMIN_GRANTABLE.includes(newRole)) {
      throw new ForbiddenException('ADMIN can only assign STAFF, TEACHER, LIBRARIAN or ACCOUNTANT roles');
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

    if (newRole === 'TEACHER' || newRole === 'LIBRARIAN') {
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (company?.businessType !== 'SCHOOL') {
        throw new BadRequestException('TEACHER and LIBRARIAN roles are only valid for school companies');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole as any },
      select: { id: true, email: true, name: true, role: true },
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
      throw new ForbiddenException('ADMIN can only remove STAFF, TEACHER, LIBRARIAN or ACCOUNTANT users');
    }

    const link = await this.prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: targetUserId, companyId } },
    });
    if (!link) throw new NotFoundException('User does not belong to this company');

    await this.prisma.userCompany.delete({ where: { id: link.id } });

    return { message: 'User removed from company' };
  }

  async listCompanyUsers(companyId: string) {
    const links = await this.prisma.userCompany.findMany({
      where: { companyId },
      include: { user: { select: { id: true, email: true, name: true, role: true, createdAt: true } } },
    });
    return links.map((l) => ({ ...l.user, isDefault: l.isDefault }));
  }
}
