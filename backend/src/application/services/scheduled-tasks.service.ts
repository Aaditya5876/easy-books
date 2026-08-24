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
//
// The daily reconciliation step below is genuinely daily, not monthly — it
// summarizes YESTERDAY's money movement (every company, not just schools)
// so nothing needs a human to remember to go check it.
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
    const companies = await this.prisma.company.findMany({
      select: {
        id: true, name: true, businessType: true,
        autoFeeBilling: true, autoInvoiceRelease: true, autoPayroll: true, autoReconciliation: true,
      },
    });

    for (const company of companies) {
      const updates: Array<{ label: string; items: { name: string; amount?: number }[] }> = [];
      let link: string | undefined;

      if (company.businessType === 'SCHOOL' && company.autoFeeBilling) {
        try {
          const result = await this.schoolFinance.billingRun(
            company.id, currentBsMonth, undefined, undefined, undefined, company.autoInvoiceRelease,
          );
          if (result.created > 0) {
            this.logger.log(`Auto-billed ${result.created} student(s) for "${company.name}" — ${currentBsMonth}`);
            updates.push({
              label: `${result.created} fee invoice(s) generated for ${currentBsMonth}`,
              items: result.createdDetails.map((d) => ({ name: d.studentName, amount: d.amount })),
            });
            link = '/fees';
          }
        } catch (err) {
          this.logger.error(`Auto fee billing failed for "${company.name}": ${(err as Error).message}`);
        }
      }

      if (company.autoPayroll) {
        try {
          const result = await this.payrollEngine.processMonthlyPayrollAwaited(company.id, currentBsMonth);
          if (result.queued > 0) {
            this.logger.log(`Auto-processed payroll for ${result.results.length}/${result.queued} employee(s) — "${company.name}" — ${currentBsMonth}`);
            if (result.results.length > 0) {
              updates.push({
                label: `${result.results.length} payslip(s) processed for ${currentBsMonth}`,
                items: result.results.map((r) => ({ name: r.employeeName, amount: r.netSalary })),
              });
              link = link ?? '/payroll';
            }
          }
        } catch (err) {
          this.logger.error(`Auto payroll processing failed for "${company.name}": ${(err as Error).message}`);
        }
      }

      if (company.autoReconciliation) {
        try {
          const recon = await this.runDailyReconciliation(company.id, company.businessType);
          if (recon) {
            updates.push(recon.update);
            // An imbalance is the most urgent thing in this whole notification —
            // it always wins the link, overriding fee/payroll links above.
            if (recon.imbalance) link = '/ledger';
            else link = link ?? '/transactions';
          }
        } catch (err) {
          this.logger.error(`Daily reconciliation failed for "${company.name}": ${(err as Error).message}`);
        }
      }

      if (updates.length > 0) {
        const totalItems = updates.reduce((sum, u) => sum + u.items.length, 0);
        try {
          await this.notifications.notifyRole(company.id, ['ADMIN', 'SUPER_ADMIN'], {
            type: 'SYSTEM_AUTOMATION',
            title: 'Nightly automation completed',
            message: `${totalItems} update(s) made automatically — ${updates.map((u) => u.label).join(', ')}.`,
            link,
            details: { month: currentBsMonth, runAt: new Date().toISOString(), updates },
          });
        } catch (err) {
          this.logger.error(`Failed to notify admins for "${company.name}": ${(err as Error).message}`);
        }
      }
    }
  }

  // Summarizes yesterday's money movement for one company: payments received
  // by method, overdue fee invoices (schools), and a debit=credit sanity check
  // on the ledger entries posted that day. Returns null if nothing happened —
  // most days for a small company, so this stays a fast no-op like the rest.
  private async runDailyReconciliation(companyId: string, businessType: string | null) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

    const transactions = await this.prisma.transaction.findMany({
      where: { companyId, dateAd: { gte: yesterdayStart, lt: todayStart }, status: 'COMPLETED' },
      select: { type: true, category: true, amount: true },
    });

    const entries = await this.prisma.ledgerEntry.findMany({
      where: { companyId, createdAt: { gte: yesterdayStart, lt: todayStart } },
      select: { debit: true, credit: true },
    });
    const totalDebit = entries.reduce((s, e) => s + Number(e.debit), 0);
    const totalCredit = entries.reduce((s, e) => s + Number(e.credit), 0);
    const imbalance = entries.length > 0 && Math.abs(totalDebit - totalCredit) > 0.01;

    let overdueCount = 0;
    let overdueTotal = 0;
    if (businessType === 'SCHOOL') {
      const overdue = await this.prisma.feeInvoice.findMany({
        where: { companyId, status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: now } },
        select: { totalAmount: true, paidAmount: true },
      });
      overdueCount = overdue.length;
      overdueTotal = overdue.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0);
    }

    if (transactions.length === 0 && overdueCount === 0 && !imbalance) return null;

    const byType = new Map<string, number>();
    let totalIncome = 0;
    let totalExpense = 0;
    for (const t of transactions) {
      byType.set(t.type, (byType.get(t.type) ?? 0) + Number(t.amount));
      if (t.category === 'INCOME') totalIncome += Number(t.amount);
      else if (t.category === 'EXPENSE') totalExpense += Number(t.amount);
    }

    const parts: string[] = [];
    if (transactions.length > 0) parts.push(`Rs. ${totalIncome.toFixed(2)} received, Rs. ${totalExpense.toFixed(2)} spent (${transactions.length} transactions)`);
    if (overdueCount > 0) parts.push(`${overdueCount} overdue invoice(s) totaling Rs. ${overdueTotal.toFixed(2)}`);
    if (imbalance) parts.push(`⚠ ledger imbalance detected — debits Rs. ${totalDebit.toFixed(2)} vs credits Rs. ${totalCredit.toFixed(2)}`);

    return {
      imbalance,
      update: {
        label: `Daily reconciliation — ${parts.join('; ')}`,
        items: [...byType.entries()].map(([type, amount]) => ({ name: type, amount })),
      },
    };
  }
}
