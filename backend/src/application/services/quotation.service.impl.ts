import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { assertTaskLink } from '../../../core/utils/task-link';
import { LedgerPostingService } from './ledger-posting.service';
import { CreateQuotationDTO, UpdateQuotationDTO, adToBs } from '@easy-books/shared';
import { VAT_RATE } from '../../domain/vo';

@Injectable()
export class QuotationServiceImpl {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerPosting: LedgerPostingService,
  ) {}

  async findAll(companyId: string) {
    return this.prisma.quotation.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    const q = await this.prisma.quotation.findFirst({ where: { id, companyId } });
    if (!q) throw new NotFoundException('Quotation not found');
    return q;
  }

  // Totals are always computed here — never trusted from the client.
  // subtotal = gross of the lines; discountTotal is taken off once (the same
  // shape as sales orders, so a converted bill posts the right amounts).
  private computeTotals(
    items: Array<{ quantity: unknown; unitPrice: unknown; discountPercent?: unknown }>,
    laborCharges: number,
    isVat: boolean,
  ) {
    const round = (v: number) => Number(v.toFixed(2));
    let subtotal = 0;
    let discountTotal = 0;
    for (const item of items) {
      const gross = Number(item.quantity) * Number(item.unitPrice);
      subtotal += round(gross);
      discountTotal += round((gross * Number(item.discountPercent ?? 0)) / 100);
    }
    const taxable = subtotal - discountTotal + laborCharges;
    const vatAmount = isVat ? round(taxable * VAT_RATE) : 0;
    return { subtotal: round(subtotal), discountTotal: round(discountTotal), laborCharges: round(laborCharges), vatAmount, totalAmount: round(taxable + vatAmount) };
  }

  // Labour lines are the source of laborCharges when the form sends them.
  private laborFrom(dto: { laborItems?: { amount: number }[] | null; laborCharges?: number | null }, fallback = 0) {
    if (Array.isArray(dto.laborItems)) return dto.laborItems.reduce((s, l) => s + Number(l.amount || 0), 0);
    if (dto.laborCharges != null) return Number(dto.laborCharges);
    return fallback;
  }

  private dates(dto: { dateAd?: string; validUntil?: string | null }) {
    const out: Record<string, Date | null> = {};
    if (dto.dateAd) out.dateAd = new Date(dto.dateAd);
    if (dto.validUntil !== undefined) out.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    return out;
  }

  async create(dto: CreateQuotationDTO) {
    await assertTaskLink(this.prisma, dto.companyId, dto.taskId);
    if (dto.status && dto.status !== 'ACTIVE') throw new BadRequestException('A new quotation starts ACTIVE');
    const totals = this.computeTotals(dto.items, this.laborFrom(dto), !!dto.isVat);
    const { totalAmount: _clientTotal, ...rest } = dto;
    return this.prisma.quotation.create({
      data: { ...rest, ...totals, ...this.dates(dto), status: 'ACTIVE' } as any,
    });
  }

  async update(id: string, companyId: string, dto: UpdateQuotationDTO) {
    const existing = await this.prisma.quotation.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Quotation not found');
    await assertTaskLink(this.prisma, companyId, dto.taskId);

    const moneyKeys = ['items', 'isVat', 'laborCharges', 'laborItems'] as const;
    const changesMoney = moneyKeys.some((k) => dto[k] !== undefined);
    if (existing.status === 'CONVERTED' && (changesMoney || (dto.status && dto.status !== 'CONVERTED'))) {
      throw new BadRequestException('This quotation is already billed — its items and status can no longer change');
    }
    // CONVERTED is set only by convertToSalesOrder (it creates the bill).
    if (dto.status === 'CONVERTED' && existing.status !== 'CONVERTED') {
      throw new BadRequestException('Use "To Sale" to convert a quotation');
    }

    const { totalAmount: _t, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest, ...this.dates(dto) };
    if (changesMoney) {
      const items = (dto.items ?? (existing.items as any[]) ?? []) as any[];
      const labor = this.laborFrom(dto, Number(existing.laborCharges));
      Object.assign(data, this.computeTotals(items, labor, dto.isVat ?? existing.isVat));
    }
    return this.prisma.quotation.update({ where: { id }, data: data as any });
  }

  async remove(id: string, companyId: string) {
    const existing = await this.prisma.quotation.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Quotation not found');
    return this.prisma.quotation.delete({ where: { id } });
  }

  async convertToSalesOrder(id: string, companyId: string) {
    const quotation = await this.prisma.quotation.findFirst({ where: { id, companyId } });
    if (!quotation) throw new NotFoundException('Quotation not found');
    if (quotation.status === 'CONVERTED') throw new BadRequestException('Quotation already converted');
    if (quotation.status === 'EXPIRED') throw new BadRequestException('Cannot convert an expired quotation');

    // Generate invoice number using same fiscal-year-aware logic
    const invoiceNumber = await this.generateInvoiceNumber(companyId);

    // Parse quotation items (stored as JSON array)
    const rawItems = Array.isArray(quotation.items) ? quotation.items : [];
    const items = rawItems as Array<{
      description?: string;
      quantity?: number;
      unit?: string;
      unitPrice?: number;
      discountPercent?: number;
      inventoryItemId?: string;
    }>;

    if (items.length === 0) throw new BadRequestException('Quotation has no items to convert');

    // Item ids are read out of a JSON blob set at quotation-create time, not
    // re-validated since — confirm every referenced item still belongs to
    // this company before any stock gets decremented against it.
    const inventoryItemIds = [...new Set(items.map(i => i.inventoryItemId).filter((v): v is string => !!v))];
    if (inventoryItemIds.length) {
      const owned = await this.prisma.inventoryItem.count({ where: { id: { in: inventoryItemIds }, companyId } });
      if (owned !== inventoryItemIds.length) throw new BadRequestException('Quotation references an inventory item that no longer belongs to this company');
    }

    // Recompute line totals from quotation items
    const computedItems = items.map((item) => {
      const quantity = Number(item.quantity ?? 1);
      const unitPrice = Number(item.unitPrice ?? 0);
      const discountPercent = Number(item.discountPercent ?? 0);
      const gross = quantity * unitPrice;
      const discountAmount = Number(((gross * discountPercent) / 100).toFixed(2));
      const lineTotal = Number((gross - discountAmount).toFixed(2));
      return {
        inventoryItemId: item.inventoryItemId ?? null,
        description: item.description ?? '',
        quantity,
        unit: item.unit ?? null,
        unitPrice,
        discountPercent,
        discountAmount,
        lineTotal,
      };
    });

    const dateAd = new Date();
    const dateBs = adToBs(dateAd);

    const salesOrder = await this.prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.create({
        data: {
          companyId,
          clientId: quotation.clientId,
          // The bill stays on the same Workflow job as its quotation.
          taskId: quotation.taskId,
          clientName: quotation.clientName,
          clientContact: quotation.clientContact,
          clientAddress: quotation.clientAddress,
          clientPanVat: quotation.clientPanVat,
          paymentMethod: quotation.paymentMethod ?? 'CASH',
          invoiceNumber,
          dateAd,
          dateBs,
          isVat: quotation.isVat,
          laborCharges: quotation.laborCharges,
          discountTotal: quotation.discountTotal,
          subtotal: quotation.subtotal,
          vatAmount: quotation.vatAmount,
          totalAmount: quotation.totalAmount,
          paidAmount: 0,
          status: 'PENDING',
          notes: `Converted from Quotation #${quotation.quotationNumber}`,
          items: { create: computedItems },
        },
        include: { items: true },
      });

      // Claim the quotation: only one of several simultaneous "To Sale"
      // clicks can move it ACTIVE → CONVERTED; the others roll back.
      const claimed = await tx.quotation.updateMany({
        where: { id, companyId, status: 'ACTIVE' },
        data: { status: 'CONVERTED', remark: 'BILLED' },
      });
      if (claimed.count === 0) throw new BadRequestException('Quotation already converted');

      // Deduct stock (never below zero).
      for (const item of computedItems) {
        if (item.inventoryItemId) {
          const taken = await tx.inventoryItem.updateMany({
            where: { id: item.inventoryItemId, companyId, quantity: { gte: item.quantity } },
            data: { quantity: { decrement: item.quantity } },
          });
          if (taken.count === 0) throw new BadRequestException(`Not enough stock for "${item.description}"`);
        }
      }

      // Ledger in the same transaction — all or nothing with the bill.
      await this.ledgerPosting.postSalesOrder(companyId, order.id, tx);
      return order;
    });

    return salesOrder;
  }

  private async generateInvoiceNumber(companyId: string): Promise<string> {
    const todayBs = adToBs(new Date());
    const bsYear = parseInt(todayBs.split('-')[0]);
    const bsMonth = parseInt(todayBs.split('-')[1]);
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
}
