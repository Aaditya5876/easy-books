import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateTransactionDTO, UpdateTransactionDTO } from '@easy-books/shared';
import { LedgerPostingService } from './ledger-posting.service';

@Injectable()
export class TransactionServiceImpl {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerPosting: LedgerPostingService,
  ) {}

  async findAll(companyId: string) {
    return this.prisma.transaction.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.transaction.findFirst({ where: { id, companyId } });
  }

  // Every transaction is a balanced double-entry — the transaction row and its
  // paired ledger posting are created atomically so one can never exist without the other.
  async create(dto: CreateTransactionDTO) {
    const dateAd = new Date(dto.dateAd);
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          companyId: dto.companyId,
          dateAd,
          dateBs: dto.dateBs,
          type: dto.type,
          category: dto.category,
          amount: dto.amount,
          description: dto.description,
          reference: dto.reference,
          status: dto.status,
          debitAccountId: dto.debitAccountId,
          creditAccountId: dto.creditAccountId,
        },
      });

      await this.ledgerPosting.postManualJournalEntryTx(tx, dto.companyId, {
        debitAccountId: dto.debitAccountId,
        creditAccountId: dto.creditAccountId,
        amount: dto.amount,
        dateAd: dto.dateAd,
        description: dto.description || 'Transaction entry',
        referenceType: 'TRANSACTION',
        referenceId: transaction.id,
      });

      return transaction;
    });
  }

  async update(id: string, companyId: string, dto: UpdateTransactionDTO) {
    const record = await this.prisma.transaction.findFirst({ where: { id, companyId } });
    if (!record) throw new NotFoundException('Transaction not found');
    return this.prisma.transaction.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    const record = await this.prisma.transaction.findFirst({ where: { id, companyId } });
    if (!record) throw new NotFoundException('Transaction not found');
    return this.prisma.transaction.delete({ where: { id } });
  }
}
