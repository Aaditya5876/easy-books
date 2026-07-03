import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { MailService } from './mail.service';
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

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole as any },
      select: { id: true, email: true, name: true, role: true },
    });

    return updated;
  }

  async listCompanyUsers(companyId: string) {
    const links = await this.prisma.userCompany.findMany({
      where: { companyId },
      include: { user: { select: { id: true, email: true, name: true, role: true, createdAt: true } } },
    });
    return links.map((l) => ({ ...l.user, isDefault: l.isDefault }));
  }
}
