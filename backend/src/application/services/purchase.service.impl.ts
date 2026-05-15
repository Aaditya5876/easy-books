import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { LedgerPostingService } from './ledger-posting.service';
import { adToBs } from '@easy-books/shared';
import { VAT_RATE } from '../../domain/vo';

interface OrderItem {
  inventoryItemId?: string;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountPercent?: number;
}

interface CreatePurchaseOrderInput {
  companyId: string;
  vendorId?: string;
  vendorName: string;
  vendorContact?: string;
  vendorAddress?: string;
  vendorPanVat?: string;
  dateAd: string;
  isVat: boolean;
  laborCharges?: number;
  paymentMethod?: string;
  notes?: string;
  items: OrderItem[];
}

interface RecordPaymentInput {
  companyId: string;
  purchaseOrderId: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  dateAd: string;
  notes?: string;
}

@Injectable()
export class PurchaseServiceImpl {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerPosting: LedgerPostingService,
  ) {}

  async findAll(companyId: string, filters?: { status?: string; vendorId?: string }) {
    return this.prisma.purchaseOrder.findMany({
      where: {
        companyId,
        ...(filters?.status ? { status: filters.status as any } : {}),
        ...(filters?.vendorId ? { vendorId: filters.vendorId } : {}),
      },
      include: { items: true, vendor: { select: { name: true, abbreviation: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      include: { items: true, payments: true, vendor: true },
    });
    if (!order) throw new NotFoundException('Purchase order not found');
    return order;
  }

  async create(dto: CreatePurchaseOrderInput) {
    const { companyId, items, isVat, laborCharges = 0, ...rest } = dto;

    if (!items || items.length === 0) throw new BadRequestException('Order must have at least one item');

    const orderNumber = await this.generateOrderNumber(companyId);

    const { computedItems, subtotal, discountTotal } = this.computeItems(items);
    const vatAmount = isVat ? Number(((subtotal - discountTotal + laborCharges) * VAT_RATE).toFixed(2)) : 0;
    const totalAmount = Number((subtotal - discountTotal + laborCharges + vatAmount).toFixed(2));

    const dateAd = new Date(dto.dateAd);
    const dateBs = adToBs(dateAd);

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          companyId,
          orderNumber,
          dateAd,
          dateBs,
          isVat,
          laborCharges,
          discountTotal,
          subtotal,
          vatAmount,
          totalAmount,
          paidAmount: 0,
          status: 'PENDING',
          vendorId: rest.vendorId,
          vendorName: rest.vendorName,
          vendorContact: rest.vendorContact,
          vendorAddress: rest.vendorAddress,
          vendorPanVat: rest.vendorPanVat,
          paymentMethod: (rest.paymentMethod ?? 'CASH') as any,
          notes: rest.notes,
          items: { create: computedItems },
        },
        include: { items: true },
      });

      // Increase stock + update last purchase price
      for (const item of computedItems) {
        if (item.inventoryItemId) {
          await tx.inventoryItem.update({
            where: { id: item.inventoryItemId },
            data: {
              quantity: { increment: item.quantity },
              unitPurchasePrice: item.unitPrice,
            },
          });
        }
      }

      return created;
    });

    await this.ledgerPosting.postPurchaseOrder(companyId, order.id);

    return order;
  }

  async recordPayment(dto: RecordPaymentInput) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: dto.purchaseOrderId, companyId: dto.companyId },
    });
    if (!order) throw new NotFoundException('Purchase order not found');

    const newPaid = Number(order.paidAmount) + dto.amount;
    if (newPaid > Number(order.totalAmount)) {
      throw new BadRequestException('Payment exceeds order total');
    }

    const newStatus = newPaid >= Number(order.totalAmount) ? 'COMPLETED' : 'PARTIALLY_PAID';

    const payment = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          companyId: dto.companyId,
          purchaseOrderId: dto.purchaseOrderId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod as any,
          referenceNumber: dto.referenceNumber,
          dateAd: new Date(dto.dateAd),
          dateBs: adToBs(new Date(dto.dateAd)),
          notes: dto.notes,
        },
      });

      await tx.purchaseOrder.update({
        where: { id: dto.purchaseOrderId },
        data: { paidAmount: newPaid, status: newStatus as any },
      });

      return p;
    });

    await this.ledgerPosting.postPaymentMade(dto.companyId, payment.id);

    return payment;
  }

  async update(id: string, companyId: string, data: any) {
    const order = await this.prisma.purchaseOrder.findFirst({ where: { id, companyId } });
    if (!order) throw new NotFoundException('Purchase order not found');
    if (order.status === 'COMPLETED') throw new BadRequestException('Cannot edit a completed order');

    return this.prisma.purchaseOrder.update({ where: { id }, data });
  }

  async remove(id: string, companyId: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Purchase order not found');
    if (order.status === 'COMPLETED') throw new BadRequestException('Cannot delete a completed order');

    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (item.inventoryItemId) {
          await tx.inventoryItem.update({
            where: { id: item.inventoryItemId },
            data: { quantity: { decrement: Number(item.quantity) } },
          });
        }
      }
      await tx.purchaseOrder.delete({ where: { id } });
    });
  }

  private async generateOrderNumber(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { abbreviation: true, purchaseSequence: true, sequenceFiscalYear: true },
    });
    if (!company) throw new BadRequestException('Company not found');

    const todayBsStr = adToBs(new Date());
    const bsYear = parseInt(todayBsStr.split('-')[0]);
    const bsMonth = parseInt(todayBsStr.split('-')[1]);
    const fyStart = bsMonth >= 4 ? bsYear : bsYear - 1;
    const currentFiscalYear = `${fyStart}-${String(fyStart + 1).slice(-2)}`;

    const needsReset = company.sequenceFiscalYear !== currentFiscalYear;

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        purchaseSequence: needsReset ? 1 : { increment: 1 },
        sequenceFiscalYear: currentFiscalYear,
      },
      select: { abbreviation: true, purchaseSequence: true },
    });

    const abbr = (updated.abbreviation ?? 'PO').toUpperCase();
    const seq = String(updated.purchaseSequence).padStart(4, '0');

    return `${abbr}/PO/${currentFiscalYear}/${seq}`;
  }

  private computeItems(items: OrderItem[]) {
    let subtotal = 0;
    let discountTotal = 0;

    const computedItems = items.map((item) => {
      const gross = Number((item.quantity * item.unitPrice).toFixed(2));
      const discountPercent = item.discountPercent ?? 0;
      const discountAmount = Number(((gross * discountPercent) / 100).toFixed(2));
      const lineTotal = Number((gross - discountAmount).toFixed(2));

      subtotal += gross;
      discountTotal += discountAmount;

      return {
        inventoryItemId: item.inventoryItemId ?? null,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        discountPercent,
        discountAmount,
        lineTotal,
      };
    });

    return { computedItems, subtotal: Number(subtotal.toFixed(2)), discountTotal: Number(discountTotal.toFixed(2)) };
  }
}
