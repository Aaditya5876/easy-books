import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateLedgerEntryDTO, UpdateLedgerEntryDTO } from '@easy-books/shared';
import { LedgerPostingService } from './ledger-posting.service';

@Injectable()
export class LedgerEntryServiceImpl {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerPosting: LedgerPostingService,
  ) {}

  async findAll(companyId: string) {
    return this.prisma.ledgerEntry.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.ledgerEntry.findFirst({ where: { id, companyId } });
  }

  // Always creates a balanced debit+credit pair — see LedgerPostingService.postManualJournalEntry.
  async create(dto: CreateLedgerEntryDTO) {
    return this.ledgerPosting.postManualJournalEntry(dto.companyId, {
      debitAccountId: dto.debitAccountId,
      creditAccountId: dto.creditAccountId,
      amount: dto.amount,
      dateAd: dto.dateAd,
      description: dto.description,
    });
  }

  async update(id: string, companyId: string, dto: UpdateLedgerEntryDTO) {
    const entry = await this.prisma.ledgerEntry.findFirst({ where: { id, companyId } });
    if (!entry) throw new NotFoundException('Ledger entry not found');
    if (entry.isAutoPosted) {
      throw new BadRequestException('Auto-posted ledger entries cannot be edited manually');
    }

    return this.prisma.ledgerEntry.update({
      where: { id },
      data: {
        description: dto.description,
        ...(dto.dateAd ? { dateAd: new Date(dto.dateAd) } : {}),
      },
    });
  }

  // Deletes both legs of the manual pair together and reverses both account balances.
  async remove(id: string, companyId: string) {
    const entry = await this.prisma.ledgerEntry.findFirst({ where: { id, companyId } });
    if (!entry) throw new NotFoundException('Ledger entry not found');
    if (entry.isAutoPosted) {
      throw new BadRequestException('Auto-posted ledger entries cannot be deleted manually');
    }
    return this.ledgerPosting.reverseManualJournalEntry(companyId, entry);
  }
}
