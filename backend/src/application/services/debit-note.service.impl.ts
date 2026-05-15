import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { LedgerPostingService } from './ledger-posting.service';
import { adToBs } from '@easy-books/shared';

@Injectable()
export class DebitNoteServiceImpl {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerPosting: LedgerPostingService,
  ) {}

  async findAll(companyId: string) {
    return this.prisma.debitNote.findMany({
      where: { companyId },
      include: { vendor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, companyId: string) {
    const dn = await this.prisma.debitNote.findFirst({ where: { id, companyId } });
    if (!dn) throw new NotFoundException('Debit note not found');
    return dn;
  }

  async create(companyId: string, data: {
    vendorId?: string;
    purchaseOrderId?: string;
    dateAd: string;
    reason: string;
    amount: number;
    notes?: string;
  }) {
    const debitNoteNumber = await this.generateNumber(companyId);
    const dateAd = new Date(data.dateAd);

    const dn = await this.prisma.debitNote.create({
      data: {
        companyId,
        vendorId: data.vendorId,
        purchaseOrderId: data.purchaseOrderId,
        debitNoteNumber,
        dateAd,
        dateBs: adToBs(dateAd),
        reason: data.reason,
        amount: data.amount,
        status: 'OPEN',
        notes: data.notes,
      },
    });

    await this.ledgerPosting.postDebitNote(companyId, dn.id);
    return dn;
  }

  async apply(id: string, companyId: string) {
    const dn = await this.prisma.debitNote.findFirst({ where: { id, companyId } });
    if (!dn) throw new NotFoundException('Debit note not found');
    if (dn.status !== 'OPEN') throw new BadRequestException('Debit note is not open');

    return this.prisma.debitNote.update({ where: { id }, data: { status: 'APPLIED' } });
  }

  async close(id: string, companyId: string) {
    const dn = await this.prisma.debitNote.findFirst({ where: { id, companyId } });
    if (!dn) throw new NotFoundException('Debit note not found');

    return this.prisma.debitNote.update({ where: { id }, data: { status: 'CLOSED' } });
  }

  private async generateNumber(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { abbreviation: true, debitNoteSequence: true, sequenceFiscalYear: true },
    });
    if (!company) throw new BadRequestException('Company not found');

    const todayBs = adToBs(new Date());
    const bsYear = parseInt(todayBs.split('-')[0]);
    const bsMonth = parseInt(todayBs.split('-')[1]);
    const fyStart = bsMonth >= 4 ? bsYear : bsYear - 1;
    const currentFiscalYear = `${fyStart}-${String(fyStart + 1).slice(-2)}`;

    const needsReset = company.sequenceFiscalYear !== currentFiscalYear;

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        debitNoteSequence: needsReset ? 1 : { increment: 1 },
        sequenceFiscalYear: currentFiscalYear,
      },
      select: { abbreviation: true, debitNoteSequence: true },
    });

    const abbr = (updated.abbreviation ?? 'DN').toUpperCase();
    const seq = String(updated.debitNoteSequence).padStart(4, '0');

    return `${abbr}/DN/${currentFiscalYear}/${seq}`;
  }
}
