import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { adToBs, defaultCostBehavior } from '@easy-books/shared';
import { getCurrentFiscalYearRange } from './dashboard.service.impl';

// Purchases post to these EXPENSE/INCOME system accounts (LedgerPostingService).
// "Total Expenses" leaves them out so a purchase isn't counted twice — it
// already shows as "Total Purchase".
const PURCHASE_ACCOUNTS = new Set(['Purchase Expenses', 'Purchase Returns']);
const QUOTATION_REMARKS = ['QUOTED', 'WORK_DONE', 'CANCELLED', 'REVISED', 'BILLED'] as const;
const AGING_BUCKETS = [
  { label: '0-30', max: 30 },
  { label: '31-90', max: 90 },
  { label: '91-180', max: 180 },
  { label: '180+', max: Infinity },
];

const n = (v: unknown) => Number(v ?? 0);
const round = (v: number) => Math.round(v * 100) / 100;
const bsMonth = (d: Date) => adToBs(d).slice(0, 7);
const dayStart = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

// Everything the dashboard shows, computed server-side from real records in
// one call — the page used to re-derive it in the browser from guessed field
// names and showed zeros. Same response for business and school companies.
@Injectable()
export class DashboardOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { businessType: true } });
    if (!company) throw new NotFoundException('Company not found');
    const isSchool = company.businessType === 'SCHOOL';
    const { startAd, endAd, fiscalYear } = getCurrentFiscalYearRange();
    const fy = { gte: startAd, lte: endAd };
    const today = dayStart();

    const [
      sales, purchases, outstandingSales, outstandingPurchases, accounts, banks, inventory,
      salesItems, purchaseItems, quotations, tasks, txns, pendingTxns, cheques, feeCollection, feeOutstanding,
    ] = await Promise.all([
      this.prisma.salesOrder.findMany({ where: { companyId, deletedAt: null, dateAd: fy }, select: { dateAd: true, totalAmount: true } }),
      this.prisma.purchaseOrder.findMany({ where: { companyId, deletedAt: null, dateAd: fy }, select: { dateAd: true, totalAmount: true } }),
      this.prisma.salesOrder.aggregate({ where: { companyId, deletedAt: null, status: { in: ['PENDING', 'PARTIALLY_PAID'] } }, _sum: { totalAmount: true, paidAmount: true } }),
      this.prisma.purchaseOrder.aggregate({ where: { companyId, deletedAt: null, status: { in: ['PENDING', 'PARTIALLY_PAID'] } }, _sum: { totalAmount: true, paidAmount: true } }),
      this.prisma.ledgerAccount.findMany({
        where: { companyId, accountType: { in: ['INCOME', 'EXPENSE', 'ASSET'] } },
        select: { id: true, accountName: true, accountType: true, costBehavior: true, contactId: true, currentBalance: true },
      }),
      this.prisma.bankAccount.findMany({ where: { companyId }, select: { id: true, bankName: true, accountNumber: true, paymentType: true, currentBalance: true }, orderBy: { bankName: 'asc' } }),
      this.prisma.inventoryItem.findMany({
        where: { companyId, deletedAt: null },
        select: { id: true, itemName: true, partNumber: true, quantity: true, unit: true, unitPurchasePrice: true, unitSellingPrice: true, lowStockThreshold: true, createdAt: true },
      }),
      this.prisma.salesOrderItem.findMany({
        where: { salesOrder: { companyId, deletedAt: null, dateAd: fy } },
        select: { inventoryItemId: true, description: true, quantity: true, lineTotal: true, salesOrder: { select: { dateAd: true } } },
      }),
      this.prisma.purchaseOrderItem.findMany({
        where: { purchaseOrder: { companyId, deletedAt: null } },
        select: { inventoryItemId: true, quantity: true, lineTotal: true, purchaseOrder: { select: { dateAd: true } } },
      }),
      this.prisma.quotation.findMany({ where: { companyId, dateAd: fy }, select: { remark: true, totalAmount: true } }),
      this.prisma.task.findMany({
        where: { companyId, deletedAt: null },
        select: {
          id: true, taskNumber: true, title: true, workflowType: true, status: true, priority: true, dueDate: true, dueTime: true,
          assignedTo: true, assignedName: true, assignedContact: true, department: true, partyName: true,
        },
      }),
      this.prisma.transaction.findMany({ where: { companyId, status: 'COMPLETED', dateAd: fy }, select: { dateAd: true, category: true, amount: true } }),
      this.prisma.transaction.findMany({
        where: { companyId, status: 'PENDING', type: { in: ['CHEQUE', 'CREDIT'] } },
        select: { id: true, type: true, category: true, amount: true, partyName: true, reference: true, description: true, dateAd: true, createdAt: true, bankAccount: { select: { bankName: true } } },
        orderBy: { dateAd: 'asc' },
      }),
      this.prisma.cheque.findMany({
        where: { companyId, status: { in: ['ISSUED', 'DEPOSITED'] } },
        select: { id: true, chequeNumber: true, partyName: true, amount: true, dateAd: true, createdAt: true, isReceivable: true, status: true, notes: true, bankAccount: { select: { bankName: true } } },
        orderBy: { dateAd: 'asc' },
      }),
      isSchool
        ? this.prisma.feePayment.aggregate({ where: { companyId, status: 'CONFIRMED', paidAt: fy }, _sum: { amount: true } })
        : null,
      isSchool
        ? this.prisma.feeInvoice.aggregate({ where: { companyId, status: { in: ['PENDING', 'PARTIAL'] } }, _sum: { totalAmount: true, paidAmount: true } })
        : null,
    ]);

    // ── Ledger: income, expenses (fixed/variable), cash ────────────────────
    // Party (client/vendor) accounts carry memo-only lines; leave them out.
    const incomeAccts = accounts.filter((a) => a.accountType === 'INCOME' && !a.contactId);
    const expenseAccts = accounts.filter((a) => a.accountType === 'EXPENSE' && !a.contactId);
    const operatingExpenseIds = expenseAccts.filter((a) => !PURCHASE_ACCOUNTS.has(a.accountName)).map((a) => a.id);
    const plIds = [...incomeAccts, ...expenseAccts].map((a) => a.id);
    const plEntries = plIds.length
      ? await this.prisma.ledgerEntry.findMany({
          where: { companyId, accountId: { in: plIds }, dateAd: fy },
          select: { accountId: true, dateAd: true, debit: true, credit: true },
        })
      : [];
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const operating = new Set(operatingExpenseIds);

    let income = 0, allExpenses = 0, totalExpenses = 0, fixed = 0, variable = 0, expenseCount = 0;
    const expenseByAccount = new Map<string, number>();
    const monthly = new Map<string, { month: string; sales: number; purchase: number; expenses: number; inflow: number; outflow: number; stockPurchased: number; stockSold: number }>();
    const month = (d: Date) => {
      const key = bsMonth(d);
      if (!monthly.has(key)) monthly.set(key, { month: key, sales: 0, purchase: 0, expenses: 0, inflow: 0, outflow: 0, stockPurchased: 0, stockSold: 0 });
      return monthly.get(key)!;
    };

    for (const e of plEntries) {
      const acct = accountById.get(e.accountId)!;
      if (acct.accountType === 'INCOME') { income += n(e.credit) - n(e.debit); continue; }
      const amount = n(e.debit) - n(e.credit);
      allExpenses += amount;
      if (!operating.has(e.accountId)) continue;
      totalExpenses += amount;
      if (n(e.debit) > 0) expenseCount++;
      month(e.dateAd).expenses += amount;
      expenseByAccount.set(acct.accountName, (expenseByAccount.get(acct.accountName) ?? 0) + amount);
      if ((acct.costBehavior ?? defaultCostBehavior(acct.accountName)) === 'FIXED') fixed += amount;
      else variable += amount;
    }

    const cashAccount = accounts.find((a) => a.accountType === 'ASSET' && a.accountName === 'Cash in Hand');

    // ── Sales / purchases / cash flow by BS month ──────────────────────────
    for (const s of sales) month(s.dateAd).sales += n(s.totalAmount);
    for (const p of purchases) month(p.dateAd).purchase += n(p.totalAmount);
    let inflow = 0, outflow = 0;
    for (const t of txns) {
      if (t.category === 'INCOME') { inflow += n(t.amount); month(t.dateAd).inflow += n(t.amount); }
      if (t.category === 'EXPENSE') { outflow += n(t.amount); month(t.dateAd).outflow += n(t.amount); }
    }

    // ── Inventory ──────────────────────────────────────────────────────────
    const itemById = new Map(inventory.map((i) => [i.id, i]));
    const lowStock = inventory.filter((i) => n(i.quantity) > 0 && n(i.quantity) <= n(i.lowStockThreshold));
    const outOfStock = inventory.filter((i) => n(i.quantity) <= 0);
    const itemName = (i: { itemName: string | null; partNumber: string | null }) => i.itemName || i.partNumber || 'Unnamed item';

    const selling = new Map<string, { name: string; quantity: number; amount: number }>();
    let soldValueFY = 0;
    for (const si of salesItems) {
      const stocked = si.inventoryItemId ? itemById.get(si.inventoryItemId) : undefined;
      if (si.inventoryItemId) {
        soldValueFY += n(si.lineTotal);
        month(si.salesOrder.dateAd).stockSold += n(si.lineTotal);
      }
      const key = si.inventoryItemId ?? `desc:${si.description.trim().toLowerCase()}`;
      const row = selling.get(key) ?? { name: stocked ? itemName(stocked) : si.description, quantity: 0, amount: 0 };
      row.quantity += n(si.quantity);
      row.amount += n(si.lineTotal);
      selling.set(key, row);
    }

    const lastPurchase = new Map<string, Date>();
    for (const pi of purchaseItems) {
      if (!pi.inventoryItemId) continue;
      const d = pi.purchaseOrder.dateAd;
      if (d >= startAd && d <= endAd) month(d).stockPurchased += n(pi.lineTotal);
      const prev = lastPurchase.get(pi.inventoryItemId);
      if (!prev || d > prev) lastPurchase.set(pi.inventoryItemId, d);
    }
    // Age = days since the item was last bought in (or created, if never bought).
    const aging = AGING_BUCKETS.map((b) => ({ label: b.label, count: 0, value: 0 }));
    for (const i of inventory) {
      if (n(i.quantity) <= 0) continue;
      const since = lastPurchase.get(i.id) ?? i.createdAt;
      const days = Math.floor((today.getTime() - dayStart(since).getTime()) / 86_400_000);
      const idx = AGING_BUCKETS.findIndex((b) => days <= b.max);
      aging[idx].count++;
      aging[idx].value += n(i.quantity) * n(i.unitPurchasePrice);
    }

    // ── Quotations by remark ───────────────────────────────────────────────
    const byRemark = Object.fromEntries(QUOTATION_REMARKS.map((r) => [r, { count: 0, amount: 0 }])) as Record<string, { count: number; amount: number }>;
    for (const q of quotations) {
      const bucket = byRemark[q.remark] ?? (byRemark[q.remark] = { count: 0, amount: 0 });
      bucket.count++;
      bucket.amount = round(bucket.amount + n(q.totalAmount));
    }

    // ── Tasks ──────────────────────────────────────────────────────────────
    const open = (t: { status: string }) => t.status === 'PENDING' || t.status === 'IN_PROGRESS';
    const isOverdue = (t: { status: string; dueDate: Date | null }) => open(t) && !!t.dueDate && t.dueDate < today;
    const byDue = (a: { dueDate: Date | null }, b: { dueDate: Date | null }) =>
      (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity);
    const active = tasks.filter(open).sort(byDue).slice(0, 25).map((t) => ({ ...t, overdue: isOverdue(t) }));
    const appointments = tasks
      .filter((t) => t.workflowType === 'APPOINTMENT' && open(t) && t.dueDate && t.dueDate >= today)
      .sort(byDue)
      .slice(0, 10);

    // ── Cheque reminders (transactions awaiting clearance + cheque register) ─
    const endOfToday = new Date(today.getTime() + 86_400_000 - 1);
    const reminder = (r: {
      id: string; source: string; kind: string; receivable: boolean; partyName: string | null; chequeNumber: string | null;
      amount: unknown; chequeDate: Date; issuedDate: Date; bankName: string | null; description: string | null;
    }) => ({
      id: r.id,
      source: r.source,
      kind: r.kind,
      partyName: r.partyName,
      // Who wrote the cheque: the party for money coming in, our bank for money going out.
      issuedBy: r.receivable ? r.partyName : r.bankName,
      chequeNumber: r.chequeNumber,
      amount: n(r.amount),
      chequeDate: r.chequeDate,
      issuedDate: r.issuedDate,
      bankName: r.bankName,
      description: r.description,
      isPostDated: dayStart(r.chequeDate) > dayStart(r.issuedDate),
      isDue: r.chequeDate <= endOfToday,
    });
    const reminders = [
      ...pendingTxns.map((t) => ({
        receivable: t.category === 'INCOME',
        row: reminder({
          id: t.id, source: 'transaction', kind: t.type, receivable: t.category === 'INCOME', partyName: t.partyName,
          chequeNumber: t.reference, amount: t.amount, chequeDate: t.dateAd, issuedDate: t.createdAt,
          bankName: t.bankAccount?.bankName ?? null, description: t.description,
        }),
      })),
      ...cheques.map((c) => ({
        receivable: c.isReceivable,
        row: reminder({
          id: c.id, source: 'cheque', kind: 'CHEQUE', receivable: c.isReceivable, partyName: c.partyName,
          chequeNumber: c.chequeNumber, amount: c.amount, chequeDate: c.dateAd, issuedDate: c.createdAt,
          bankName: c.bankAccount?.bankName ?? null, description: c.notes,
        }),
      })),
    ].sort((a, b) => a.row.chequeDate.getTime() - b.row.chequeDate.getTime());

    const totalSales = sales.reduce((s, r) => s + n(r.totalAmount), 0);
    const totalPurchase = purchases.reduce((s, r) => s + n(r.totalAmount), 0);
    const receivable = n(outstandingSales._sum.totalAmount) - n(outstandingSales._sum.paidAmount)
      + (feeOutstanding ? n(feeOutstanding._sum.totalAmount) - n(feeOutstanding._sum.paidAmount) : 0);
    const payable = n(outstandingPurchases._sum.totalAmount) - n(outstandingPurchases._sum.paidAmount);

    return {
      fiscalYear,
      isSchool,
      kpis: {
        totalSales: round(totalSales),
        totalPurchase: round(totalPurchase),
        totalExpenses: round(totalExpenses),
        ...(isSchool ? { feeCollection: round(n(feeCollection?._sum.amount)) } : {}),
      },
      profitLoss: { income: round(income), expenses: round(allExpenses), netProfit: round(income - allExpenses) },
      expenseSplit: {
        fixed: round(fixed),
        variable: round(variable),
        byAccount: [...expenseByAccount.entries()]
          .map(([name, amount]) => ({ name, amount: round(amount) }))
          .filter((r) => r.amount !== 0)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10),
      },
      cashInHand: round(n(cashAccount?.currentBalance)),
      bank: {
        total: round(banks.reduce((s, b) => s + n(b.currentBalance), 0)),
        accounts: banks.map((b) => ({ ...b, currentBalance: n(b.currentBalance) })),
      },
      ledgerSummary: {
        receivable: round(receivable),
        payable: round(payable),
        salesCount: sales.length,
        purchaseCount: purchases.length,
        expenseCount,
        incomeAccounts: incomeAccts.length,
        expenseAccounts: expenseAccts.length,
      },
      monthly: [...monthly.values()]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, typeof v === 'number' ? round(v) : v]))),
      inventory: {
        totalItems: inventory.length,
        lowStockCount: lowStock.length,
        outOfStockCount: outOfStock.length,
        lowStockItems: lowStock.slice(0, 10).map((i) => ({ id: i.id, name: itemName(i), quantity: n(i.quantity), unit: i.unit, threshold: n(i.lowStockThreshold) })),
        outOfStockItems: outOfStock.slice(0, 10).map((i) => ({ id: i.id, name: itemName(i), unit: i.unit })),
        stockValue: round(inventory.reduce((s, i) => s + Math.max(0, n(i.quantity)) * n(i.unitSellingPrice), 0)),
        stockCostValue: round(inventory.reduce((s, i) => s + Math.max(0, n(i.quantity)) * n(i.unitPurchasePrice), 0)),
        soldValueFY: round(soldValueFY),
        topSelling: [...selling.values()]
          .sort((a, b) => b.quantity - a.quantity || b.amount - a.amount)
          .slice(0, 10)
          .map((r) => ({ ...r, amount: round(r.amount) })),
        aging: aging.map((a) => ({ ...a, value: round(a.value) })),
      },
      quotations: {
        total: quotations.length,
        totalAmount: round(quotations.reduce((s, q) => s + n(q.totalAmount), 0)),
        byRemark,
      },
      tasks: {
        total: tasks.length,
        completed: tasks.filter((t) => t.status === 'COMPLETED').length,
        inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
        incomplete: tasks.filter((t) => t.status === 'PENDING').length,
        cancelled: tasks.filter((t) => t.status === 'CANCELLED').length,
        overdue: tasks.filter(isOverdue).length,
        active,
        appointments,
      },
      cashFlow: { inflow: round(inflow), outflow: round(outflow) },
      cheques: {
        receivable: reminders.filter((r) => r.receivable).map((r) => r.row),
        payable: reminders.filter((r) => !r.receivable).map((r) => r.row),
      },
    };
  }
}
