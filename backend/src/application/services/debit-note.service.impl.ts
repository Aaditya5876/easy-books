import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { adToBs } from '@easy-books/shared';

@Injectable()
export class DebitNoteServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.debitNote.create({
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
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: { debitNoteSequence: { increment: 1 } },
      select: { abbreviation: true, debitNoteSequence: true },
    });

    const abbr = (company.abbreviation ?? 'DN').toUpperCase();
    const seq = String(company.debitNoteSequence).padStart(4, '0');
    const bsYear = new Date().getFullYear() + 57;
    const fiscalYear = `${bsYear}-${String(bsYear + 1).slice(-2)}`;

    return `${abbr}/DN/${fiscalYear}/${seq}`;
  }
}
