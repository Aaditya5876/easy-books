import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { adToBs } from '@easy-books/shared';

// System ledger account names — created automatically if missing
const SYSTEM_ACCOUNTS = {
  SALES_REVENUE: 'Sales Revenue',
  ACCOUNTS_RECEIVABLE: 'Accounts Receivable',
  PURCHASE_EXPENSE: 'Purchase Expenses',
  ACCOUNTS_PAYABLE: 'Accounts Payable',
  VAT_PAYABLE: 'VAT Payable',
  VAT_RECEIVABLE: 'VAT Receivable',
  SALARY_EXPENSE: 'Salary Expense',
  SSF_PAYABLE: 'SSF Payable',
  CASH_IN_HAND: 'Cash in Hand',
  BANK: 'Bank Account',
};

@Injectable()
export class LedgerPostingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Sales Order ─────────────────────────────────────────────────────────────

  async postSalesOrder(companyId: string, salesOrderId: string): Promise<void> {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, companyId },
    });
    if (!order) return;

    const date = new Date(order.dateAd);
    const dateBs = adToBs(date);

    const [salesAccount, arAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.SALES_REVENUE, 'INCOME'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE, 'ASSET'),
    ]);

    const entries = [
      // Debit: Accounts Receivable (customer owes us)
      {
        companyId,
        accountId: arAccount.id,
        dateAd: date,
        dateBs,
        description: `Sales Invoice #${order.invoiceNumber} — ${order.clientName}`,
        debit: Number(order.totalAmount),
        credit: 0,
        balance: Number(arAccount.currentBalance) + Number(order.totalAmount),
        referenceType: 'SALES_ORDER',
        referenceId: salesOrderId,
        isAutoPosted: true,
      },
      // Credit: Sales Revenue
      {
        companyId,
        accountId: salesAccount.id,
        dateAd: date,
        dateBs,
        description: `Sales Invoice #${order.invoiceNumber} — ${order.clientName}`,
        debit: 0,
        credit: Number(order.subtotal),
        balance: Number(salesAccount.currentBalance) + Number(order.subtotal),
        referenceType: 'SALES_ORDER',
        referenceId: salesOrderId,
        isAutoPosted: true,
      },
    ];

    const vatEntries = [];
    if (order.isVat && Number(order.vatAmount) > 0) {
      const vatAccount = await this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.VAT_PAYABLE, 'LIABILITY');
      vatEntries.push({
        companyId,
        accountId: vatAccount.id,
        dateAd: date,
        dateBs,
        description: `VAT on Invoice #${order.invoiceNumber}`,
        debit: 0,
        credit: Number(order.vatAmount),
        balance: Number(vatAccount.currentBalance) + Number(order.vatAmount),
        referenceType: 'SALES_ORDER',
        referenceId: salesOrderId,
        isAutoPosted: true,
      });
    }

    await this.prisma.$transaction([
      ...entries.map((e) => this.prisma.ledgerEntry.create({ data: e })),
      ...vatEntries.map((e) => this.prisma.ledgerEntry.create({ data: e })),
      this.prisma.ledgerAccount.update({
        where: { id: arAccount.id },
        data: { currentBalance: { increment: Number(order.totalAmount) } },
      }),
      this.prisma.ledgerAccount.update({
        where: { id: salesAccount.id },
        data: { currentBalance: { increment: Number(order.subtotal) } },
      }),
    ]);
  }

  // ─── Purchase Order ──────────────────────────────────────────────────────────

  async postPurchaseOrder(companyId: string, purchaseOrderId: string): Promise<void> {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, companyId },
    });
    if (!order) return;

    const date = new Date(order.dateAd);
    const dateBs = adToBs(date);

    const [purchaseAccount, apAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.PURCHASE_EXPENSE, 'EXPENSE'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.ACCOUNTS_PAYABLE, 'LIABILITY'),
    ]);

    const entries = [
      // Debit: Purchase Expense
      {
        companyId,
        accountId: purchaseAccount.id,
        dateAd: date,
        dateBs,
        description: `Purchase #${order.orderNumber} — ${order.vendorName}`,
        debit: Number(order.subtotal),
        credit: 0,
        balance: Number(purchaseAccount.currentBalance) + Number(order.subtotal),
        referenceType: 'PURCHASE_ORDER',
        referenceId: purchaseOrderId,
        isAutoPosted: true,
      },
      // Credit: Accounts Payable (we owe vendor)
      {
        companyId,
        accountId: apAccount.id,
        dateAd: date,
        dateBs,
        description: `Purchase #${order.orderNumber} — ${order.vendorName}`,
        debit: 0,
        credit: Number(order.totalAmount),
        balance: Number(apAccount.currentBalance) + Number(order.totalAmount),
        referenceType: 'PURCHASE_ORDER',
        referenceId: purchaseOrderId,
        isAutoPosted: true,
      },
    ];

    const vatEntries = [];
    if (order.isVat && Number(order.vatAmount) > 0) {
      const vatRcvbl = await this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.VAT_RECEIVABLE, 'ASSET');
      vatEntries.push({
        companyId,
        accountId: vatRcvbl.id,
        dateAd: date,
        dateBs,
        description: `VAT on Purchase #${order.orderNumber}`,
        debit: Number(order.vatAmount),
        credit: 0,
        balance: Number(vatRcvbl.currentBalance) + Number(order.vatAmount),
        referenceType: 'PURCHASE_ORDER',
        referenceId: purchaseOrderId,
        isAutoPosted: true,
      });
    }

    await this.prisma.$transaction([
      ...entries.map((e) => this.prisma.ledgerEntry.create({ data: e })),
      ...vatEntries.map((e) => this.prisma.ledgerEntry.create({ data: e })),
      this.prisma.ledgerAccount.update({
        where: { id: purchaseAccount.id },
        data: { currentBalance: { increment: Number(order.subtotal) } },
      }),
      this.prisma.ledgerAccount.update({
        where: { id: apAccount.id },
        data: { currentBalance: { increment: Number(order.totalAmount) } },
      }),
    ]);
  }

  // ─── Payment (Sales) ─────────────────────────────────────────────────────────

  async postPaymentReceived(companyId: string, paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, companyId },
      include: { salesOrder: true },
    });
    if (!payment || !payment.salesOrder) return;

    const date = new Date(payment.dateAd);
    const dateBs = adToBs(date);
    const cashOrBankAccountName = payment.paymentMethod === 'CASH' ? SYSTEM_ACCOUNTS.CASH_IN_HAND : SYSTEM_ACCOUNTS.BANK;

    const [cashAccount, arAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, cashOrBankAccountName, 'ASSET'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE, 'ASSET'),
    ]);

    await this.prisma.$transaction([
      this.prisma.ledgerEntry.create({
        data: {
          companyId,
          accountId: cashAccount.id,
          dateAd: date,
          dateBs,
          description: `Payment received for Invoice #${payment.salesOrder.invoiceNumber}`,
          debit: Number(payment.amount),
          credit: 0,
          balance: Number(cashAccount.currentBalance) + Number(payment.amount),
          referenceType: 'PAYMENT',
          referenceId: paymentId,
          isAutoPosted: true,
        },
      }),
      this.prisma.ledgerEntry.create({
        data: {
          companyId,
          accountId: arAccount.id,
          dateAd: date,
          dateBs,
          description: `Payment received for Invoice #${payment.salesOrder.invoiceNumber}`,
          debit: 0,
          credit: Number(payment.amount),
          balance: Number(arAccount.currentBalance) - Number(payment.amount),
          referenceType: 'PAYMENT',
          referenceId: paymentId,
          isAutoPosted: true,
        },
      }),
      this.prisma.ledgerAccount.update({
        where: { id: cashAccount.id },
        data: { currentBalance: { increment: Number(payment.amount) } },
      }),
      this.prisma.ledgerAccount.update({
        where: { id: arAccount.id },
        data: { currentBalance: { decrement: Number(payment.amount) } },
      }),
    ]);
  }

  // ─── Payroll ─────────────────────────────────────────────────────────────────

  async postPayroll(companyId: string, payrollId: string): Promise<void> {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, companyId },
      include: { employee: { select: { name: true } } },
    });
    if (!payroll) return;

    const date = new Date();
    const dateBs = adToBs(date);

    const [salaryExpense, ssfPayable, cashAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.SALARY_EXPENSE, 'EXPENSE'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.SSF_PAYABLE, 'LIABILITY'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.CASH_IN_HAND, 'ASSET'),
    ]);

    await this.prisma.$transaction([
      this.prisma.ledgerEntry.create({
        data: {
          companyId,
          accountId: salaryExpense.id,
          dateAd: date,
          dateBs,
          description: `Payroll ${payroll.month} — ${payroll.employee.name}`,
          debit: Number(payroll.grossSalary),
          credit: 0,
          balance: Number(salaryExpense.currentBalance) + Number(payroll.grossSalary),
          referenceType: 'PAYROLL',
          referenceId: payrollId,
          isAutoPosted: true,
        },
      }),
      this.prisma.ledgerEntry.create({
        data: {
          companyId,
          accountId: ssfPayable.id,
          dateAd: date,
          dateBs,
          description: `SSF Payable ${payroll.month} — ${payroll.employee.name}`,
          debit: 0,
          credit: Number(payroll.ssfEmployee) + Number(payroll.ssfEmployer),
          balance: Number(ssfPayable.currentBalance) + Number(payroll.ssfEmployee) + Number(payroll.ssfEmployer),
          referenceType: 'PAYROLL',
          referenceId: payrollId,
          isAutoPosted: true,
        },
      }),
      this.prisma.ledgerEntry.create({
        data: {
          companyId,
          accountId: cashAccount.id,
          dateAd: date,
          dateBs,
          description: `Net Salary Paid ${payroll.month} — ${payroll.employee.name}`,
          debit: 0,
          credit: Number(payroll.netSalary),
          balance: Number(cashAccount.currentBalance) - Number(payroll.netSalary),
          referenceType: 'PAYROLL',
          referenceId: payrollId,
          isAutoPosted: true,
        },
      }),
      this.prisma.ledgerAccount.update({ where: { id: salaryExpense.id }, data: { currentBalance: { increment: Number(payroll.grossSalary) } } }),
      this.prisma.ledgerAccount.update({ where: { id: ssfPayable.id }, data: { currentBalance: { increment: Number(payroll.ssfEmployee) + Number(payroll.ssfEmployer) } } }),
      this.prisma.ledgerAccount.update({ where: { id: cashAccount.id }, data: { currentBalance: { decrement: Number(payroll.netSalary) } } }),
    ]);
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  private async getOrCreateSystemAccount(companyId: string, accountName: string, accountType: string) {
    const existing = await this.prisma.ledgerAccount.findFirst({
      where: { companyId, accountName },
    });
    if (existing) return existing;

    return this.prisma.ledgerAccount.create({
      data: {
        companyId,
        accountName,
        accountType: accountType as any,
        openingBalance: 0,
        currentBalance: 0,
        isSystem: true,
      },
    });
  }
}
