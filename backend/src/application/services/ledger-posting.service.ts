import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { adToBs } from '@easy-books/shared';

@Injectable()
export class LedgerPostingService {
  constructor(private readonly prisma: PrismaService) {}

  async postSalesOrder(companyId: string, salesOrderId: string) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id: salesOrderId, companyId } });
    if (!order) return;

    const salesAccount = await this.getOrCreateAccount(companyId, 'Sales Revenue', 'SALES');
    const date = new Date(order.dateAd);

    await this.prisma.$transaction([
      this.prisma.ledgerEntry.create({
        data: {
          companyId,
          accountId: salesAccount.id,
          dateAd: date,
          dateBs: adToBs(date),
          description: `Sales Invoice #${order.invoiceNumber} — ${order.clientName}`,
          debit: 0,
          credit: Number(order.totalAmount),
          balance: Number(salesAccount.currentBalance) + Number(order.totalAmount),
          referenceType: 'SALES_ORDER',
          referenceId: salesOrderId,
        },
      }),
      this.prisma.ledgerAccount.update({
        where: { id: salesAccount.id },
        data: { currentBalance: { increment: Number(order.totalAmount) } },
      }),
    ]);
  }

  async postPurchaseOrder(companyId: string, purchaseOrderId: string) {
    const order = await this.prisma.purchaseOrder.findFirst({ where: { id: purchaseOrderId, companyId } });
    if (!order) return;

    const purchaseAccount = await this.getOrCreateAccount(companyId, 'Purchase Expenses', 'PURCHASE');
    const date = new Date(order.dateAd);

    await this.prisma.$transaction([
      this.prisma.ledgerEntry.create({
        data: {
          companyId,
          accountId: purchaseAccount.id,
          dateAd: date,
          dateBs: adToBs(date),
          description: `Purchase Order #${order.orderNumber} — ${order.vendorName}`,
          debit: Number(order.totalAmount),
          credit: 0,
          balance: Number(purchaseAccount.currentBalance) + Number(order.totalAmount),
          referenceType: 'PURCHASE_ORDER',
          referenceId: purchaseOrderId,
        },
      }),
      this.prisma.ledgerAccount.update({
        where: { id: purchaseAccount.id },
        data: { currentBalance: { increment: Number(order.totalAmount) } },
      }),
    ]);
  }

  private async getOrCreateAccount(companyId: string, accountName: string, accountType: string) {
    const existing = await this.prisma.ledgerAccount.findFirst({
      where: { companyId, accountName },
    });
    if (existing) return existing;

    return this.prisma.ledgerAccount.create({
      data: { companyId, accountName, accountType: accountType as any, openingBalance: 0, currentBalance: 0 },
    });
  }
}
