import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { adToBs, bsToAd } from '@easy-books/shared';

function getCurrentBsMonthRange(): { startAd: Date; endAd: Date; bsMonth: string } {
  const now = new Date();
  const bsStr = adToBs(now);
  const [bsYear, bsMonth] = bsStr.split('-').map(Number);

  const startAd = bsToAd(`${bsYear}-${String(bsMonth).padStart(2, '0')}-01`);
  const nextBsYear = bsMonth === 12 ? bsYear + 1 : bsYear;
  const nextBsMonth = bsMonth === 12 ? 1 : bsMonth + 1;
  const nextMonthStart = bsToAd(`${nextBsYear}-${String(nextBsMonth).padStart(2, '0')}-01`);
  const endAd = new Date(nextMonthStart.getTime() - 1);

  return { startAd, endAd, bsMonth: `${bsYear}-${String(bsMonth).padStart(2, '0')}` };
}

function getCurrentFiscalYearRange(): { startAd: Date; endAd: Date; fiscalYear: string } {
  const now = new Date();
  const bsStr = adToBs(now);
  const [bsYear, bsMonth] = bsStr.split('-').map(Number);

  const fyStart = bsMonth >= 4 ? bsYear : bsYear - 1;
  const fiscalYear = `${fyStart}-${String(fyStart + 1).slice(-2)}`;

  // Shrawan 1 (BS month 4, day 1) is the fiscal year start
  const startAd = bsToAd(`${fyStart}-04-01`);
  const nextFyStart = bsToAd(`${fyStart + 1}-04-01`);
  const endAd = new Date(nextFyStart.getTime() - 1);

  return { startAd, endAd, fiscalYear };
}

@Injectable()
export class DashboardServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(companyId: string) {
    const { startAd: monthStart, endAd: monthEnd, bsMonth } = getCurrentBsMonthRange();
    const { startAd: fyStart, endAd: fyEnd, fiscalYear } = getCurrentFiscalYearRange();

    const [
      monthlyRevenue,
      monthlyExpenses,
      cashPosition,
      outstandingReceivables,
      outstandingPayables,
      monthlyPayroll,
    ] = await Promise.all([
      this.getMonthlyRevenue(companyId, monthStart, monthEnd),
      this.getMonthlyExpenses(companyId, monthStart, monthEnd),
      this.getCashPosition(companyId),
      this.getOutstandingReceivables(companyId),
      this.getOutstandingPayables(companyId),
      this.getMonthlyPayroll(companyId, bsMonth),
    ]);

