import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { MODULE_KEYS, ModuleKey } from '../../../core/modules/module-keys';

@Injectable()
export class CompanyServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const userCompanies = await this.prisma.userCompany.findMany({
      where: { userId },
      include: { company: true },
      orderBy: [{ isDefault: 'desc' }, { company: { createdAt: 'desc' } }],
    });
    return userCompanies.map(uc => ({ ...uc.company, isDefault: uc.isDefault }));
  }

  async getUserCompanies(userId: string) {
    const userCompanies = await this.prisma.userCompany.findMany({
      where: { userId },
      include: { company: true },
      orderBy: [{ isDefault: 'desc' }, { company: { createdAt: 'desc' } }],
    });
    return userCompanies.map(uc => ({ ...uc.company, isDefault: uc.isDefault, userCompanyId: uc.id }));
  }

  async getDefaultCompany(userId: string) {
    const defaultUC = await this.prisma.userCompany.findFirst({
      where: { userId, isDefault: true },
      include: { company: true },
    });
    return defaultUC?.company || null;
  }

  // These routes are keyed on ":id" (the company itself), not a "companyId"
  // query/body param, so the global CompanyAccessGuard never sees them and
  // can't verify membership — every method below that touches a specific
  // company by id must check it here instead.
  private async assertMembership(companyId: string, userId: string, role: string) {
    if (role === 'SUPER_ADMIN') return;
    const membership = await this.prisma.userCompany.findFirst({ where: { userId, companyId } });
    if (!membership) throw new ForbiddenException('You do not have access to this company');
  }

  async findOne(id: string, userId: string, role: string) {
    await this.assertMembership(id, userId, role);
    const company = await this.prisma.company.findFirst({
      where: { id },
      include: { payrollSettings: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  // Self-serve creation (the Settings "Add Company" button) is capped by
  // User.maxCompanies — each company beyond that is a separate sale, raised
  // by a GeoInfosys SUPER_ADMIN via updateMaxCompanies(). The SUPER_ADMIN-only
  // provisionClient() sales-onboarding path does not go through here, so it's
  // never blocked by a customer's own limit.
  async create(data: any, userId?: string) {
    if (userId) {
      const [user, existingCount] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, select: { maxCompanies: true } }),
        this.prisma.userCompany.count({ where: { userId } }),
      ]);
      if (user && existingCount >= user.maxCompanies) {
        throw new ForbiddenException(
          `Your plan allows ${user.maxCompanies} compan${user.maxCompanies === 1 ? 'y' : 'ies'}. Contact GeoInfosys to add another.`,
        );
      }
    }

    const company = await this.prisma.company.create({ data });
    if (userId) {
      const existingDefault = await this.prisma.userCompany.findFirst({
        where: { userId, isDefault: true },
      });
      await this.prisma.userCompany.create({
        data: {
          userId,
          companyId: company.id,
          isDefault: !existingDefault,
        },
      });
    }
    return company;
  }

  async update(id: string, data: any, userId: string, role: string) {
    await this.assertMembership(id, userId, role);
    const company = await this.prisma.company.findFirst({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');
    const {
      id: _id, isDefault, createdAt, updatedAt,
      userCompanies, employees, attendance, payrolls,
      bankAccounts, transactions, ledgerAccounts, ledgerEntries,
      inventoryItems, salesOrders, purchaseOrders, payments,
      payrollSettings,
      // enabledModules controls which package a company is on — never
      // settable through this general-purpose endpoint (any company ADMIN
      // could otherwise grant themselves every module for free). Only
      // updatePackage() below, which is SUPER_ADMIN-gated at the controller,
      // may change it.
      enabledModules,
      // isActive is GeoInfosys's own suspend switch, not the client's — a
      // company ADMIN must not be able to reactivate (or deactivate) their
      // own company through this general-purpose endpoint. Only setActive()
      // below, SUPER_ADMIN-gated at the controller, may change it.
      isActive,
      // Same reasoning — an ADMIN must not be able to extend their own
      // subscription. Only setSubscriptionExpiry() below, SUPER_ADMIN-gated
      // at the controller, may change it.
      subscriptionExpiresAt,
      ...updateData
    } = data;
    return this.prisma.company.update({ where: { id }, data: updateData });
  }

  // SUPER_ADMIN-only (enforced by @Roles('SUPER_ADMIN') on the controller
  // route) — sets which package (Base/Standard/Premium) a company is on.
  async updatePackage(id: string, enabledModules: string[]) {
    const company = await this.prisma.company.findFirst({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');

    const invalid = enabledModules.filter((m) => !MODULE_KEYS.includes(m as ModuleKey));
    if (invalid.length > 0) throw new BadRequestException(`Unknown module key(s): ${invalid.join(', ')}`);

    return this.prisma.company.update({ where: { id }, data: { enabledModules } });
  }

  // SUPER_ADMIN-only (enforced by @Roles('SUPER_ADMIN') on the controller
  // route) — suspends/restores a client company. AuthServiceImpl.login()
  // blocks sign-in once every company a user belongs to is inactive.
  async setActive(id: string, isActive: boolean) {
    const company = await this.prisma.company.findFirst({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');
    return this.prisma.company.update({ where: { id }, data: { isActive } });
  }

  // SUPER_ADMIN-only (enforced by @Roles('SUPER_ADMIN') on the controller
  // route) — the automatic, time-based counterpart to setActive() above. Null
  // clears the expiry (no auto-lockout). Checked live by CompanyAccessGuard
  // and AuthServiceImpl.assertHasActiveCompany via isCompanyAccessible, not
  // flipped by a nightly job, so it takes effect to the second — the actual
  // subscription pause/resume mechanism, distinct from the manual isActive
  // suspend switch.
  async setSubscriptionExpiry(id: string, expiresAt: Date | null) {
    const company = await this.prisma.company.findFirst({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');
    return this.prisma.company.update({ where: { id }, data: { subscriptionExpiresAt: expiresAt } });
  }

  // SUPER_ADMIN-only — every company across the whole platform, regardless of
  // whether this SUPER_ADMIN happens to be linked to it (findAll/getUserCompanies
  // above are deliberately userId-scoped for the "switch active company" UI;
  // this is the platform-operator view instead). Includes each company's
  // ADMIN(s) so the Clients screen can show/edit their maxCompanies inline.
  async findAllForSuperAdmin() {
    const companies = await this.prisma.company.findMany({
      include: {
        userCompanies: {
          include: {
            user: {
              select: {
                id: true, name: true, email: true, role: true,
                maxCompanies: true, isActive: true, lastLoginAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return companies.map(({ userCompanies, ...company }) => ({
      ...company,
      admins: userCompanies.filter((uc) => uc.user.role === 'ADMIN').map((uc) => uc.user),
    }));
  }

  async remove(id: string, userId: string, role: string) {
    await this.assertMembership(id, userId, role);
    return this.prisma.company.delete({ where: { id } });
  }

  // ─── Payroll Settings ────────────────────────────────────────────────────────

  async getPayrollSettings(companyId: string, userId: string, role: string) {
    await this.assertMembership(companyId, userId, role);
    const settings = await this.prisma.companyPayrollSettings.findUnique({ where: { companyId } });
    if (!settings) throw new NotFoundException('Payroll settings not configured');
    return settings;
  }

  async upsertPayrollSettings(companyId: string, userId: string, role: string, data: {
    ssfApplicable?: boolean;
    ssfEmployeeRate?: number;
    ssfEmployerRate?: number;
    pitApplicable?: boolean;
    dashainBonusApplicable?: boolean;
    dashainBonusMonth?: string;
    workingDaysPerMonth?: number;
    overtimeRatePerHour?: number;
    attendanceDeductionEnabled?: boolean;
    standardStartTime?: string;
    standardEndTime?: string;
  }) {
    await this.assertMembership(companyId, userId, role);
    return this.prisma.companyPayrollSettings.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });
  }
}
