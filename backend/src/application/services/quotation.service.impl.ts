import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
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

  async create(dto: CreateQuotationDTO) {
    const subtotal = dto.items.reduce((sum, item) => {
      const gross = Number(item.quantity) * Number(item.unitPrice);
      const discount = Number(item.discountPercent ?? 0);
      return sum + Number((gross * (1 - discount / 100)).toFixed(2));
    }, 0);
    const discountTotal = dto.items.reduce((sum, item) => {
      const gross = Number(item.quantity) * Number(item.unitPrice);
      const discount = Number(item.discountPercent ?? 0);
      return sum + Number(((gross * discount) / 100).toFixed(2));
    }, 0);
    const laborCharges = Number((dto as any).laborCharges ?? 0);
    const taxableAmount = subtotal - discountTotal + laborCharges;
    const isVat = (dto as any).isVat ?? false;
    const vatAmount = isVat ? Number((taxableAmount * VAT_RATE).toFixed(2)) : 0;
    const totalAmount = Number((taxableAmount + vatAmount).toFixed(2));
    const dateAd = new Date(dto.dateAd);
    return this.prisma.quotation.create({
      data: { ...dto, subtotal, discountTotal, vatAmount, totalAmount, dateAd } as any,
    });
  }

  async update(id: string, companyId: string, dto: UpdateQuotationDTO) {
    const existing = await this.prisma.quotation.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Quotation not found');
    return this.prisma.quotation.update({ where: { id }, data: dto as any });
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
          clientName: quotation.clientName,
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

      // Deduct stock for inventory items
      for (const item of computedItems) {
        if (item.inventoryItemId) {
          await tx.inventoryItem.update({
            where: { id: item.inventoryItemId },
            data: { quantity: { decrement: item.quantity } },
          });
        }
      }

      // Mark quotation as converted
      await tx.quotation.update({
        where: { id },
        data: { status: 'CONVERTED', remark: 'BILLED' },
      });

      return order;
    });

    await this.ledgerPosting.postSalesOrder(companyId, salesOrder.id);
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
