import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { assertTaskLink } from '../../../core/utils/task-link';
import { LedgerPostingService } from './ledger-posting.service';
import { adToBs } from '@easy-books/shared';
import { VAT_RATE } from '../../domain/vo';
import { billAttachmentUrls } from '../../../core/utils/bill-attachments';
import { BillPayment, assertWithinDue, billStatus, parseBillPayment, parseDate, parsePayNow, payNowAmount } from '../../../core/utils/bill-payment';
import { resolveClientTx } from '../../../core/utils/bill-party';
import { createBillJobTx } from '../../../core/utils/task-number';

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
  issuedBy?: string;
  notes?: string;
  attachments?: unknown; // [{ url }] from /api/v1/upload — see core/utils/bill-attachments.ts
  items: OrderItem[];
  // Received on the spot? Missing = udharo. See core/utils/bill-payment.ts (parsePayNow).
  payment?: unknown;
  // "Also create a workflow job" — a job filled from this bill, saved with it.
  createJob?: boolean;
}

interface RecordPaymentInput extends Record<string, unknown> {
  companyId: string;
  salesOrderId: string;
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

  // `inTx` runs inside the bill's own transaction, after the ledger posting —
  // callers that must change something together with the bill (closing a
  // Space) do it there, so both happen or neither does.
  async create(dto: CreateSalesOrderInput, inTx?: (tx: Prisma.TransactionClient, order: { id: string; totalAmount: unknown }) => Promise<void>) {
    const { companyId, items, isVat, laborCharges = 0, ...rest } = dto;

    if (!items || items.length === 0) throw new BadRequestException('Order must have at least one item');
    if (dto.createJob && rest.taskId) throw new BadRequestException('Link an existing job or create a new one — not both');
    const payNow = parsePayNow(dto.payment);
    const dateAd = parseDate(dto.dateAd, 'Bill date');
    await assertTaskLink(this.prisma, companyId, rest.taskId);

    // ── Validate stock availability ────────────────────────────────────────────
    await this.validateStock(companyId, items);
    const attachmentUrls = billAttachmentUrls(companyId, dto.attachments);

    // ── Calculate totals ──────────────────────────────────────────────────────
    const { computedItems, subtotal, discountTotal } = this.computeItems(items);
    const vatAmount = isVat ? Number(((subtotal - discountTotal + laborCharges) * VAT_RATE).toFixed(2)) : 0;
    const totalAmount = Number((subtotal - discountTotal + laborCharges + vatAmount).toFixed(2));
    const receivedNow = payNowAmount(payNow, totalAmount); // refuses receiving more than the bill
    const dateBs = adToBs(dateAd);

    // ── Generate invoice number ────────────────────────────────────────────────
    const invoiceNumber = await this.generateInvoiceNumber(companyId);

    // ── Create order + items in one transaction ────────────────────────────────
    const order = await this.prisma.$transaction(async (tx) => {
      // Anyone who still owes us must be a tracked client; a fully paid
      // walk-in sale doesn't create one.
      const client = await resolveClientTx(tx, companyId, {
        id: rest.clientId, name: rest.clientName, contact: rest.clientContact, address: rest.clientAddress, panVat: rest.clientPanVat,
      }, receivedNow < totalAmount - 0.005);
      const taskId = dto.createJob
        ? await createBillJobTx(tx, companyId, {
            kind: 'SALE', number: invoiceNumber, partyType: 'CLIENT', partyId: client.id, partyName: client.name,
            partyContact: rest.clientContact, items: computedItems, totalAmount,
          })
        : rest.taskId;

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
          taskId,
          clientId: client.id,
          clientName: client.name,
          clientContact: rest.clientContact,
          clientAddress: rest.clientAddress,
          clientPanVat: rest.clientPanVat,
          paymentMethod: payNow.type === 'CREDIT' ? 'CREDIT' : payNow.paymentMethod,
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
      // DR Accounts Receivable / CR Sales, then (if received now) DR Cash|Bank / CR Accounts Receivable.
      await this.ledgerPosting.postSalesOrder(companyId, created.id, tx);
      if (payNow.type !== 'CREDIT' && receivedNow > 0) {
        await this.applyPaymentTx(tx, companyId, created.id, {
          amount: receivedNow, paymentMethod: payNow.paymentMethod, dateAd, referenceNumber: payNow.referenceNumber,
        });
      }
      if (inTx) await inTx(tx, created);

      return tx.salesOrder.findUniqueOrThrow({ where: { id: created.id }, include: { items: true, payments: true } });
    }, { timeout: 15000 });

    return order;
  }

