import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { adToBs } from '@easy-books/shared';

@Injectable()
export class PaymentServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findBySalesOrder(salesOrderId: string, companyId: string) {
    return this.prisma.payment.findMany({ where: { salesOrderId, companyId }, orderBy: { dateAd: 'asc' } });
  }

  async findByPurchaseOrder(purchaseOrderId: string, companyId: string) {
    return this.prisma.payment.findMany({ where: { purchaseOrderId, companyId }, orderBy: { dateAd: 'asc' } });
  }

  async findAll(companyId: string) {
    return this.prisma.payment.findMany({
      where: { companyId },
      include: {
        salesOrder: { select: { invoiceNumber: true, clientName: true } },
        purchaseOrder: { select: { orderNumber: true, vendorName: true } },
      },
      orderBy: { dateAd: 'desc' },
    });
  }

  async findById(id: string, companyId: string) {
    const p = await this.prisma.payment.findFirst({ where: { id, companyId } });
    if (!p) throw new NotFoundException('Payment not found');
    return p;
  }
}
