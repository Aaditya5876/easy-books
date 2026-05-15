import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { LedgerPostingService } from './ledger-posting.service';
import { adToBs } from '@easy-books/shared';

@Injectable()
export class CreditNoteServiceImpl {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerPosting: LedgerPostingService,
  ) {}

  async findAll(companyId: string) {
    return this.prisma.creditNote.findMany({
      where: { companyId },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, companyId: string) {
    const cn = await this.prisma.creditNote.findFirst({ where: { id, companyId } });
    if (!cn) throw new NotFoundException('Credit note not found');
    return cn;
  }

  async create(companyId: string, data: {
    clientId?: string;
    salesOrderId?: string;
    dateAd: string;
    reason: string;
    amount: number;
    notes?: string;
  }) {
    const creditNoteNumber = await this.generateNumber(companyId);
    const dateAd = new Date(data.dateAd);

    const cn = await this.prisma.creditNote.create({
      data: {
        companyId,
        clientId: data.clientId,
        salesOrderId: data.salesOrderId,
        creditNoteNumber,
        dateAd,
        dateBs: adToBs(dateAd),
        reason: data.reason,
        amount: data.amount,
        status: 'OPEN',
        notes: data.notes,
      },
    });

    await this.ledgerPosting.postCreditNote(companyId, cn.id);
    return cn;
  }

  async apply(id: string, companyId: string) {
    const cn = await this.prisma.creditNote.findFirst({ where: { id, companyId } });
    if (!cn) throw new NotFoundException('Credit note not found');
    if (cn.status !== 'OPEN') throw new BadRequestException('Credit note is not open');

    return this.prisma.creditNote.update({ where: { id }, data: { status: 'APPLIED' } });
  }

  async close(id: string, companyId: string) {
    const cn = await this.prisma.creditNote.findFirst({ where: { id, companyId } });
    if (!cn) throw new NotFoundException('Credit note not found');

    return this.prisma.creditNote.update({ where: { id }, data: { status: 'CLOSED' } });
  }

  private async generateNumber(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { abbreviation: true, creditNoteSequence: true, sequenceFiscalYear: true },
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
        creditNoteSequence: needsReset ? 1 : { increment: 1 },
        sequenceFiscalYear: currentFiscalYear,
      },
      select: { abbreviation: true, creditNoteSequence: true },
    });

    const abbr = (updated.abbreviation ?? 'CN').toUpperCase();
    const seq = String(updated.creditNoteSequence).padStart(4, '0');

    return `${abbr}/CN/${currentFiscalYear}/${seq}`;
  }
}
