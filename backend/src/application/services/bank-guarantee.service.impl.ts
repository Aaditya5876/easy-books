import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { LedgerPostingService } from './ledger-posting.service';
import { adToBs } from '@easy-books/shared';

@Injectable()
export class BankGuaranteeServiceImpl {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerPosting: LedgerPostingService,
  ) {}

  async findAll(companyId: string, filters?: { status?: string }) {
    return this.prisma.bankGuarantee.findMany({
      where: {
        companyId,
        ...(filters?.status ? { status: filters.status as any } : {}),
      },
      orderBy: { expiryDateAd: 'asc' },
    });
  }

  async findById(id: string, companyId: string) {
    const bg = await this.prisma.bankGuarantee.findFirst({ where: { id, companyId } });
    if (!bg) throw new NotFoundException('Bank guarantee not found');
    return bg;
  }

  async create(companyId: string, data: {
    bgNumber: string;
    partyName: string;
    bankName: string;
    amount: number;
    issuedDateAd: string;
    expiryDateAd: string;
    purpose?: string;
    notes?: string;
  }) {
    const issuedDate = new Date(data.issuedDateAd);
    const expiryDate = new Date(data.expiryDateAd);

    const bg = await this.prisma.bankGuarantee.create({
      data: {
        companyId,
        bgNumber: data.bgNumber,
        partyName: data.partyName,
        bankName: data.bankName,
        amount: data.amount,
        issuedDateAd: issuedDate,
        issuedDateBs: adToBs(issuedDate),
        expiryDateAd: expiryDate,
        expiryDateBs: adToBs(expiryDate),
        purpose: data.purpose,
        notes: data.notes,
        status: 'ACTIVE',
      },
    });

    await this.ledgerPosting.postBankGuaranteeIssued(companyId, bg.id);
    return bg;
  }

  async update(id: string, companyId: string, data: { status?: string; notes?: string }) {
    const bg = await this.prisma.bankGuarantee.findFirst({ where: { id, companyId } });
    if (!bg) throw new NotFoundException('Bank guarantee not found');

    const updated = await this.prisma.bankGuarantee.update({ where: { id }, data: data as any });

    // Reverse GL entries when BG is closed or expired
    if (data.status && ['EXPIRED', 'CANCELLED', 'INVOKED'].includes(data.status) && bg.status === 'ACTIVE') {
      await this.ledgerPosting.postBankGuaranteeClosed(companyId, id);
    }

    return updated;
  }

  async findExpiringSoon(companyId: string, withinDays: number = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);

    return this.prisma.bankGuarantee.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        expiryDateAd: { lte: cutoff },
      },
      orderBy: { expiryDateAd: 'asc' },
    });
  }
}
