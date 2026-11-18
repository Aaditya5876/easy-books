import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { assertTaskLink } from '../../../core/utils/task-link';
import { LedgerPostingService } from './ledger-posting.service';
import { adToBs } from '@easy-books/shared';
import { VAT_RATE } from '../../domain/vo';
import { billAttachmentUrls } from '../../../core/utils/bill-attachments';
import { Prisma } from '@prisma/client';
import { BillPayment, assertWithinDue, billStatus, parseBillPayment, parseDate, parsePayNow, payNowAmount } from '../../../core/utils/bill-payment';
import { resolveVendorTx } from '../../../core/utils/bill-party';
import { createBillJobTx } from '../../../core/utils/task-number';

interface OrderItem {
  inventoryItemId?: string;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountPercent?: number;
}

interface CreatePurchaseOrderInput {
  taskId?: string | null;
  companyId: string;
  vendorId?: string;
  vendorName: string;
  vendorContact?: string;
  vendorAddress?: string;
  vendorPanVat?: string;
  dateAd: string;
  isVat: boolean;
  laborCharges?: number;
  notes?: string;
  items: OrderItem[];
  attachments?: unknown; // [{ url }] from /api/v1/upload — see core/utils/bill-attachments.ts
  // Paid on the spot? Missing = udharo. See core/utils/bill-payment.ts (parsePayNow).
  payment?: unknown;
  // "Also create a workflow job" — a job filled from this bill, saved with it.
  createJob?: boolean;
}

interface RecordPaymentInput extends Record<string, unknown> {
  companyId: string;
  purchaseOrderId: string;
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
        deletedAt: null,
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
    if (dto.createJob && rest.taskId) throw new BadRequestException('Link an existing job or create a new one — not both');
    const payNow = parsePayNow(dto.payment);
    const dateAd = parseDate(dto.dateAd, 'Bill date');
    await assertTaskLink(this.prisma, companyId, rest.taskId);
    const attachmentUrls = billAttachmentUrls(companyId, dto.attachments);

    const { computedItems, subtotal, discountTotal } = this.computeItems(items);

    // Item ids come straight from the request — confirm every referenced
    // inventory item actually belongs to this company before stock/price
    // gets mutated against it (mirrors sales.service.impl.ts's validateStock).
    const inventoryItemIds = [...new Set(computedItems.map(i => i.inventoryItemId).filter((v): v is string => !!v))];
    if (inventoryItemIds.length) {
      const owned = await this.prisma.inventoryItem.count({ where: { id: { in: inventoryItemIds }, companyId } });
      if (owned !== inventoryItemIds.length) throw new BadRequestException('One or more items do not belong to this company');
    }

    const vatAmount = isVat ? Number(((subtotal - discountTotal + laborCharges) * VAT_RATE).toFixed(2)) : 0;
    const totalAmount = Number((subtotal - discountTotal + laborCharges + vatAmount).toFixed(2));
    const paidNow = payNowAmount(payNow, totalAmount); // refuses paying more than the bill
    const dateBs = adToBs(dateAd);

    const orderNumber = await this.generateOrderNumber(companyId);