    return {
      period: { bsMonth, fiscalYear },
      monthlyRevenue,
      monthlyExpenses,
      netMonthlyProfit: monthlyRevenue - monthlyExpenses,
      cashPosition,
      outstandingReceivables,
      outstandingPayables,
      monthlyPayroll,
    };
  }

  async getTopClients(companyId: string, limit = 5) {
    const orders = await this.prisma.salesOrder.groupBy({
      by: ['clientId', 'clientName'],
      where: { companyId },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: limit,
    });

    return orders.map((o) => ({
      clientId: o.clientId,
      clientName: o.clientName,
      totalRevenue: Number(o._sum.totalAmount ?? 0),
    }));
  }

  async getTopVendors(companyId: string, limit = 5) {
    const orders = await this.prisma.purchaseOrder.groupBy({
      by: ['vendorId', 'vendorName'],
      where: { companyId },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: limit,
    });

    return orders.map((o) => ({
      vendorId: o.vendorId,
      vendorName: o.vendorName,
      totalExpenses: Number(o._sum.totalAmount ?? 0),
    }));
  }

  async getLowStockItems(companyId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { companyId },
      select: { id: true, itemName: true, partNumber: true, quantity: true, lowStockThreshold: true, unit: true },
      orderBy: { quantity: 'asc' },
    });
    return items
      .filter((i) => Number(i.quantity) <= Number(i.lowStockThreshold))
      .slice(0, 20);
  }

  async getPendingPayables(companyId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { companyId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
      select: {
        id: true, orderNumber: true, vendorName: true,
        totalAmount: true, paidAmount: true, dateAd: true,
      },
      orderBy: { dateAd: 'asc' },
    });
  }

  async getPendingReceivables(companyId: string) {
    return this.prisma.salesOrder.findMany({
      where: { companyId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
      select: {
        id: true, invoiceNumber: true, clientName: true,
        totalAmount: true, paidAmount: true, dateAd: true,
      },
      orderBy: { dateAd: 'asc' },
    });
  }

  // Row 3 — 6-month revenue vs expense trend
  async getSalesTrend(companyId: string) {
    const months: { label: string; startAd: Date; endAd: Date }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ label, startAd: start, endAd: end });
    }

    const results = await Promise.all(
      months.map(async ({ label, startAd, endAd }) => {
        const [rev, exp] = await Promise.all([
          this.prisma.salesOrder.aggregate({
            where: { companyId, dateAd: { gte: startAd, lte: endAd } },
            _sum: { totalAmount: true },
          }),
          this.prisma.purchaseOrder.aggregate({
            where: { companyId, dateAd: { gte: startAd, lte: endAd } },
            _sum: { totalAmount: true },
          }),
        ]);
        return {
          month: label,
          revenue: Number(rev._sum.totalAmount ?? 0),
          expenses: Number(exp._sum.totalAmount ?? 0),
        };
      }),
    );

    return results;
  }

  // Row 4 — Operational alerts
  async getOperationalAlerts(companyId: string) {
    const now = new Date();
    const bg30 = new Date(now);
    bg30.setDate(bg30.getDate() + 30);

    const chequeOverdueCutoff = new Date(now);
    chequeOverdueCutoff.setDate(chequeOverdueCutoff.getDate() - 7);

    const [lowStock, expiringBGs, overdueChequesCount] = await Promise.all([
      this.getLowStockItems(companyId),
      this.prisma.bankGuarantee.findMany({
        where: { companyId, status: 'ACTIVE', expiryDateAd: { lte: bg30 } },
        select: { id: true, bgNumber: true, partyName: true, amount: true, expiryDateAd: true },
        orderBy: { expiryDateAd: 'asc' },
      }),
      this.prisma.cheque.count({
        where: { companyId, status: 'DEPOSITED', updatedAt: { lte: chequeOverdueCutoff } },
      }),
    ]);

    return { lowStockCount: lowStock.length, lowStockItems: lowStock, expiringBGs, overdueChequesCount };
  }

  // Row 5 — HR summary
  async getHrSummary(companyId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const bsMonth = getCurrentBsMonthRange().bsMonth;

    const [presentToday, pendingLeaves, processedPayrollCount, totalActiveEmployees] = await Promise.all([
      this.prisma.attendance.count({
        where: { companyId, status: 'PRESENT', date: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.leaveRequest.count({ where: { companyId, status: 'PENDING' } }),
      this.prisma.payroll.count({ where: { companyId, month: bsMonth } }),
      this.prisma.employee.count({ where: { companyId, status: 'ACTIVE' } }),
    ]);

    return {
      presentToday,
      pendingLeaves,
      payrollProcessed: processedPayrollCount,
      payrollPending: Math.max(0, totalActiveEmployees - processedPayrollCount),
      totalActiveEmployees,
    };
  }

  // Row 6 — Recent activity
  async getRecentActivity(companyId: string) {
    const [recentSales, recentPurchases] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where: { companyId },
        select: { id: true, invoiceNumber: true, clientName: true, totalAmount: true, status: true, dateAd: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.purchaseOrder.findMany({
        where: { companyId },
        select: { id: true, orderNumber: true, vendorName: true, totalAmount: true, status: true, dateAd: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return { recentSales, recentPurchases };
  }

  // VAT summary
  async getVatSummary(companyId: string) {
    const { startAd, endAd } = getCurrentBsMonthRange();

    const [vatPayableAccount, vatReceivableAccount] = await Promise.all([
      this.prisma.ledgerAccount.findFirst({ where: { companyId, accountName: 'VAT Payable' } }),
      this.prisma.ledgerAccount.findFirst({ where: { companyId, accountName: 'VAT Receivable' } }),
    ]);

    const [collected, paid] = await Promise.all([
      vatPayableAccount
        ? this.prisma.ledgerEntry.aggregate({
            where: { companyId, accountId: vatPayableAccount.id, dateAd: { gte: startAd, lte: endAd } },
            _sum: { credit: true },
          })
        : Promise.resolve({ _sum: { credit: 0 } }),
      vatReceivableAccount
        ? this.prisma.ledgerEntry.aggregate({
            where: { companyId, accountId: vatReceivableAccount.id, dateAd: { gte: startAd, lte: endAd } },
            _sum: { debit: true },
          })
        : Promise.resolve({ _sum: { debit: 0 } }),
    ]);

    const vatCollected = Number(collected._sum.credit ?? 0);
    const vatPaid = Number(paid._sum.debit ?? 0);

    return { vatCollected, vatPaid, netVatPayable: vatCollected - vatPaid };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async getMonthlyRevenue(companyId: string, start: Date, end: Date): Promise<number> {
    const result = await this.prisma.salesOrder.aggregate({
      where: { companyId, dateAd: { gte: start, lte: end } },
      _sum: { totalAmount: true },
    });
    return Number(result._sum.totalAmount ?? 0);
  }

  private async getMonthlyExpenses(companyId: string, start: Date, end: Date): Promise<number> {
    const result = await this.prisma.purchaseOrder.aggregate({
      where: { companyId, dateAd: { gte: start, lte: end } },
      _sum: { totalAmount: true },
    });
    return Number(result._sum.totalAmount ?? 0);
  }

  private async getCashPosition(companyId: string): Promise<number> {
    const cashAccount = await this.prisma.ledgerAccount.findFirst({
      where: { companyId, accountName: 'Cash in Hand' },
      select: { currentBalance: true },
    });
    const bankAccount = await this.prisma.ledgerAccount.findFirst({
      where: { companyId, accountName: 'Bank Account' },
      select: { currentBalance: true },
    });
    return Number(cashAccount?.currentBalance ?? 0) + Number(bankAccount?.currentBalance ?? 0);
  }

  private async getOutstandingReceivables(companyId: string): Promise<number> {
    const result = await this.prisma.salesOrder.aggregate({
      where: { companyId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
      _sum: { totalAmount: true, paidAmount: true },
    });
    return Number(result._sum.totalAmount ?? 0) - Number(result._sum.paidAmount ?? 0);
  }

  private async getOutstandingPayables(companyId: string): Promise<number> {
    const result = await this.prisma.purchaseOrder.aggregate({
      where: { companyId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
      _sum: { totalAmount: true, paidAmount: true },
    });
    return Number(result._sum.totalAmount ?? 0) - Number(result._sum.paidAmount ?? 0);
  }

  private async getMonthlyPayroll(companyId: string, bsMonth: string): Promise<number> {
    const result = await this.prisma.payroll.aggregate({
      where: { companyId, month: bsMonth },
      _sum: { netSalary: true },
    });
    return Number(result._sum.netSalary ?? 0);
  }
}
