import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { SchoolFinanceService } from './school-finance.service';
import { PayrollEngineService } from './payroll.engine';
import { NotificationServiceImpl } from './notification.service.impl';
import { adToBs } from '@easy-books/shared';

// Fully automatic monthly fee billing + payroll — no button click required.
// Deliberately runs DAILY rather than "on the 1st of the month": fee/payroll
// months are Bikram Sambat, which don't line up with AD month boundaries, so
// computing the exact BS rollover date is unnecessary complexity. Both
// billingRun() and processMonthlyPayroll() are already idempotent per
// (company, month) — billingRun() skips students already billed for that
// month, and calculateEmployeePayroll() looks up the existing row by
// (employeeId, month) — so running this daily just means the day the BS month
// actually rolls over, it quietly catches it; every other day it's a fast no-op.
@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolFinance: SchoolFinanceService,
    private readonly payrollEngine: PayrollEngineService,
    private readonly notifications: NotificationServiceImpl,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runMonthlyAutomation() {
    const currentBsMonth = adToBs(new Date()).split('-').slice(0, 2).join('-');
    const companies = await this.prisma.company.findMany({ select: { id: true, name: true, businessType: true } });

    for (const company of companies) {
      const updates: Array<{ label: string; items: { name: string; amount?: number }[] }> = [];

      if (company.businessType === 'SCHOOL') {
        try {
          const result = await this.schoolFinance.billingRun(company.id, currentBsMonth);
          if (result.created > 0) {
            this.logger.log(`Auto-billed ${result.created} student(s) for "${company.name}" — ${currentBsMonth}`);
            updates.push({
              label: `${result.created} fee invoice(s) generated for ${currentBsMonth}`,
              items: result.createdDetails.map((d) => ({ name: d.studentName, amount: d.amount })),
            });
          }
        } catch (err) {
          this.logger.error(`Auto fee billing failed for "${company.name}": ${(err as Error).message}`);
        }
      }

      try {
        const result = await this.payrollEngine.processMonthlyPayrollAwaited(company.id, currentBsMonth);
        if (result.queued > 0) {
          this.logger.log(`Auto-processed payroll for ${result.results.length}/${result.queued} employee(s) — "${company.name}" — ${currentBsMonth}`);
          if (result.results.length > 0) {
            updates.push({
              label: `${result.results.length} payslip(s) processed for ${currentBsMonth}`,
              items: result.results.map((r) => ({ name: r.employeeName, amount: r.netSalary })),
            });
          }
        }
      } catch (err) {
        this.logger.error(`Auto payroll processing failed for "${company.name}": ${(err as Error).message}`);
      }

      if (updates.length > 0) {
        const totalItems = updates.reduce((sum, u) => sum + u.items.length, 0);
        try {
          await this.notifications.notifyRole(company.id, ['ADMIN', 'SUPER_ADMIN'], {
            type: 'SYSTEM_AUTOMATION',
            title: 'Nightly automation completed',
            message: `${totalItems} update(s) made automatically — ${updates.map((u) => u.label).join(', ')}.`,
            details: { month: currentBsMonth, runAt: new Date().toISOString(), updates },
          });
        } catch (err) {
          this.logger.error(`Failed to notify admins for "${company.name}": ${(err as Error).message}`);
        }
      }
    }
  }
}
