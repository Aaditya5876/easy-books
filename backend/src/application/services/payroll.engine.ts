import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES } from '../../../core/queue/bull.client';
import { adToBs, bsToAd } from '@easy-books/shared';
import { LedgerPostingService } from './ledger-posting.service';
import { NotificationServiceImpl } from './notification.service.impl';
import { PIT_SLABS_MARRIED, PIT_SLABS_UNMARRIED } from '../../domain/vo';

export interface PayrollResult {
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
  dashainBonus: number;
  isDashainBonus: boolean;
  netSalary: number;
}

function calculateSSF(basicSalary: number, employeeRate: number, employerRate: number) {
  return {
    employee: Number((basicSalary * (employeeRate / 100)).toFixed(2)),
    employer: Number((basicSalary * (employerRate / 100)).toFixed(2)),
  };
}

// Annual PIT on annual gross — returns monthly portion
// Uses IRD Nepal slabs from vo.ts (PIT_SLABS_MARRIED / PIT_SLABS_UNMARRIED)
function calculateMonthlyPIT(monthlyGross: number, isMarried: boolean): number {
  const annual = monthlyGross * 12;
  const slabs = isMarried ? PIT_SLABS_MARRIED : PIT_SLABS_UNMARRIED;
  let tax = 0;
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

// Maps dashainBonusMonth setting (name or number string) to BS month number
function getDashainMonthNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const num = parseInt(value, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) return num;
  const names: Record<string, number> = {
    baishakh: 1, jestha: 2, ashadh: 3, shrawan: 4, bhadra: 5, aswin: 6,
    kartik: 7, mangsir: 8, poush: 9, magh: 10, falgun: 11, chaitra: 12,
  };
  return names[value.toLowerCase()] ?? null;
}

