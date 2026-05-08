import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES } from '../../../core/queue/bull.client';
import { adToBs } from '@easy-books/shared';

interface PayrollResult {
  employeeId: string;
  employeeName: string;
  month: string;
  basicSalary: number;
  allowances: number;
  grossSalary: number;
  absentDays: number;
  halfDays: number;
  absentDeduction: number;
  overtimeAmount: number;
  ssfEmployee: number;
  ssfEmployer: number;
  pit: number;
  netSalary: number;
}

function calculateSSF(basicSalary: number, employeeRate: number, employerRate: number) {
  return {
    employee: Number((basicSalary * (employeeRate / 100)).toFixed(2)),
    employer: Number((basicSalary * (employerRate / 100)).toFixed(2)),
  };
}

// Annual PIT on annual gross — returns monthly portion
function calculateMonthlyPIT(monthlyGross: number): number {
  const annual = monthlyGross * 12;
  let tax = 0;

  const slabs = [
    { upTo: 500000, rate: 0.01 },
    { upTo: 700000, rate: 0.10 },
    { upTo: 1000000, rate: 0.20 },
    { upTo: 2000000, rate: 0.30 },
    { upTo: Infinity, rate: 0.36 },
  ];

  let prev = 0;
  for (const slab of slabs) {
    if (annual <= prev) break;
    const taxable = Math.min(annual, slab.upTo) - prev;
    tax += taxable * slab.rate;
    prev = slab.upTo;
    if (annual <= slab.upTo) break;
  }

  return Number((tax / 12).toFixed(2));
}

@Injectable()
export class PayrollEngineService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.PAYROLL) private readonly payrollQueue: Queue,
  ) {}

  async processMonthlyPayroll(companyId: string, month: string): Promise<{ queued: number }> {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE' },
    });

    for (const emp of employees) {
      await this.payrollQueue.add('process-employee-payroll', { companyId, employeeId: emp.id, month });
    }

    return { queued: employees.length };
  }

  async calculateEmployeePayroll(companyId: string, employeeId: string, month: string): Promise<PayrollResult> {
    const [employee, settings] = await Promise.all([
      this.prisma.employee.findFirst({ where: { id: employeeId, companyId } }),
      this.prisma.companyPayrollSettings.findUnique({ where: { companyId } }),
    ]);

    if (!employee) throw new Error(`Employee ${employeeId} not found`);

    const workingDaysPerMonth = settings?.workingDaysPerMonth ?? 26;
    const ssfApplicable = settings?.ssfApplicable ?? true;
    const pitApplicable = settings?.pitApplicable ?? true;
    const empRate = Number(settings?.ssfEmployeeRate ?? 11);
    const emplRate = Number(settings?.ssfEmployerRate ?? 20);

    // Parse BS month — attendance stored by AD date range
    const [bsYear, bsMonth] = month.split('-').map(Number);

    const attendance = await this.prisma.attendance.findMany({
      where: {
        employeeId,
        companyId,
        date: {
          gte: new Date(`${bsYear - 57}-${String(bsMonth).padStart(2, '0')}-01`),
          lt: new Date(`${bsYear - 57}-${String(bsMonth + 1).padStart(2, '0')}-01`),
        },
      },
    });

    const absentDays = attendance.filter((a) => a.status === 'ABSENT').length;
    const halfDays = attendance.filter((a) => a.status === 'HALF_DAY').length;

    const basicSalary = Number(employee.basicSalary);
    const allowancesJson = (employee.allowances as Record<string, number>) ?? {};
    const allowances = Object.values(allowancesJson).reduce((sum, v) => sum + Number(v), 0);
    const grossSalary = basicSalary + allowances;

    const perDaySalary = basicSalary / workingDaysPerMonth;
    const absentDeduction = Number(((absentDays + halfDays * 0.5) * perDaySalary).toFixed(2));

    const overtimeHoursTotal = attendance.reduce((sum, a) => sum + Number(a.overtimeHours ?? 0), 0);
    const overtimeRatePerHour = Number(settings?.overtimeRatePerHour ?? 0);
    const overtimeAmount = Number((overtimeHoursTotal * overtimeRatePerHour).toFixed(2));

    const ssf = ssfApplicable ? calculateSSF(basicSalary, empRate, emplRate) : { employee: 0, employer: 0 };
    const pit = pitApplicable ? calculateMonthlyPIT(grossSalary) : 0;

    const netSalary = Number((grossSalary - absentDeduction - ssf.employee - pit + overtimeAmount).toFixed(2));

    await this.prisma.payroll.upsert({
      where: { employeeId_month: { employeeId, month } },
      create: {
        companyId,
        employeeId,
        month,
        basicSalary,
        allowances,
        grossSalary,
        absentDays,
        halfDays,
        absentDeduction,
        overtimeAmount,
        ssfEmployee: ssf.employee,
        ssfEmployer: ssf.employer,
        pit,
        netSalary,
        status: 'PROCESSED',
      },
      update: {
        basicSalary,
        allowances,
        grossSalary,
        absentDays,
        halfDays,
        absentDeduction,
        overtimeAmount,
        ssfEmployee: ssf.employee,
        ssfEmployer: ssf.employer,
        pit,
        netSalary,
        status: 'PROCESSED',
      },
    });

    return {
      employeeId,
      employeeName: employee.name,
      month,
      basicSalary,
      allowances,
      grossSalary,
      absentDays,
      halfDays,
      absentDeduction,
      overtimeAmount,
      ssfEmployee: ssf.employee,
      ssfEmployer: ssf.employer,
      pit,
      netSalary,
    };
  }

  async getPayrollSummary(companyId: string, month: string) {
    const payrolls = await this.prisma.payroll.findMany({
      where: { companyId, month },
      include: { employee: { select: { name: true, designation: true, department: true } } },
    });

    const summary = {
      totalBasic: payrolls.reduce((s, p) => s + Number(p.basicSalary), 0),
      totalAllowances: payrolls.reduce((s, p) => s + Number(p.allowances), 0),
      totalGross: payrolls.reduce((s, p) => s + Number(p.grossSalary), 0),
      totalSsfEmployee: payrolls.reduce((s, p) => s + Number(p.ssfEmployee), 0),
      totalSsfEmployer: payrolls.reduce((s, p) => s + Number(p.ssfEmployer), 0),
      totalPit: payrolls.reduce((s, p) => s + Number(p.pit), 0),
      totalNetSalary: payrolls.reduce((s, p) => s + Number(p.netSalary), 0),
      count: payrolls.length,
      onHoldCount: payrolls.filter((p) => p.isOnHold).length,
    };

    return { month, payrolls, summary };
  }

  async setHold(companyId: string, payrollId: string, isOnHold: boolean, holdReason?: string) {
    return this.prisma.payroll.update({
      where: { id: payrollId },
      data: { isOnHold, holdReason: isOnHold ? holdReason : null, status: isOnHold ? 'ON_HOLD' : 'PROCESSED' },
    });
  }

  async markAsPaid(companyId: string, payrollId: string) {
    return this.prisma.payroll.update({
      where: { id: payrollId },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }
}