  async recordPayment(dto: RecordPaymentInput) {
    const payment = parseBillPayment(dto);
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: dto.salesOrderId, companyId: dto.companyId, deletedAt: null },
    });
    if (!order) throw new NotFoundException('Sales order not found');
    // Early, friendly check; the authoritative one is inside the transaction.
    assertWithinDue(Number(order.paidAmount), payment.amount, Number(order.totalAmount));

    return this.prisma.$transaction((tx) => this.applyPaymentTx(tx, dto.companyId, order.id, payment));
  }

  // Adds a received payment to a bill: Paid goes up, the status follows the
  // money, and the ledger gets DR Cash (or Bank) / CR Accounts Receivable.
  private async applyPaymentTx(tx: Prisma.TransactionClient, companyId: string, salesOrderId: string, payment: BillPayment) {
    // Increment (not "set to what I read"): the row stays locked until this
    // transaction ends, so a racing payment waits and then sees this one.
    const after = await tx.salesOrder.update({
      where: { id: salesOrderId },
      data: { paidAmount: { increment: payment.amount } },
      select: { paidAmount: true, totalAmount: true },
    });
    const paid = Number(after.paidAmount);
    const total = Number(after.totalAmount);
    assertWithinDue(paid - payment.amount, payment.amount, total);
    await tx.salesOrder.update({ where: { id: salesOrderId }, data: { status: billStatus(paid, total) } });

    const p = await tx.payment.create({
      data: {
        companyId,
        salesOrderId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        referenceNumber: payment.referenceNumber,
        dateAd: payment.dateAd,
        dateBs: adToBs(payment.dateAd),
        notes: payment.notes,
      },
    });

    await this.ledgerPosting.postPaymentReceived(companyId, p.id, tx);
    return p;
  }

  async update(id: string, companyId: string, data: any) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId } });
    if (!order) throw new NotFoundException('Sales order not found');
    if (order.status === 'COMPLETED') throw new BadRequestException('Cannot edit a completed order');

    // Only descriptive fields are editable: totals, paidAmount and status are
    // derived from items and recorded payments, never taken from the request.
    const edit: any = {};
    for (const k of ['clientName', 'clientContact', 'clientAddress', 'clientPanVat', 'notes']) {
      if (data?.[k] !== undefined) edit[k] = data[k];
    }
    if (data?.clientId !== undefined) {
      if (data.clientId) {
        const client = await this.prisma.client.findFirst({ where: { id: data.clientId, companyId, deletedAt: null }, select: { id: true } });
        if (!client) throw new BadRequestException('Client not found in this company');
      }
      edit.clientId = data.clientId || null;
    }
    if (data?.dateAd) {
      edit.dateAd = new Date(data.dateAd);
      edit.dateBs = adToBs(edit.dateAd);
    }
    // The bill's ledger entries follow its date and party name (money can't
    // change here, so nothing else in the ledger needs to). Payments keep
    // their own dates.
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.salesOrder.update({ where: { id }, data: edit });
      if (edit.dateAd) {
        await tx.ledgerEntry.updateMany({
          where: { companyId, referenceType: 'SALES_ORDER', referenceId: id },
          data: { dateAd: edit.dateAd, dateBs: edit.dateBs },
        });
      }
      if (edit.clientName !== undefined && edit.clientName !== order.clientName) {
        await tx.ledgerEntry.updateMany({
          where: { companyId, referenceType: 'SALES_ORDER', referenceId: id, description: `Sales Invoice #${order.invoiceNumber} — ${order.clientName}` },
          data: { description: `Sales Invoice #${order.invoiceNumber} — ${updated.clientName}` },
        });
      }
      return updated;
    });
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

    // Restore stock, take its ledger entries back out, and soft-delete
    await this.prisma.$transaction(async (tx) => {
      await this.ledgerPosting.reverseEntriesTx(tx, companyId, 'SALES_ORDER', id);
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
