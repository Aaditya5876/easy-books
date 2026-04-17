import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES } from '../../../core/queue/bull.client';

interface PayrollResult {
  employeeId: string;
  employeeName: string;
  month: string;
  basicSalary: number;
  presentDays: number;
  workingDays: number;
  deductions: number;
  netAmount: number;
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
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee) throw new Error(`Employee ${employeeId} not found`);

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);

    const attendance = await this.prisma.attendance.findMany({
      where: {
        employeeId,
        companyId,
        date: { gte: startDate, lte: endDate },
      },
    });

    const workingDays = endDate.getDate();
    const presentDays = attendance.filter((a) => ['PRESENT', 'HALF_DAY'].includes(a.status)).length;
    const halfDays = attendance.filter((a) => a.status === 'HALF_DAY').length;

    const basicSalary = Number(employee.salary);
    const perDaySalary = basicSalary / workingDays;
    const absentDays = workingDays - presentDays;
    const deductions = Number((absentDays * perDaySalary + halfDays * perDaySalary * 0.5).toFixed(2));
    const netAmount = Number((basicSalary - deductions).toFixed(2));

    await this.prisma.payroll.upsert({
      where: { employeeId_month: { employeeId, month } },
      create: { companyId, employeeId, month, salary: basicSalary, deductions, netAmount, status: 'PROCESSED' },
      update: { salary: basicSalary, deductions, netAmount, status: 'PROCESSED' },
    });

    return { employeeId, employeeName: employee.name, month, basicSalary, presentDays, workingDays, deductions, netAmount };
  }

  async getPayrollSummary(companyId: string, month: string) {
    const payrolls = await this.prisma.payroll.findMany({
      where: { companyId, month },
      include: { employee: { select: { name: true, designation: true, department: true } } },
    });

    const totalGross = payrolls.reduce((sum, p) => sum + Number(p.salary), 0);
    const totalDeductions = payrolls.reduce((sum, p) => sum + Number(p.deductions), 0);
    const totalNet = payrolls.reduce((sum, p) => sum + Number(p.netAmount), 0);

    return { month, payrolls, summary: { totalGross, totalDeductions, totalNet, count: payrolls.length } };
  }
}
