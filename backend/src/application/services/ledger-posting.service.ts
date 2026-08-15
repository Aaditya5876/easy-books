import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { adToBs } from '@easy-books/shared';

type Tx = Prisma.TransactionClient;

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
  SALARY_PAYABLE: 'Salary Payable',
  CASH_IN_HAND: 'Cash in Hand',
  BANK: 'Bank Account',
  BANK_GUARANTEE_ASSET: 'Bank Guarantee — Contingent Asset',
  BANK_GUARANTEE_LIABILITY: 'Bank Guarantee — Contingent Liability',
  FEE_RECEIVABLE: 'Fee Receivable',
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

  // Standalone entry point (cheque not linked to a Transaction) — wraps its own transaction.
  async postChequeCleared(companyId: string, chequeId: string): Promise<void> {
    return this.prisma.$transaction((tx) => this.postChequeClearedTx(tx, companyId, chequeId));
  }

  // Nested entry point — lets ChequeServiceImpl.updateStatus() post this as part of
  // the SAME atomic write as the cheque's own status change, so a thrown error here
  // rolls back the status change too instead of leaving them inconsistent.
  async postChequeClearedTx(tx: Tx, companyId: string, chequeId: string): Promise<void> {
    const cheque = await tx.cheque.findFirst({ where: { id: chequeId, companyId } });
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
      await tx.ledgerEntry.create({
        data: {
          companyId, accountId: bankAccount.id, dateAd: date, dateBs,
          description: `Cheque #${cheque.chequeNumber} cleared — ${cheque.partyName}`,
          debit: amount, credit: 0,
          balance: Number(bankAccount.currentBalance) + amount,
          referenceType: 'CHEQUE', referenceId: chequeId, isAutoPosted: true,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          companyId, accountId: counterAccount.id, dateAd: date, dateBs,
          description: `Cheque #${cheque.chequeNumber} cleared — ${cheque.partyName}`,
          debit: 0, credit: amount,
          balance: Number(counterAccount.currentBalance) - amount,
          referenceType: 'CHEQUE', referenceId: chequeId, isAutoPosted: true,
        },
      });
      await tx.ledgerAccount.update({ where: { id: bankAccount.id }, data: { currentBalance: { increment: amount } } });
      await tx.ledgerAccount.update({ where: { id: counterAccount.id }, data: { currentBalance: { decrement: amount } } });
    } else {
      // Issued cheque cleared: DR Accounts Payable, CR Bank
      await tx.ledgerEntry.create({
        data: {
          companyId, accountId: counterAccount.id, dateAd: date, dateBs,
          description: `Cheque #${cheque.chequeNumber} cleared — ${cheque.partyName}`,
          debit: amount, credit: 0,
          balance: Number(counterAccount.currentBalance) - amount,
          referenceType: 'CHEQUE', referenceId: chequeId, isAutoPosted: true,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          companyId, accountId: bankAccount.id, dateAd: date, dateBs,
          description: `Cheque #${cheque.chequeNumber} cleared — ${cheque.partyName}`,
          debit: 0, credit: amount,
          balance: Number(bankAccount.currentBalance) - amount,
          referenceType: 'CHEQUE', referenceId: chequeId, isAutoPosted: true,
        },
      });
      await tx.ledgerAccount.update({ where: { id: counterAccount.id }, data: { currentBalance: { decrement: amount } } });
      await tx.ledgerAccount.update({ where: { id: bankAccount.id }, data: { currentBalance: { decrement: amount } } });
    }
  }

  // ─── Petty Cash ───────────────────────────────────────────────────────────────

  async postPettyCash(companyId: string, voucherId: string): Promise<void> {
    return this.prisma.$transaction((tx) => this.postPettyCashTx(tx, companyId, voucherId));
  }

  // Nested entry point — lets PettyCashServiceImpl.create() post this as part of the
  // same atomic write as the voucher row itself.
  async postPettyCashTx(tx: Tx, companyId: string, voucherId: string): Promise<void> {
    const voucher = await tx.pettyCashVoucher.findFirst({ where: { id: voucherId, companyId } });
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

    // DR Expense Account
    await tx.ledgerEntry.create({
      data: {
        companyId, accountId: expenseAccount.id, dateAd: date, dateBs,
        description: `Petty Cash #${voucher.voucherNo} — ${voucher.description}`,
        debit: amount, credit: 0,
        balance: Number(expenseAccount.currentBalance) + amount,
        referenceType: 'PETTY_CASH', referenceId: voucherId, isAutoPosted: true,
      },
    });
    // CR Cash in Hand
    await tx.ledgerEntry.create({
      data: {
        companyId, accountId: cashAccount.id, dateAd: date, dateBs,
        description: `Petty Cash #${voucher.voucherNo} — ${voucher.description}`,
        debit: 0, credit: amount,
        balance: Number(cashAccount.currentBalance) - amount,
        referenceType: 'PETTY_CASH', referenceId: voucherId, isAutoPosted: true,
      },
    });
    await tx.ledgerAccount.update({ where: { id: expenseAccount.id }, data: { currentBalance: { increment: amount } } });
    await tx.ledgerAccount.update({ where: { id: cashAccount.id }, data: { currentBalance: { decrement: amount } } });
  }

  // ─── Payroll ──────────────────────────────────────────────────────────────────
  // Split into two stages so payroll can be computed automatically every month
  // without waiting for anyone to click "Mark Paid":
  //  - Accrual (postPayrollAccrualTx): posted the moment a payroll row is first
  //    computed. Recognizes the expense and the liability to the employee
  //    (Salary Payable) — money hasn't actually been disbursed yet.
  //  - Settlement (postPayrollSettlementTx): posted when "Mark Paid" is clicked
  //    (still a manual, per-employee action). Clears Salary Payable via Cash —
  //    the actual disbursement.
  // This mirrors the same accrual/settlement split used for Fee Receivable and
  // for Transaction Pending→Completed elsewhere in this file.

  async postPayrollAccrual(companyId: string, payrollId: string): Promise<void> {
    return this.prisma.$transaction((tx) => this.postPayrollAccrualTx(tx, companyId, payrollId));
  }

  async postPayrollAccrualTx(tx: Tx, companyId: string, payrollId: string): Promise<void> {
    const payroll = await tx.payroll.findFirst({
      where: { id: payrollId, companyId },
      include: { employee: { select: { name: true } } },
    });
    if (!payroll) return;

    const date = new Date();
    const dateBs = adToBs(date);

    // Effective gross = gross - absent deductions + overtime + dashain bonus
    const dashainBonus = payroll.isDashainBonus ? Number(payroll.basicSalary) : 0;
    const effectiveGross = Number(payroll.grossSalary) - Number(payroll.absentDeduction) + Number(payroll.overtimeAmount) + dashainBonus;

    const [salaryExpense, ssfExpense, ssfPayable, taxPayable, salaryPayable] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.SALARY_EXPENSE, 'EXPENSE'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.SSF_EXPENSE, 'EXPENSE'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.SSF_PAYABLE, 'LIABILITY'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.TAX_PAYABLE, 'LIABILITY'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.SALARY_PAYABLE, 'LIABILITY'),
    ]);

    const totalSsf = Number(payroll.ssfEmployee) + Number(payroll.ssfEmployer);
    const desc = `Payroll ${payroll.month} — ${payroll.employee.name}`;

    // DR Salary Expense — effective gross paid (incl. dashain bonus, excl. absent deductions)
    await tx.ledgerEntry.create({
      data: {
        companyId, accountId: salaryExpense.id, dateAd: date, dateBs,
        description: desc,
        debit: effectiveGross, credit: 0,
        balance: Number(salaryExpense.currentBalance) + effectiveGross,
        referenceType: 'PAYROLL_ACCRUAL', referenceId: payrollId, isAutoPosted: true,
      },
    });
    // DR SSF Expense — employer's contribution (additional cost to company)
    await tx.ledgerEntry.create({
      data: {
        companyId, accountId: ssfExpense.id, dateAd: date, dateBs,
        description: `SSF Employer Contribution ${payroll.month} — ${payroll.employee.name}`,
        debit: Number(payroll.ssfEmployer), credit: 0,
        balance: Number(ssfExpense.currentBalance) + Number(payroll.ssfEmployer),
        referenceType: 'PAYROLL_ACCRUAL', referenceId: payrollId, isAutoPosted: true,
      },
    });
    // CR SSF Payable — total SSF (employee + employer) owed to SSF board
    await tx.ledgerEntry.create({
      data: {
        companyId, accountId: ssfPayable.id, dateAd: date, dateBs,
        description: `SSF Payable ${payroll.month} — ${payroll.employee.name}`,
        debit: 0, credit: totalSsf,
        balance: Number(ssfPayable.currentBalance) + totalSsf,
        referenceType: 'PAYROLL_ACCRUAL', referenceId: payrollId, isAutoPosted: true,
      },
    });
    // CR Tax Payable — PIT withheld from employee
    await tx.ledgerEntry.create({
      data: {
        companyId, accountId: taxPayable.id, dateAd: date, dateBs,
        description: `PIT Withheld ${payroll.month} — ${payroll.employee.name}`,
        debit: 0, credit: Number(payroll.pit),
        balance: Number(taxPayable.currentBalance) + Number(payroll.pit),
        referenceType: 'PAYROLL_ACCRUAL', referenceId: payrollId, isAutoPosted: true,
      },
    });
    // CR Salary Payable — net salary now owed to the employee (not yet disbursed)
    await tx.ledgerEntry.create({
      data: {
        companyId, accountId: salaryPayable.id, dateAd: date, dateBs,
        description: `Net Salary Payable ${payroll.month} — ${payroll.employee.name}`,
        debit: 0, credit: Number(payroll.netSalary),
        balance: Number(salaryPayable.currentBalance) + Number(payroll.netSalary),
        referenceType: 'PAYROLL_ACCRUAL', referenceId: payrollId, isAutoPosted: true,
      },
    });

    await tx.ledgerAccount.update({ where: { id: salaryExpense.id }, data: { currentBalance: { increment: effectiveGross } } });
    await tx.ledgerAccount.update({ where: { id: ssfExpense.id }, data: { currentBalance: { increment: Number(payroll.ssfEmployer) } } });
    await tx.ledgerAccount.update({ where: { id: ssfPayable.id }, data: { currentBalance: { increment: totalSsf } } });
    await tx.ledgerAccount.update({ where: { id: taxPayable.id }, data: { currentBalance: { increment: Number(payroll.pit) } } });
    await tx.ledgerAccount.update({ where: { id: salaryPayable.id }, data: { currentBalance: { increment: Number(payroll.netSalary) } } });
  }

  // Reverses the accrual for a payroll row (used when recalculating a not-yet-paid
  // payroll — attendance/adjustments changed the numbers, so the old accrual must
  // be undone before the new one posts) — thin wrapper over reverseEntriesTx.
  async reversePayrollAccrualTx(tx: Tx, companyId: string, payrollId: string): Promise<void> {
    await this.reverseEntriesTx(tx, companyId, 'PAYROLL_ACCRUAL', payrollId);
  }

  async postPayrollSettlement(companyId: string, payrollId: string): Promise<void> {
    return this.prisma.$transaction((tx) => this.postPayrollSettlementTx(tx, companyId, payrollId));
  }

  // DR Salary Payable, CR Cash — clears the liability the accrual created,
  // via the actual disbursement. Called from markAsPaid(), still a manual,
  // per-employee action.
  async postPayrollSettlementTx(tx: Tx, companyId: string, payrollId: string): Promise<void> {
    const payroll = await tx.payroll.findFirst({
      where: { id: payrollId, companyId },
      include: { employee: { select: { name: true } } },
    });
    if (!payroll) return;

    const date = new Date();
    const dateBs = adToBs(date);
    const amount = Number(payroll.netSalary);

    const [salaryPayable, cashAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.SALARY_PAYABLE, 'LIABILITY'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.CASH_IN_HAND, 'ASSET'),
    ]);
    const desc = `Net Salary Paid ${payroll.month} — ${payroll.employee.name}`;

    await tx.ledgerEntry.create({
      data: {
        companyId, accountId: salaryPayable.id, dateAd: date, dateBs, description: desc,
        debit: amount, credit: 0,
        balance: Number(salaryPayable.currentBalance) - amount,
        referenceType: 'PAYROLL', referenceId: payrollId, isAutoPosted: true,
      },
    });
    await tx.ledgerEntry.create({
      data: {
        companyId, accountId: cashAccount.id, dateAd: date, dateBs, description: desc,
        debit: 0, credit: amount,
        balance: Number(cashAccount.currentBalance) - amount,
        referenceType: 'PAYROLL', referenceId: payrollId, isAutoPosted: true,
      },
    });
    await tx.ledgerAccount.update({ where: { id: salaryPayable.id }, data: { currentBalance: { decrement: amount } } });
    await tx.ledgerAccount.update({ where: { id: cashAccount.id }, data: { currentBalance: { decrement: amount } } });
  }

  // ─── Bank Guarantee ───────────────────────────────────────────────────────────

  async postBankGuaranteeIssued(companyId: string, bgId: string): Promise<void> {
    return this.prisma.$transaction((tx) => this.postBankGuaranteeIssuedTx(tx, companyId, bgId));
  }

  // Nested entry point — lets BankGuaranteeServiceImpl.create() post this as part of
  // the same atomic write as the BG row itself.
  async postBankGuaranteeIssuedTx(tx: Tx, companyId: string, bgId: string): Promise<void> {
    const bg = await tx.bankGuarantee.findFirst({ where: { id: bgId, companyId } });
    if (!bg) return;

    const date = new Date(bg.issuedDateAd);
    const dateBs = adToBs(date);
    const amount = Number(bg.amount);
    const desc = `Bank Guarantee Issued — ${bg.bgNumber} (${bg.partyName})`;

    const [assetAccount, liabilityAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.BANK_GUARANTEE_ASSET, 'ASSET'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.BANK_GUARANTEE_LIABILITY, 'LIABILITY'),
    ]);

    // DR Contingent Asset — company has a claim/security
    await tx.ledgerEntry.create({
      data: {
        companyId, accountId: assetAccount.id, dateAd: date, dateBs,
        description: desc, debit: amount, credit: 0,
        balance: Number(assetAccount.currentBalance) + amount,
        referenceType: 'BANK_GUARANTEE', referenceId: bgId, isAutoPosted: true,
      },
    });
    // CR Contingent Liability — obligation to the bank
    await tx.ledgerEntry.create({
      data: {
        companyId, accountId: liabilityAccount.id, dateAd: date, dateBs,
        description: desc, debit: 0, credit: amount,
        balance: Number(liabilityAccount.currentBalance) + amount,
        referenceType: 'BANK_GUARANTEE', referenceId: bgId, isAutoPosted: true,
      },
    });
    await tx.ledgerAccount.update({ where: { id: assetAccount.id }, data: { currentBalance: { increment: amount } } });
    await tx.ledgerAccount.update({ where: { id: liabilityAccount.id }, data: { currentBalance: { increment: amount } } });
  }

  async postBankGuaranteeClosed(companyId: string, bgId: string): Promise<void> {
    return this.prisma.$transaction((tx) => this.postBankGuaranteeClosedTx(tx, companyId, bgId));
  }

  // Nested entry point — lets BankGuaranteeServiceImpl.update() post this as part of
  // the same atomic write as the BG's own status change.
  async postBankGuaranteeClosedTx(tx: Tx, companyId: string, bgId: string): Promise<void> {
    const bg = await tx.bankGuarantee.findFirst({ where: { id: bgId, companyId } });
    if (!bg) return;

    const date = new Date();
    const dateBs = adToBs(date);
    const amount = Number(bg.amount);
    const desc = `Bank Guarantee Closed — ${bg.bgNumber} (${bg.partyName})`;

    const [assetAccount, liabilityAccount] = await Promise.all([
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.BANK_GUARANTEE_ASSET, 'ASSET'),
      this.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.BANK_GUARANTEE_LIABILITY, 'LIABILITY'),
    ]);

    // Reverse: CR Contingent Asset
    await tx.ledgerEntry.create({
      data: {
        companyId, accountId: assetAccount.id, dateAd: date, dateBs,
        description: desc, debit: 0, credit: amount,
        balance: Number(assetAccount.currentBalance) - amount,
        referenceType: 'BANK_GUARANTEE', referenceId: bgId, isAutoPosted: true,
      },
    });
    // Reverse: DR Contingent Liability
    await tx.ledgerEntry.create({
      data: {
        companyId, accountId: liabilityAccount.id, dateAd: date, dateBs,
        description: desc, debit: amount, credit: 0,
        balance: Number(liabilityAccount.currentBalance) - amount,
        referenceType: 'BANK_GUARANTEE', referenceId: bgId, isAutoPosted: true,
      },
    });
    await tx.ledgerAccount.update({ where: { id: assetAccount.id }, data: { currentBalance: { decrement: amount } } });
    await tx.ledgerAccount.update({ where: { id: liabilityAccount.id }, data: { currentBalance: { decrement: amount } } });
  }

  // ─── Manual Journal Entry ─────────────────────────────────────────────────────
  // User-entered postings from the Ledger "New Entry" / Transactions "Add to
  // Ledger" UIs. Always creates a balanced debit+credit pair in one transaction —
  // never a single-sided row — and updates both accounts' currentBalance
  // correctly according to each account's normal-balance side (debit-normal for
  // ASSET/EXPENSE, credit-normal for LIABILITY/EQUITY/INCOME).

  // Standalone entry point (Ledger "New Entry" UI) — wraps its own transaction.
  async postManualJournalEntry(
    companyId: string,
    params: { debitAccountId: string; creditAccountId: string; amount: number; dateAd: string; description?: string; referenceType?: string; referenceId?: string },
  ) {
    return this.prisma.$transaction((tx) => this.postManualJournalEntryTx(tx, companyId, params));
  }

  // Nested entry point — callers that need the posting to be part of a larger
  // atomic transaction (e.g. TransactionServiceImpl.create) pass their own `tx`.
  async postManualJournalEntryTx(
    tx: Tx,
    companyId: string,
    params: { debitAccountId: string; creditAccountId: string; amount: number; dateAd: string; description?: string; referenceType?: string; referenceId?: string },
  ) {
    const { debitAccountId, creditAccountId, amount, dateAd, description } = params;
    if (debitAccountId === creditAccountId) {
      throw new BadRequestException('Debit and credit accounts must be different');
    }
    if (!(amount > 0)) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const [debitAccount, creditAccount] = await Promise.all([
      tx.ledgerAccount.findFirst({ where: { id: debitAccountId, companyId } }),
      tx.ledgerAccount.findFirst({ where: { id: creditAccountId, companyId } }),
    ]);
    if (!debitAccount || !creditAccount) throw new BadRequestException('Account not found');

    const date = new Date(dateAd);
    const dateBs = adToBs(date);
    const referenceType = params.referenceType ?? 'MANUAL_JOURNAL';
    const referenceId = params.referenceId ?? randomUUID();
    const debitDelta = this.ledgerDelta(debitAccount.accountType, amount, 0);
    const creditDelta = this.ledgerDelta(creditAccount.accountType, 0, amount);

    const debitEntry = await tx.ledgerEntry.create({
      data: {
        companyId, accountId: debitAccount.id, dateAd: date, dateBs, description,
        debit: amount, credit: 0,
        balance: Number(debitAccount.currentBalance) + debitDelta,
        referenceType, referenceId, isAutoPosted: false,
      },
    });
    await tx.ledgerEntry.create({
      data: {
        companyId, accountId: creditAccount.id, dateAd: date, dateBs, description,
        debit: 0, credit: amount,
        balance: Number(creditAccount.currentBalance) + creditDelta,
        referenceType, referenceId, isAutoPosted: false,
      },
    });
    await tx.ledgerAccount.update({ where: { id: debitAccount.id }, data: { currentBalance: { increment: debitDelta } } });
    await tx.ledgerAccount.update({ where: { id: creditAccount.id }, data: { currentBalance: { increment: creditDelta } } });

    return debitEntry;
  }

  // Deletes a manual journal entry and its paired leg together, reversing both
  // accounts' balances — prevents the imbalance that deleting only one row would cause.
  async reverseManualJournalEntry(companyId: string, entry: { id: string; accountId: string; referenceType: string | null; referenceId: string | null }) {
    const siblings = entry.referenceType && entry.referenceId
      ? await this.prisma.ledgerEntry.findMany({ where: { companyId, referenceType: entry.referenceType, referenceId: entry.referenceId } })
      : [entry as any];

    const accounts = await this.prisma.ledgerAccount.findMany({ where: { id: { in: siblings.map((s: any) => s.accountId) } } });
    const accountById = new Map(accounts.map((a) => [a.id, a]));

    return this.prisma.$transaction([
      ...siblings.map((s: any) => this.prisma.ledgerEntry.delete({ where: { id: s.id } })),
      ...siblings.map((s: any) => {
        const acc = accountById.get(s.accountId);
        const delta = acc ? this.ledgerDelta(acc.accountType, Number(s.debit), Number(s.credit)) : 0;
        return this.prisma.ledgerAccount.update({ where: { id: s.accountId }, data: { currentBalance: { decrement: delta } } });
      }),
    ]);
  }

  // Tx-aware sibling of reverseManualJournalEntry — used when a status change
  // (e.g. a transaction going PENDING → COMPLETED, or → CANCELLED) needs to undo
  // whatever was previously posted for it as part of the SAME atomic update, not
  // as a separate standalone call. No-ops cleanly if nothing was ever posted.
  async reverseEntriesTx(tx: Tx, companyId: string, referenceType: string, referenceId: string) {
    const siblings = await tx.ledgerEntry.findMany({ where: { companyId, referenceType, referenceId } });
    if (siblings.length === 0) return;

    const accounts = await tx.ledgerAccount.findMany({ where: { id: { in: siblings.map((s) => s.accountId) } } });
    const accountById = new Map(accounts.map((a) => [a.id, a]));

    for (const s of siblings) {
      await tx.ledgerEntry.delete({ where: { id: s.id } });
      const acc = accountById.get(s.accountId);
      const delta = acc ? this.ledgerDelta(acc.accountType, Number(s.debit), Number(s.credit)) : 0;
      await tx.ledgerAccount.update({ where: { id: s.accountId }, data: { currentBalance: { decrement: delta } } });
    }
  }

  // ─── Party (vendor/customer) Running Ledger ────────────────────────────────────
  // Deliberately single-sided — NOT a balanced double-entry leg (the real
  // Cash/Bank/Payable/Receivable posting via postManualJournalEntryTx always
  // still happens separately and correctly reflects actual money movement).
  //
  // Behaves like a real running statement/passbook for that one vendor or
  // customer: Credit = an amount became outstanding (transaction is Pending —
  // "owed"), Debit = that outstanding amount got settled (transaction became
  // Completed, or a Pending amount was Cancelled). Every call ADDS a new line —
  // nothing is ever deleted or replaced — so the full history (owed, then
  // settled) stays visible, the same way a bank passbook never erases old rows.
  // See TransactionServiceImpl.sideForPartyLedgerTransition for exactly which
  // side gets posted on each status transition.
  //
  // Because these entries have no offsetting leg anywhere else in the ledger, a
  // future Trial Balance / Balance Sheet builder MUST exclude these accounts
  // (and their entries — referenceType 'TRANSACTION_MEMO') from formal totals,
  // or the books will not balance.
  async postPartyLedgerLineTx(
    tx: Tx,
    companyId: string,
    params: { partyAccountId: string; amount: number; dateAd: string; description?: string; referenceId?: string; side: 'CREDIT' | 'DEBIT' },
  ) {
    const account = await tx.ledgerAccount.findFirst({ where: { id: params.partyAccountId, companyId } });
    if (!account) return; // best-effort tracker — a bad id here must never break the real transaction

    const date = new Date(params.dateAd);
    const dateBs = adToBs(date);
    const amount = params.amount;
    const isCredit = params.side === 'CREDIT';
    const delta = this.ledgerDelta(account.accountType, isCredit ? 0 : amount, isCredit ? amount : 0);

    await tx.ledgerEntry.create({
      data: {
        companyId,
        accountId: account.id,
        dateAd: date,
        dateBs,
        description: params.description,
        debit: isCredit ? 0 : amount,
        credit: isCredit ? amount : 0,
        balance: Number(account.currentBalance) + delta,
        referenceType: 'TRANSACTION_MEMO',
        referenceId: params.referenceId,
        isAutoPosted: true,
      },
    });
    await tx.ledgerAccount.update({ where: { id: account.id }, data: { currentBalance: { increment: delta } } });
  }

  private debitNormal(accountType: string): boolean {
    return accountType === 'ASSET' || accountType === 'EXPENSE';
  }

  private ledgerDelta(accountType: string, debit: number, credit: number): number {
    const net = debit - credit;
    return this.debitNormal(accountType) ? net : -net;
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  async getOrCreateSystemAccount(companyId: string, accountName: string, accountType: string) {
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
