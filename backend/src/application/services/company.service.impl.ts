import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';

@Injectable()
export class CompanyServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.company.findMany({ orderBy: { createdAt: 'desc' } });
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
    return this.prisma.company.update({ where: { id }, data });
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
