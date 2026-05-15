import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { adToBs } from '@easy-books/shared';

const SYSTEM_ACCOUNTS = {
  SALES_REVENUE: 'Sales Revenue',
  SALES_RETURNS: 'Sales Returns',
  ACCOUNTS_RECEIVABLE: 'Accounts Receivable',
  PURCHASE_EXPENSE: 'Purchase Expenses',
  PURCHASE_RETURNS: 'Purchase Returns',
  ACCOUNTS_PAYABLE: 'Accounts Payable',
  VAT_PAYABLE: 'VAT Payable',
  VAT_RECEIVABLE: 'VAT Receivable',
  SALARY_EXPENSE: 'Salary Expense',
  SSF_EXPENSE: 'SSF Expense',
  SSF_PAYABLE: 'SSF Payable',
  TAX_PAYABLE: 'Tax Payable',
  CASH_IN_HAND: 'Cash in Hand',
  BANK: 'Bank Account',
  BANK_GUARANTEE_ASSET: 'Bank Guarantee — Contingent Asset',
  BANK_GUARANTEE_LIABILITY: 'Bank Guarantee — Contingent Liability',
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

    // Net taxable base = subtotal − discounts + labor charges
    const netTaxable = Number(order.subtotal) - Number(order.discountTotal) + Number(order.laborCharges);

    const [salesAccount, arAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.SALES_REVENUE, 'INCOME'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE, 'ASSET'),
    ]);

    const entries: any[] = [
      // DR Accounts Receivable — customer owes total incl. VAT
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
      // CR Sales Revenue — net taxable amount only (excl. VAT, net of discounts)
      {
        companyId,
        accountId: salesAccount.id,
        dateAd: date,
        dateBs,
        description: `Sales Invoice #${order.invoiceNumber} — ${order.clientName}`,
        debit: 0,
        credit: netTaxable,
        balance: Number(salesAccount.currentBalance) + netTaxable,
        referenceType: 'SALES_ORDER',
        referenceId: salesOrderId,
        isAutoPosted: true,
      },
    ];

    let vatAccount: any = null;
    const vatEntries: any[] = [];
    if (order.isVat && Number(order.vatAmount) > 0) {
      vatAccount = await this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.VAT_PAYABLE, 'LIABILITY');
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
        data: { currentBalance: { increment: netTaxable } },
      }),
      ...(vatAccount
        ? [
            this.prisma.ledgerAccount.update({
              where: { id: vatAccount.id },
              data: { currentBalance: { increment: Number(order.vatAmount) } },
            }),
          ]
        : []),
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

    // Net taxable base = subtotal − discounts + labor charges
    const netTaxable = Number(order.subtotal) - Number(order.discountTotal) + Number(order.laborCharges);

    const [purchaseAccount, apAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.PURCHASE_EXPENSE, 'EXPENSE'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.ACCOUNTS_PAYABLE, 'LIABILITY'),
    ]);

    const entries: any[] = [
      // DR Purchase Expense — net taxable amount
      {
        companyId,
        accountId: purchaseAccount.id,
        dateAd: date,
        dateBs,
        description: `Purchase #${order.orderNumber} — ${order.vendorName}`,
        debit: netTaxable,
        credit: 0,
        balance: Number(purchaseAccount.currentBalance) + netTaxable,
        referenceType: 'PURCHASE_ORDER',
        referenceId: purchaseOrderId,
        isAutoPosted: true,
      },
      // CR Accounts Payable — total incl. VAT
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

    let vatRcvbl: any = null;
    const vatEntries: any[] = [];
    if (order.isVat && Number(order.vatAmount) > 0) {
      vatRcvbl = await this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.VAT_RECEIVABLE, 'ASSET');
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
        data: { currentBalance: { increment: netTaxable } },
      }),
      this.prisma.ledgerAccount.update({
        where: { id: apAccount.id },
        data: { currentBalance: { increment: Number(order.totalAmount) } },
      }),
      ...(vatRcvbl
        ? [
            this.prisma.ledgerAccount.update({
              where: { id: vatRcvbl.id },
              data: { currentBalance: { increment: Number(order.vatAmount) } },
            }),
          ]
        : []),
    ]);
  }

  // ─── Payment Received (Sales) ─────────────────────────────────────────────────

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

  // ─── Payment Made (Purchase) ──────────────────────────────────────────────────

  async postPaymentMade(companyId: string, paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, companyId },
      include: { purchaseOrder: true },
    });
    if (!payment || !payment.purchaseOrder) return;

    const date = new Date(payment.dateAd);
    const dateBs = adToBs(date);
    const cashOrBankAccountName = payment.paymentMethod === 'CASH' ? SYSTEM_ACCOUNTS.CASH_IN_HAND : SYSTEM_ACCOUNTS.BANK;

    const [apAccount, cashAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.ACCOUNTS_PAYABLE, 'LIABILITY'),
      this.getOrCreateSystemAccount(companyId, cashOrBankAccountName, 'ASSET'),
    ]);

    await this.prisma.$transaction([
      // DR Accounts Payable — liability reduces
      this.prisma.ledgerEntry.create({
        data: {
          companyId,
          accountId: apAccount.id,
          dateAd: date,
          dateBs,
          description: `Payment to vendor for PO #${payment.purchaseOrder.orderNumber}`,
          debit: Number(payment.amount),
          credit: 0,
          balance: Number(apAccount.currentBalance) - Number(payment.amount),
          referenceType: 'PAYMENT',
          referenceId: paymentId,
          isAutoPosted: true,
        },
      }),
      // CR Cash / Bank — cash goes out
      this.prisma.ledgerEntry.create({
        data: {
          companyId,
          accountId: cashAccount.id,
          dateAd: date,
          dateBs,
          description: `Payment to vendor for PO #${payment.purchaseOrder.orderNumber}`,
          debit: 0,
          credit: Number(payment.amount),
          balance: Number(cashAccount.currentBalance) - Number(payment.amount),
          referenceType: 'PAYMENT',
          referenceId: paymentId,
          isAutoPosted: true,
        },
      }),
      this.prisma.ledgerAccount.update({
        where: { id: apAccount.id },
        data: { currentBalance: { decrement: Number(payment.amount) } },
      }),
      this.prisma.ledgerAccount.update({
        where: { id: cashAccount.id },
        data: { currentBalance: { decrement: Number(payment.amount) } },
      }),
    ]);
  }

  // ─── Credit Note ──────────────────────────────────────────────────────────────

  async postCreditNote(companyId: string, creditNoteId: string): Promise<void> {
    const cn = await this.prisma.creditNote.findFirst({ where: { id: creditNoteId, companyId } });
    if (!cn) return;

    const date = new Date(cn.dateAd);
    const dateBs = adToBs(date);
    const amount = Number(cn.amount);

    const [salesReturnsAccount, arAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.SALES_RETURNS, 'EXPENSE'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE, 'ASSET'),
    ]);

    await this.prisma.$transaction([
      // DR Sales Returns — reversal of revenue
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: salesReturnsAccount.id, dateAd: date, dateBs,
          description: `Credit Note #${cn.creditNoteNumber} — ${cn.reason}`,
          debit: amount, credit: 0,
          balance: Number(salesReturnsAccount.currentBalance) + amount,
          referenceType: 'CREDIT_NOTE', referenceId: creditNoteId, isAutoPosted: true,
        },
      }),
      // CR Accounts Receivable — client owes us less
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: arAccount.id, dateAd: date, dateBs,
          description: `Credit Note #${cn.creditNoteNumber} — ${cn.reason}`,
          debit: 0, credit: amount,
          balance: Number(arAccount.currentBalance) - amount,
          referenceType: 'CREDIT_NOTE', referenceId: creditNoteId, isAutoPosted: true,
        },
      }),
      this.prisma.ledgerAccount.update({ where: { id: salesReturnsAccount.id }, data: { currentBalance: { increment: amount } } }),
      this.prisma.ledgerAccount.update({ where: { id: arAccount.id }, data: { currentBalance: { decrement: amount } } }),
    ]);
  }

  // ─── Debit Note ───────────────────────────────────────────────────────────────

  async postDebitNote(companyId: string, debitNoteId: string): Promise<void> {
    const dn = await this.prisma.debitNote.findFirst({ where: { id: debitNoteId, companyId } });
    if (!dn) return;

    const date = new Date(dn.dateAd);
    const dateBs = adToBs(date);
    const amount = Number(dn.amount);

    const [apAccount, purchaseReturnsAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.ACCOUNTS_PAYABLE, 'LIABILITY'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.PURCHASE_RETURNS, 'INCOME'),
    ]);

    await this.prisma.$transaction([
      // DR Accounts Payable — we owe vendor less
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: apAccount.id, dateAd: date, dateBs,
          description: `Debit Note #${dn.debitNoteNumber} — ${dn.reason}`,
          debit: amount, credit: 0,
          balance: Number(apAccount.currentBalance) - amount,
          referenceType: 'DEBIT_NOTE', referenceId: debitNoteId, isAutoPosted: true,
        },
      }),
      // CR Purchase Returns — expense reduces
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: purchaseReturnsAccount.id, dateAd: date, dateBs,
          description: `Debit Note #${dn.debitNoteNumber} — ${dn.reason}`,
          debit: 0, credit: amount,
          balance: Number(purchaseReturnsAccount.currentBalance) + amount,
          referenceType: 'DEBIT_NOTE', referenceId: debitNoteId, isAutoPosted: true,
        },
      }),
      this.prisma.ledgerAccount.update({ where: { id: apAccount.id }, data: { currentBalance: { decrement: amount } } }),
      this.prisma.ledgerAccount.update({ where: { id: purchaseReturnsAccount.id }, data: { currentBalance: { increment: amount } } }),
    ]);
  }

  // ─── Cheque Cleared ───────────────────────────────────────────────────────────

  async postChequeCleared(companyId: string, chequeId: string): Promise<void> {
    const cheque = await this.prisma.cheque.findFirst({ where: { id: chequeId, companyId } });
    if (!cheque) return;

    const date = new Date();
    const dateBs = adToBs(date);
    const amount = Number(cheque.amount);

    const [bankAccount, counterAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.BANK, 'ASSET'),
      cheque.isReceivable
        ? this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE, 'ASSET')
        : this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.ACCOUNTS_PAYABLE, 'LIABILITY'),
    ]);

    if (cheque.isReceivable) {
      // Received cheque cleared: DR Bank, CR Accounts Receivable
      await this.prisma.$transaction([
        this.prisma.ledgerEntry.create({
          data: {
            companyId, accountId: bankAccount.id, dateAd: date, dateBs,
            description: `Cheque #${cheque.chequeNumber} cleared — ${cheque.partyName}`,
            debit: amount, credit: 0,
            balance: Number(bankAccount.currentBalance) + amount,
            referenceType: 'CHEQUE', referenceId: chequeId, isAutoPosted: true,
          },
        }),
        this.prisma.ledgerEntry.create({
          data: {
            companyId, accountId: counterAccount.id, dateAd: date, dateBs,
            description: `Cheque #${cheque.chequeNumber} cleared — ${cheque.partyName}`,
            debit: 0, credit: amount,
            balance: Number(counterAccount.currentBalance) - amount,
            referenceType: 'CHEQUE', referenceId: chequeId, isAutoPosted: true,
          },
        }),
        this.prisma.ledgerAccount.update({ where: { id: bankAccount.id }, data: { currentBalance: { increment: amount } } }),
        this.prisma.ledgerAccount.update({ where: { id: counterAccount.id }, data: { currentBalance: { decrement: amount } } }),
      ]);
    } else {
      // Issued cheque cleared: DR Accounts Payable, CR Bank
      await this.prisma.$transaction([
        this.prisma.ledgerEntry.create({
          data: {
            companyId, accountId: counterAccount.id, dateAd: date, dateBs,
            description: `Cheque #${cheque.chequeNumber} cleared — ${cheque.partyName}`,
            debit: amount, credit: 0,
            balance: Number(counterAccount.currentBalance) - amount,
            referenceType: 'CHEQUE', referenceId: chequeId, isAutoPosted: true,
          },
        }),
        this.prisma.ledgerEntry.create({
          data: {
            companyId, accountId: bankAccount.id, dateAd: date, dateBs,
            description: `Cheque #${cheque.chequeNumber} cleared — ${cheque.partyName}`,
            debit: 0, credit: amount,
            balance: Number(bankAccount.currentBalance) - amount,
            referenceType: 'CHEQUE', referenceId: chequeId, isAutoPosted: true,
          },
        }),
        this.prisma.ledgerAccount.update({ where: { id: counterAccount.id }, data: { currentBalance: { decrement: amount } } }),
        this.prisma.ledgerAccount.update({ where: { id: bankAccount.id }, data: { currentBalance: { decrement: amount } } }),
      ]);
    }
  }

  // ─── Petty Cash ───────────────────────────────────────────────────────────────

  async postPettyCash(companyId: string, voucherId: string): Promise<void> {
    const voucher = await this.prisma.pettyCashVoucher.findFirst({ where: { id: voucherId, companyId } });
    if (!voucher) return;

    const date = new Date(voucher.dateAd);
    const dateBs = adToBs(date);
    const amount = Number(voucher.amount);

    // Use category as expense account name, fall back to "Petty Cash Expense"
    const expenseAccountName = voucher.category ? `Petty Cash — ${voucher.category}` : 'Petty Cash Expense';

    const [expenseAccount, cashAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, expenseAccountName, 'EXPENSE'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.CASH_IN_HAND, 'ASSET'),
    ]);

    await this.prisma.$transaction([
      // DR Expense Account
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: expenseAccount.id, dateAd: date, dateBs,
          description: `Petty Cash #${voucher.voucherNo} — ${voucher.description}`,
          debit: amount, credit: 0,
          balance: Number(expenseAccount.currentBalance) + amount,
          referenceType: 'PETTY_CASH', referenceId: voucherId, isAutoPosted: true,
        },
      }),
      // CR Cash in Hand
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: cashAccount.id, dateAd: date, dateBs,
          description: `Petty Cash #${voucher.voucherNo} — ${voucher.description}`,
          debit: 0, credit: amount,
          balance: Number(cashAccount.currentBalance) - amount,
          referenceType: 'PETTY_CASH', referenceId: voucherId, isAutoPosted: true,
        },
      }),
      this.prisma.ledgerAccount.update({ where: { id: expenseAccount.id }, data: { currentBalance: { increment: amount } } }),
      this.prisma.ledgerAccount.update({ where: { id: cashAccount.id }, data: { currentBalance: { decrement: amount } } }),
    ]);
  }

  // ─── Payroll ──────────────────────────────────────────────────────────────────

  async postPayroll(companyId: string, payrollId: string): Promise<void> {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, companyId },
      include: { employee: { select: { name: true } } },
    });
    if (!payroll) return;

    const date = new Date();
    const dateBs = adToBs(date);

    // Effective gross = gross - absent deductions + overtime + dashain bonus
    const dashainBonus = payroll.isDashainBonus ? Number(payroll.basicSalary) : 0;
    const effectiveGross = Number(payroll.grossSalary) - Number(payroll.absentDeduction) + Number(payroll.overtimeAmount) + dashainBonus;

    const [salaryExpense, ssfExpense, ssfPayable, taxPayable, cashAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.SALARY_EXPENSE, 'EXPENSE'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.SSF_EXPENSE, 'EXPENSE'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.SSF_PAYABLE, 'LIABILITY'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.TAX_PAYABLE, 'LIABILITY'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.CASH_IN_HAND, 'ASSET'),
    ]);

    const totalSsf = Number(payroll.ssfEmployee) + Number(payroll.ssfEmployer);
    const desc = `Payroll ${payroll.month} — ${payroll.employee.name}`;

    await this.prisma.$transaction([
      // DR Salary Expense — effective gross paid (incl. dashain bonus, excl. absent deductions)
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: salaryExpense.id, dateAd: date, dateBs,
          description: desc,
          debit: effectiveGross, credit: 0,
          balance: Number(salaryExpense.currentBalance) + effectiveGross,
          referenceType: 'PAYROLL', referenceId: payrollId, isAutoPosted: true,
        },
      }),
      // DR SSF Expense — employer's contribution (additional cost to company)
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: ssfExpense.id, dateAd: date, dateBs,
          description: `SSF Employer Contribution ${payroll.month} — ${payroll.employee.name}`,
          debit: Number(payroll.ssfEmployer), credit: 0,
          balance: Number(ssfExpense.currentBalance) + Number(payroll.ssfEmployer),
          referenceType: 'PAYROLL', referenceId: payrollId, isAutoPosted: true,
        },
      }),
      // CR SSF Payable — total SSF (employee + employer) owed to SSF board
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: ssfPayable.id, dateAd: date, dateBs,
          description: `SSF Payable ${payroll.month} — ${payroll.employee.name}`,
          debit: 0, credit: totalSsf,
          balance: Number(ssfPayable.currentBalance) + totalSsf,
          referenceType: 'PAYROLL', referenceId: payrollId, isAutoPosted: true,
        },
      }),
      // CR Tax Payable — PIT withheld from employee
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: taxPayable.id, dateAd: date, dateBs,
          description: `PIT Withheld ${payroll.month} — ${payroll.employee.name}`,
          debit: 0, credit: Number(payroll.pit),
          balance: Number(taxPayable.currentBalance) + Number(payroll.pit),
          referenceType: 'PAYROLL', referenceId: payrollId, isAutoPosted: true,
        },
      }),
      // CR Cash — net salary disbursed
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: cashAccount.id, dateAd: date, dateBs,
          description: `Net Salary Paid ${payroll.month} — ${payroll.employee.name}`,
          debit: 0, credit: Number(payroll.netSalary),
          balance: Number(cashAccount.currentBalance) - Number(payroll.netSalary),
          referenceType: 'PAYROLL', referenceId: payrollId, isAutoPosted: true,
        },
      }),
      this.prisma.ledgerAccount.update({ where: { id: salaryExpense.id }, data: { currentBalance: { increment: effectiveGross } } }),
      this.prisma.ledgerAccount.update({ where: { id: ssfExpense.id }, data: { currentBalance: { increment: Number(payroll.ssfEmployer) } } }),
      this.prisma.ledgerAccount.update({ where: { id: ssfPayable.id }, data: { currentBalance: { increment: totalSsf } } }),
      this.prisma.ledgerAccount.update({ where: { id: taxPayable.id }, data: { currentBalance: { increment: Number(payroll.pit) } } }),
      this.prisma.ledgerAccount.update({ where: { id: cashAccount.id }, data: { currentBalance: { decrement: Number(payroll.netSalary) } } }),
    ]);
  }

  // ─── Bank Guarantee ───────────────────────────────────────────────────────────

  async postBankGuaranteeIssued(companyId: string, bgId: string): Promise<void> {
    const bg = await this.prisma.bankGuarantee.findFirst({ where: { id: bgId, companyId } });
    if (!bg) return;

    const date = new Date(bg.issuedDateAd);
    const dateBs = adToBs(date);
    const amount = Number(bg.amount);
    const desc = `Bank Guarantee Issued — ${bg.bgNumber} (${bg.partyName})`;

    const [assetAccount, liabilityAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.BANK_GUARANTEE_ASSET, 'ASSET'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.BANK_GUARANTEE_LIABILITY, 'LIABILITY'),
    ]);

    await this.prisma.$transaction([
      // DR Contingent Asset — company has a claim/security
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: assetAccount.id, dateAd: date, dateBs,
          description: desc, debit: amount, credit: 0,
          balance: Number(assetAccount.currentBalance) + amount,
          referenceType: 'BANK_GUARANTEE', referenceId: bgId, isAutoPosted: true,
        },
      }),
      // CR Contingent Liability — obligation to the bank
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: liabilityAccount.id, dateAd: date, dateBs,
          description: desc, debit: 0, credit: amount,
          balance: Number(liabilityAccount.currentBalance) + amount,
          referenceType: 'BANK_GUARANTEE', referenceId: bgId, isAutoPosted: true,
        },
      }),
      this.prisma.ledgerAccount.update({ where: { id: assetAccount.id }, data: { currentBalance: { increment: amount } } }),
      this.prisma.ledgerAccount.update({ where: { id: liabilityAccount.id }, data: { currentBalance: { increment: amount } } }),
    ]);
  }

  async postBankGuaranteeClosed(companyId: string, bgId: string): Promise<void> {
    const bg = await this.prisma.bankGuarantee.findFirst({ where: { id: bgId, companyId } });
    if (!bg) return;

    const date = new Date();
    const dateBs = adToBs(date);
    const amount = Number(bg.amount);
    const desc = `Bank Guarantee Closed — ${bg.bgNumber} (${bg.partyName})`;

    const [assetAccount, liabilityAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.BANK_GUARANTEE_ASSET, 'ASSET'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.BANK_GUARANTEE_LIABILITY, 'LIABILITY'),
    ]);

    await this.prisma.$transaction([
      // Reverse: CR Contingent Asset
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: assetAccount.id, dateAd: date, dateBs,
          description: desc, debit: 0, credit: amount,
          balance: Number(assetAccount.currentBalance) - amount,
          referenceType: 'BANK_GUARANTEE', referenceId: bgId, isAutoPosted: true,
        },
      }),
      // Reverse: DR Contingent Liability
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: liabilityAccount.id, dateAd: date, dateBs,
          description: desc, debit: amount, credit: 0,
          balance: Number(liabilityAccount.currentBalance) - amount,
          referenceType: 'BANK_GUARANTEE', referenceId: bgId, isAutoPosted: true,
        },
      }),
      this.prisma.ledgerAccount.update({ where: { id: assetAccount.id }, data: { currentBalance: { decrement: amount } } }),
      this.prisma.ledgerAccount.update({ where: { id: liabilityAccount.id }, data: { currentBalance: { decrement: amount } } }),
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
