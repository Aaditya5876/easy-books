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

  async findOne(id: string) {
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

  async update(id: string, data: any) {
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

  async remove(id: string) {
    return this.prisma.company.delete({ where: { id } });
  }

  // ─── Payroll Settings ────────────────────────────────────────────────────────

  async getPayrollSettings(companyId: string) {
    const settings = await this.prisma.companyPayrollSettings.findUnique({ where: { companyId } });
    if (!settings) throw new NotFoundException('Payroll settings not configured');
    return settings;
  }

  async upsertPayrollSettings(companyId: string, data: {
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
    return this.prisma.companyPayrollSettings.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });
  }
}