    return this.prisma.$transaction(async (tx) => {
      const vendor = await resolveVendorTx(tx, companyId, {
        id: rest.vendorId, name: rest.vendorName, contact: rest.vendorContact, address: rest.vendorAddress, panVat: rest.vendorPanVat,
      });
      const taskId = dto.createJob
        ? await createBillJobTx(tx, companyId, {
            kind: 'PURCHASE', number: orderNumber, partyType: 'VENDOR', partyId: vendor.id, partyName: vendor.name,
            partyContact: rest.vendorContact, items: computedItems, totalAmount,
          })
        : rest.taskId;

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
          taskId,
          vendorId: vendor.id,
          vendorName: vendor.name,
          vendorContact: rest.vendorContact,
          vendorAddress: rest.vendorAddress,
          vendorPanVat: rest.vendorPanVat,
          paymentMethod: payNow.type === 'CREDIT' ? 'CREDIT' : payNow.paymentMethod,
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

      if (attachmentUrls.length) {
        await tx.memoDocument.create({
          data: {
            companyId, category: 'purchase_bill', referenceId: created.id, dateAd, dateBs,
            title: `Purchase Bill - ${created.vendorName} - ${orderNumber}`,
            vendorName: created.vendorName, vendorContact: created.vendorContact,
            documentUrl: attachmentUrls[0], attachments: attachmentUrls,
          },
        });
      }

      // Ledger in the same transaction — all or nothing with the purchase:
      // DR Purchases / CR Accounts Payable, then (if paid now) DR Accounts Payable / CR Cash|Bank.
      await this.ledgerPosting.postPurchaseOrder(companyId, created.id, tx);
      if (payNow.type !== 'CREDIT' && paidNow > 0) {
        await this.applyPaymentTx(tx, companyId, created.id, {
          amount: paidNow, paymentMethod: payNow.paymentMethod, dateAd, referenceNumber: payNow.referenceNumber,
        });
      }

      return tx.purchaseOrder.findUniqueOrThrow({ where: { id: created.id }, include: { items: true, payments: true } });
    }, { timeout: 15000 });
  }

  async recordPayment(dto: RecordPaymentInput) {
    const payment = parseBillPayment(dto);
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: dto.purchaseOrderId, companyId: dto.companyId, deletedAt: null },
    });
    if (!order) throw new NotFoundException('Purchase order not found');
    // Early, friendly check; the authoritative one is inside the transaction.
    assertWithinDue(Number(order.paidAmount), payment.amount, Number(order.totalAmount));

    return this.prisma.$transaction((tx) => this.applyPaymentTx(tx, dto.companyId, order.id, payment));
  }

  // Adds a payment to a bill: Paid goes up, the status follows the money, and
  // the ledger gets DR Accounts Payable / CR Cash (or Bank).
  private async applyPaymentTx(tx: Prisma.TransactionClient, companyId: string, purchaseOrderId: string, payment: BillPayment) {
    // Increment under the row lock, then check — racing payments can't
    // both slip under the total (see SalesServiceImpl.applyPaymentTx).
    const after = await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { paidAmount: { increment: payment.amount } },
      select: { paidAmount: true, totalAmount: true },
    });
    const paid = Number(after.paidAmount);
    const total = Number(after.totalAmount);
    assertWithinDue(paid - payment.amount, payment.amount, total);
    await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: billStatus(paid, total) } });

    const p = await tx.payment.create({
      data: {
        companyId,
        purchaseOrderId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        referenceNumber: payment.referenceNumber,
        dateAd: payment.dateAd,
        dateBs: adToBs(payment.dateAd),
        notes: payment.notes,
      },
    });

    await this.ledgerPosting.postPaymentMade(companyId, p.id, tx);
    return p;
  }

  async update(id: string, companyId: string, data: any) {
    const order = await this.prisma.purchaseOrder.findFirst({ where: { id, companyId } });
    if (!order) throw new NotFoundException('Purchase order not found');
    if (order.status === 'COMPLETED') throw new BadRequestException('Cannot edit a completed order');

    // Only descriptive fields are editable: totals, paidAmount and status are
    // derived from items and recorded payments, never taken from the request.
    const edit: any = {};
    for (const k of ['vendorName', 'vendorContact', 'vendorAddress', 'vendorPanVat', 'notes']) {
      if (data?.[k] !== undefined) edit[k] = data[k];
    }
    if (data?.vendorId !== undefined) {
      if (data.vendorId) {
        const vendor = await this.prisma.vendor.findFirst({ where: { id: data.vendorId, companyId, deletedAt: null }, select: { id: true } });
        if (!vendor) throw new BadRequestException('Vendor not found in this company');
      }
      edit.vendorId = data.vendorId || null;
    }
    if (data?.dateAd) {
      edit.dateAd = new Date(data.dateAd);
      edit.dateBs = adToBs(edit.dateAd);
    }
    return this.prisma.purchaseOrder.update({ where: { id }, data: edit });
  }

  async remove(id: string, companyId: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Purchase order not found');
    if (['COMPLETED', 'PARTIALLY_PAID'].includes(order.status)) {
      throw new BadRequestException('Cannot delete an order that has payments recorded');
    }

    // Reverse stock, take its ledger entries back out, and soft-delete
    await this.prisma.$transaction(async (tx) => {
      await this.ledgerPosting.reverseEntriesTx(tx, companyId, 'PURCHASE_ORDER', id);
      for (const item of order.items) {
        if (item.inventoryItemId) {
          await tx.inventoryItem.update({
            where: { id: item.inventoryItemId },
            data: { quantity: { decrement: Number(item.quantity) } },
          });
        }
      }
      await tx.purchaseOrder.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  private async generateOrderNumber(companyId: string): Promise<string> {
    const todayBsStr = adToBs(new Date());
    const bsYear = parseInt(todayBsStr.split('-')[0]);
    const bsMonth = parseInt(todayBsStr.split('-')[1]);
    const fyStart = bsMonth >= 4 ? bsYear : bsYear - 1;
    const currentFiscalYear = `${fyStart}-${String(fyStart + 1).slice(-2)}`;

    const updated = await (this.prisma.$transaction as any)(async (tx: any) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { abbreviation: true, purchaseSequence: true, sequenceFiscalYear: true },
      });
      if (!company) throw new BadRequestException('Company not found');
      const needsReset = company.sequenceFiscalYear !== currentFiscalYear;
      return tx.company.update({
        where: { id: companyId },
        data: {
          purchaseSequence: needsReset ? 1 : { increment: 1 },
          sequenceFiscalYear: currentFiscalYear,
        },
        select: { abbreviation: true, purchaseSequence: true },
      });
    }, { isolationLevel: 'Serializable' });

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
