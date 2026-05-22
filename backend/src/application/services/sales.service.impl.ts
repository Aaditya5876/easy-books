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

interface CreateSalesOrderInput {
  companyId: string;
  clientId?: string;
  clientName: string;
  clientContact?: string;
  clientAddress?: string;
  clientPanVat?: string;
  dateAd: string;
  isVat: boolean;
  laborCharges?: number;
  paymentMethod?: string;
  issuedBy?: string;
  notes?: string;
  items: OrderItem[];
}

interface RecordPaymentInput {
  companyId: string;
  salesOrderId: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  dateAd: string;
  notes?: string;
}

@Injectable()
export class SalesServiceImpl {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerPosting: LedgerPostingService,
  ) {}

  async findAll(companyId: string, filters?: { status?: string; clientId?: string }) {
    return this.prisma.salesOrder.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(filters?.status ? { status: filters.status as any } : {}),
        ...(filters?.clientId ? { clientId: filters.clientId } : {}),
      },
      include: { items: true, client: { select: { name: true, abbreviation: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, companyId },
      include: { items: true, payments: true, client: true },
    });
    if (!order) throw new NotFoundException('Sales order not found');
    return order;
  }

  async create(dto: CreateSalesOrderInput) {
    const { companyId, items, isVat, laborCharges = 0, ...rest } = dto;

    if (!items || items.length === 0) throw new BadRequestException('Order must have at least one item');

    // ── Validate stock availability ────────────────────────────────────────────
    await this.validateStock(companyId, items);

    // ── Generate invoice number ────────────────────────────────────────────────
    const invoiceNumber = await this.generateInvoiceNumber(companyId);

    // ── Calculate totals ──────────────────────────────────────────────────────
    const { computedItems, subtotal, discountTotal } = this.computeItems(items);
    const vatAmount = isVat ? Number(((subtotal - discountTotal + laborCharges) * VAT_RATE).toFixed(2)) : 0;
    const totalAmount = Number((subtotal - discountTotal + laborCharges + vatAmount).toFixed(2));

    const dateAd = new Date(dto.dateAd);
    const dateBs = adToBs(dateAd);

    // ── Create order + items in one transaction ────────────────────────────────
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.salesOrder.create({
        data: {
          companyId,
          invoiceNumber,
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
          clientId: rest.clientId,
          clientName: rest.clientName,
          clientContact: rest.clientContact,
          clientAddress: rest.clientAddress,
          clientPanVat: rest.clientPanVat,
          paymentMethod: (rest.paymentMethod ?? 'CASH') as any,
          issuedBy: rest.issuedBy,
          notes: rest.notes,
          items: {
            create: computedItems,
          },
        },
        include: { items: true },
      });

      // ── Deduct stock ───────────────────────────────────────────────────────
      for (const item of computedItems) {
        if (item.inventoryItemId) {
          await tx.inventoryItem.update({
            where: { id: item.inventoryItemId },
            data: { quantity: { decrement: item.quantity } },
          });
        }
      }

      return created;
    });

    // ── Auto-post to ledger (outside transaction so ledger errors don't roll back order) ──
    await this.ledgerPosting.postSalesOrder(companyId, order.id);

    return order;
  }

  async recordPayment(dto: RecordPaymentInput) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: dto.salesOrderId, companyId: dto.companyId },
    });
    if (!order) throw new NotFoundException('Sales order not found');

    const newPaid = Number(order.paidAmount) + dto.amount;
    if (newPaid > Number(order.totalAmount)) {
      throw new BadRequestException('Payment exceeds order total');
    }

    const newStatus = newPaid >= Number(order.totalAmount) ? 'COMPLETED' : 'PARTIALLY_PAID';

    const payment = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          companyId: dto.companyId,
          salesOrderId: dto.salesOrderId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod as any,
          referenceNumber: dto.referenceNumber,
          dateAd: new Date(dto.dateAd),
          dateBs: adToBs(new Date(dto.dateAd)),
          notes: dto.notes,
        },
      });

      await tx.salesOrder.update({
        where: { id: dto.salesOrderId },
        data: { paidAmount: newPaid, status: newStatus as any },
      });

      return p;
    });

    await this.ledgerPosting.postPaymentReceived(dto.companyId, payment.id);

    return payment;
  }

  async update(id: string, companyId: string, data: any) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId } });
    if (!order) throw new NotFoundException('Sales order not found');
    if (order.status === 'COMPLETED') throw new BadRequestException('Cannot edit a completed order');

    return this.prisma.salesOrder.update({ where: { id }, data });
  }

  async remove(id: string, companyId: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Sales order not found');
    if (order.status === 'COMPLETED') throw new BadRequestException('Cannot delete a completed order');

    // Restore stock and soft-delete
    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (item.inventoryItemId) {
          await tx.inventoryItem.update({
            where: { id: item.inventoryItemId },
            data: { quantity: { increment: Number(item.quantity) } },
          });
        }
      }
      await tx.salesOrder.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async generateInvoiceNumber(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { abbreviation: true, invoiceSequence: true, sequenceFiscalYear: true },
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
        invoiceSequence: needsReset ? 1 : { increment: 1 },
        sequenceFiscalYear: currentFiscalYear,
      },
      select: { abbreviation: true, invoiceSequence: true },
    });

    const abbr = (updated.abbreviation ?? 'INV').toUpperCase();
    const seq = String(updated.invoiceSequence).padStart(4, '0');

    return `${abbr}/${currentFiscalYear}/${seq}`;
  }

  private async validateStock(companyId: string, items: OrderItem[]) {
    for (const item of items) {
      if (!item.inventoryItemId) continue;
      const inv = await this.prisma.inventoryItem.findFirst({
        where: { id: item.inventoryItemId, companyId },
      });
      if (!inv) throw new NotFoundException(`Inventory item ${item.inventoryItemId} not found`);
      if (Number(inv.quantity) < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${inv.itemName ?? inv.modelNo}". Available: ${inv.quantity}, Requested: ${item.quantity}`,
        );
      }
    }
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
