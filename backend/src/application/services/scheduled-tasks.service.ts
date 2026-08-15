import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { SchoolFinanceService } from './school-finance.service';
import { PayrollEngineService } from './payroll.engine';
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
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runMonthlyAutomation() {
    const currentBsMonth = adToBs(new Date()).split('-').slice(0, 2).join('-');
    const companies = await this.prisma.company.findMany({ select: { id: true, name: true, businessType: true } });

    for (const company of companies) {
      if (company.businessType === 'SCHOOL') {
        try {
          const result = await this.schoolFinance.billingRun(company.id, currentBsMonth);
          if (result.created > 0) {
            this.logger.log(`Auto-billed ${result.created} student(s) for "${company.name}" — ${currentBsMonth}`);
          }
        } catch (err) {
          this.logger.error(`Auto fee billing failed for "${company.name}": ${(err as Error).message}`);
        }
      }

      try {
        const result = await this.payrollEngine.processMonthlyPayroll(company.id, currentBsMonth);
        if (result.queued > 0) {
          this.logger.log(`Auto-queued payroll for ${result.queued} employee(s) — "${company.name}" — ${currentBsMonth}`);
        }
      } catch (err) {
        this.logger.error(`Auto payroll processing failed for "${company.name}": ${(err as Error).message}`);
      }
    }
  }
}
