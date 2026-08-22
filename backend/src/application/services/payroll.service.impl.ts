// This file is superseded by payroll.engine.ts which handles all payroll logic.
// Kept as an empty stub to avoid breaking imports.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';

@Injectable()
export class PayrollServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  // Read-only aggregate for reporting dashboards (e.g. school ops report) —
  // callers should use this instead of querying the Payroll table directly.
  async getMonthlyTotals(companyId: string, createdAt?: { gte?: Date; lte?: Date }) {
    return this.prisma.payroll.groupBy({
      by: ['month'],
      where: { companyId, ...(createdAt ? { createdAt } : {}) },
      _sum: { netSalary: true },
      _min: { createdAt: true },
    });
  }
}
