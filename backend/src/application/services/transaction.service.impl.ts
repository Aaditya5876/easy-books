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
  // Pending transactions (e.g. a post-dated cheque, a credit sale awaiting collection)
  // are recorded but NOT posted to the ledger until their status becomes COMPLETED —
  // see update() below — so they don't move Cash/Bank balances before they actually clear.
  async create(dto: CreateTransactionDTO) {
    const dateAd = new Date(dto.dateAd);
    return this.prisma.$transaction(async (tx) => {
      const { debitAccountId, creditAccountId } = await this.resolveTransactionAccounts(dto);

      const transaction = await tx.transaction.create({
        data: {
          companyId: dto.companyId,
          dateAd,
          dateBs: dto.dateBs,
          type: dto.type,
          category: dto.category,
          amount: dto.amount,
          description: dto.description,
          partyName: dto.partyName,
          reference: dto.reference,
          status: dto.status,
          debitAccountId,
          creditAccountId,
        },
      });

      if (dto.status === 'COMPLETED') {
        await this.ledgerPosting.postManualJournalEntryTx(tx, dto.companyId, {
          debitAccountId,
          creditAccountId,
          amount: dto.amount,
          dateAd: dto.dateAd,
          description: dto.description || 'Transaction entry',
          referenceType: 'TRANSACTION',
          referenceId: transaction.id,
        });
      }

      return transaction;
    });
  }

  private async resolveTransactionAccounts(dto: CreateTransactionDTO) {
    if (dto.debitAccountId && dto.creditAccountId) {
      return { debitAccountId: dto.debitAccountId, creditAccountId: dto.creditAccountId };
    }

    const isIncome = dto.category === 'INCOME';
    const isCredit = dto.type === 'CREDIT';
    const paymentAccountName = dto.type === 'CASH'
      ? 'Cash in Hand'
      : dto.type === 'BANK' || dto.type === 'QR' || dto.type === 'CHEQUE'
        ? 'Bank Account'
        : 'Cash in Hand';

    const cashOrBankAccount = await this.ledgerPosting.getOrCreateSystemAccount(
      dto.companyId,
      paymentAccountName,
      'ASSET',
    );

    const salesRevenueAccount = await this.ledgerPosting.getOrCreateSystemAccount(
      dto.companyId,
      'Sales Revenue',
      'INCOME',
    );

    const purchaseExpenseAccount = await this.ledgerPosting.getOrCreateSystemAccount(
      dto.companyId,
      'Purchase Expenses',
      'EXPENSE',
    );

    const accountsReceivable = await this.ledgerPosting.getOrCreateSystemAccount(
      dto.companyId,
      'Accounts Receivable',
      'ASSET',
    );

    const accountsPayable = await this.ledgerPosting.getOrCreateSystemAccount(
      dto.companyId,
      'Accounts Payable',
      'LIABILITY',
    );

    if (isIncome) {
      if (isCredit) {
        return { debitAccountId: accountsReceivable.id, creditAccountId: salesRevenueAccount.id };
      }
      return { debitAccountId: cashOrBankAccount.id, creditAccountId: salesRevenueAccount.id };
    }

    // Expense path
    if (isCredit) {
      return { debitAccountId: purchaseExpenseAccount.id, creditAccountId: accountsPayable.id };
    }
    return { debitAccountId: purchaseExpenseAccount.id, creditAccountId: cashOrBankAccount.id };
  }

  async update(id: string, companyId: string, dto: UpdateTransactionDTO) {
    const record = await this.prisma.transaction.findFirst({ where: { id, companyId } });
    if (!record) throw new NotFoundException('Transaction not found');

    const updated = await this.prisma.transaction.update({ where: { id }, data: dto as any });

    // First time this transaction becomes COMPLETED (e.g. a pending cheque just cleared),
    // post its already-recorded debit/credit pair to the ledger now.
    const justCompleted = dto.status === 'COMPLETED' && record.status !== 'COMPLETED';
    if (justCompleted && record.debitAccountId && record.creditAccountId) {
      await this.ledgerPosting.postManualJournalEntry(companyId, {
        debitAccountId: record.debitAccountId,
        creditAccountId: record.creditAccountId,
        amount: Number(record.amount),
        dateAd: record.dateAd.toISOString(),
        description: record.description || 'Transaction entry',
        referenceType: 'TRANSACTION',
        referenceId: record.id,
      });
    }

    return updated;
  }

  async remove(id: string, companyId: string) {
    const record = await this.prisma.transaction.findFirst({ where: { id, companyId } });
    if (!record) throw new NotFoundException('Transaction not found');
    return this.prisma.transaction.delete({ where: { id } });
  }
}
