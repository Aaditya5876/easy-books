import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { assertTaskLink } from '../../../core/utils/task-link';
import { LedgerPostingService } from './ledger-posting.service';
import { adToBs } from '@easy-books/shared';
import { VAT_RATE } from '../../domain/vo';
import { billAttachmentUrls } from '../../../core/utils/bill-attachments';

interface OrderItem {
  inventoryItemId?: string;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountPercent?: number;
}

interface CreateSalesOrderInput {
  taskId?: string | null;
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
  attachments?: unknown; // [{ url }] from /api/v1/upload — see core/utils/bill-attachments.ts
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
    await assertTaskLink(this.prisma, companyId, rest.taskId);

    // ── Validate stock availability ────────────────────────────────────────────
    await this.validateStock(companyId, items);
    const attachmentUrls = billAttachmentUrls(companyId, dto.attachments);

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
          taskId: rest.taskId,
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
      // Conditional decrement: two sales racing for the last units can't both
      // pass the earlier check and drive stock negative.
      for (const item of computedItems) {
        if (item.inventoryItemId) {
          const taken = await tx.inventoryItem.updateMany({
            where: { id: item.inventoryItemId, companyId, quantity: { gte: item.quantity } },
            data: { quantity: { decrement: item.quantity } },
          });
          if (taken.count === 0) throw new BadRequestException(`Not enough stock for "${item.description}"`);
        }
      }

      if (attachmentUrls.length) {
        await tx.memoDocument.create({
          data: {
            companyId, category: 'sales_bill', referenceId: created.id, dateAd, dateBs,
            title: `Sales Bill - ${created.clientName} - ${invoiceNumber}`,
            clientName: created.clientName, clientContact: created.clientContact, clientAddress: created.clientAddress,
            documentUrl: attachmentUrls[0], attachments: attachmentUrls,
          },
        });
      }

      // Ledger in the same transaction: a bill without its ledger entries (or
      // entries without a bill) can never be left behind.
      await this.ledgerPosting.postSalesOrder(companyId, created.id, tx);

      return created;
    });

    return order;
  }

  async recordPayment(dto: RecordPaymentInput) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: dto.salesOrderId, companyId: dto.companyId },
    });
    if (!order) throw new NotFoundException('Sales order not found');
    // Early, friendly check; the authoritative one is inside the transaction.
    if (Number(order.paidAmount) + dto.amount > Number(order.totalAmount) + 0.005) {
      throw new BadRequestException('Payment exceeds order total');
    }

    return this.prisma.$transaction(async (tx) => {
      // Increment (not "set to what I read"): the row stays locked until this
      // transaction ends, so a racing payment waits and then sees this one.
      const after = await tx.salesOrder.update({
        where: { id: dto.salesOrderId },
        data: { paidAmount: { increment: dto.amount } },
        select: { paidAmount: true, totalAmount: true },
      });
      const paid = Number(after.paidAmount);
      const total = Number(after.totalAmount);
      if (paid > total + 0.005) throw new BadRequestException('Payment exceeds order total');
      await tx.salesOrder.update({
        where: { id: dto.salesOrderId },
        data: { status: (paid >= total - 0.005 ? 'COMPLETED' : 'PARTIALLY_PAID') as any },
      });

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

      await this.ledgerPosting.postPaymentReceived(dto.companyId, p.id, tx);
      return p;
    });
  }

  async update(id: string, companyId: string, data: any) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId } });
    if (!order) throw new NotFoundException('Sales order not found');
    if (order.status === 'COMPLETED') throw new BadRequestException('Cannot edit a completed order');

    // Only descriptive fields are editable: totals, paidAmount and status are
    // derived from items and recorded payments, never taken from the request.
    const edit: any = {};
    for (const k of ['clientId', 'clientName', 'clientContact', 'clientAddress', 'clientPanVat', 'paymentMethod', 'notes']) {
      if (data?.[k] !== undefined) edit[k] = data[k];
    }
    if (data?.dateAd) {
      edit.dateAd = new Date(data.dateAd);
      edit.dateBs = adToBs(edit.dateAd);
    }
    return this.prisma.salesOrder.update({ where: { id }, data: edit });
  }

  async remove(id: string, companyId: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Sales order not found');
    if (['COMPLETED', 'PARTIALLY_PAID'].includes(order.status)) {
      throw new BadRequestException('Cannot delete an order that has payments recorded');
    }

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
    const todayBsStr = adToBs(new Date());
    const bsYear = parseInt(todayBsStr.split('-')[0]);
    const bsMonth = parseInt(todayBsStr.split('-')[1]);
    const fyStart = bsMonth >= 4 ? bsYear : bsYear - 1;
    const currentFiscalYear = `${fyStart}-${String(fyStart + 1).slice(-2)}`;

    const updated = await (this.prisma.$transaction as any)(async (tx: any) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { abbreviation: true, invoiceSequence: true, sequenceFiscalYear: true },
      });
      if (!company) throw new BadRequestException('Company not found');
      const needsReset = company.sequenceFiscalYear !== currentFiscalYear;
      return tx.company.update({
        where: { id: companyId },
        data: {
          invoiceSequence: needsReset ? 1 : { increment: 1 },
          sequenceFiscalYear: currentFiscalYear,
        },
        select: { abbreviation: true, invoiceSequence: true },
      });
    }, { isolationLevel: 'Serializable' });

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
