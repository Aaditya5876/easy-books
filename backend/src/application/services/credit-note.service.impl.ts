import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { adToBs } from '@easy-books/shared';

@Injectable()
export class CreditNoteServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.creditNote.create({
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
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: { creditNoteSequence: { increment: 1 } },
      select: { abbreviation: true, creditNoteSequence: true },
    });

    const abbr = (company.abbreviation ?? 'CN').toUpperCase();
    const seq = String(company.creditNoteSequence).padStart(4, '0');
    const bsYear = new Date().getFullYear() + 57;
    const fiscalYear = `${bsYear}-${String(bsYear + 1).slice(-2)}`;

    return `${abbr}/CN/${fiscalYear}/${seq}`;
  }
}
