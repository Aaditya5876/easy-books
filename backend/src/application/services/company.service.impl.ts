import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';

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

  async create(data: any) {
    return this.prisma.company.create({ data });
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
      ...updateData
    } = data;
    return this.prisma.company.update({ where: { id }, data: updateData });
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
  }) {
    return this.prisma.companyPayrollSettings.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });
  }
}