@Injectable()
export class PayrollEngineService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.PAYROLL) private readonly payrollQueue: Queue,
    private readonly ledgerPosting: LedgerPostingService,
    private readonly notifications: NotificationServiceImpl,
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

    // Parse BS month and convert to AD date range using proper library (not ±57)
    const [bsYear, bsMonth] = month.split('-').map(Number);
    const startAd = bsToAd(`${bsYear}-${String(bsMonth).padStart(2, '0')}-01`);
    const nextBsYear = bsMonth === 12 ? bsYear + 1 : bsYear;
    const nextBsMonth = bsMonth === 12 ? 1 : bsMonth + 1;
    const endAd = bsToAd(`${nextBsYear}-${String(nextBsMonth).padStart(2, '0')}-01`);

    const attendance = await this.prisma.attendance.findMany({
      where: {
        employeeId,
        companyId,
        date: { gte: startAd, lt: endAd },
      },
    });

    const absentDays = attendance.filter((a) => a.status === 'ABSENT').length;
    const halfDays = attendance.filter((a) => a.status === 'HALF_DAY').length;

    const basicSalary = Number(employee.basicSalary);
    const allowancesJson = (employee.allowances as Record<string, number>) ?? {};
    const allowances = Object.values(allowancesJson).reduce((sum, v) => sum + Number(v), 0);
    const grossSalary = basicSalary + allowances;

    const perDaySalary = grossSalary / workingDaysPerMonth;
    const absentDeduction = Number(((absentDays + halfDays * 0.5) * perDaySalary).toFixed(2));

    const overtimeHoursTotal = attendance.reduce((sum, a) => sum + Number(a.overtimeHours ?? 0), 0);
    const overtimeRatePerHour = Number(settings?.overtimeRatePerHour ?? 0);
    const overtimeAmount = Number((overtimeHoursTotal * overtimeRatePerHour).toFixed(2));

    const ssf = ssfApplicable ? calculateSSF(basicSalary, empRate, emplRate) : { employee: 0, employer: 0 };
    const isMarried = (employee as any).maritalStatus === 'MARRIED';
    const pit = pitApplicable ? calculateMonthlyPIT(grossSalary, isMarried) : 0;

    // Dashain bonus — 1 month basic salary in the configured month
    const dashainMonthNum = getDashainMonthNumber(settings?.dashainBonusMonth ?? null);
    const isDashainBonus = !!(settings?.dashainBonusApplicable && dashainMonthNum && bsMonth === dashainMonthNum);
    const dashainBonus = isDashainBonus ? basicSalary : 0;

    const netSalary = Number((grossSalary - absentDeduction - ssf.employee - pit + overtimeAmount + dashainBonus).toFixed(2));

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
        isDashainBonus,
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
        isDashainBonus,
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
      dashainBonus,
      isDashainBonus,
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

  // Recomputes netSalary after adjusting otherDeductions (the only manually-editable line item)
  async adjustPayroll(companyId: string, payrollId: string, otherDeductions: number) {
    const payroll = await this.prisma.payroll.findFirst({ where: { id: payrollId, companyId } });
    if (!payroll) throw new Error('Payroll record not found');

    const dashainBonus = payroll.isDashainBonus ? Number(payroll.basicSalary) : 0;
    const netSalary = Number(
      (
        Number(payroll.grossSalary) -
        Number(payroll.absentDeduction) -
        Number(payroll.ssfEmployee) -
        Number(payroll.pit) +
        Number(payroll.overtimeAmount) +
        dashainBonus -
        otherDeductions
      ).toFixed(2),
    );

    return this.prisma.payroll.update({
      where: { id: payrollId },
      data: { otherDeductions, netSalary },
    });
  }

  async setHold(companyId: string, payrollId: string, isOnHold: boolean, holdReason?: string) {
    return this.prisma.payroll.update({
      where: { id: payrollId },
      data: { isOnHold, holdReason: isOnHold ? holdReason : null, status: isOnHold ? 'ON_HOLD' : 'PROCESSED' },
    });
  }

  async markAsPaid(companyId: string, payrollId: string) {
    const payroll = await this.prisma.payroll.update({
      where: { id: payrollId },
      data: { status: 'PAID', paidAt: new Date() },
    });

    // Post to GL after marking paid — outside the update so a ledger failure doesn't prevent status change
    await this.ledgerPosting.postPayroll(companyId, payrollId);

    try {
      const employee = await this.prisma.employee.findUnique({ where: { id: payroll.employeeId }, select: { name: true } });
      await this.notifications.notifyRole(companyId, ['ADMIN', 'ACCOUNTANT'], {
        type: 'PAYROLL_PAID',
        title: 'Payroll paid',
        message: `Payroll for ${employee?.name ?? 'employee'} (${payroll.month}) marked as paid — Rs. ${payroll.netSalary}`,
        link: '/payroll',
        referenceType: 'PAYROLL',
        referenceId: payrollId,
      });
    } catch (err) {
      console.error('Notification dispatch failed:', (err as Error).message);
    }

    return payroll;
  }

  // Nepal Labour Act 2074: gratuity = (last basic salary / 12) × total months worked, min 3 years service
  async calculateGratuity(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    });
    if (!employee) throw new Error('Employee not found');
    if (!employee.dateOfJoining) {
      return { eligible: false, reason: 'Date of joining not set', gratuityAmount: 0 };
    }

    const now = new Date();
    const joining = new Date(employee.dateOfJoining);
    const monthsWorked = (now.getFullYear() - joining.getFullYear()) * 12 + (now.getMonth() - joining.getMonth());
    const yearsWorked = monthsWorked / 12;

    if (yearsWorked < 3) {
      return {
        eligible: false,
        reason: `Minimum 3 years required. Current: ${yearsWorked.toFixed(1)} years`,
        gratuityAmount: 0,
        monthsWorked,
      };
    }

    const basicSalary = Number(employee.basicSalary);
    // Nepal Labour Act: half a month's salary per year of service = basicSalary × months / 24
    const monthlyAccrual = Number((basicSalary / 24).toFixed(2));
    const gratuityAmount = Number((monthlyAccrual * monthsWorked).toFixed(2));

    return {
      eligible: true,
      employeeName: employee.name,
      basicSalary,
      monthsWorked,
      yearsWorked: Number(yearsWorked.toFixed(2)),
      monthlyAccrual,
      gratuityAmount,
    };
  }
}
