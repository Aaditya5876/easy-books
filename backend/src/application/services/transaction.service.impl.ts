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
  //
  // Status drives WHICH accounts get posted to, not WHETHER something posts:
  //  - COMPLETED: the real Cash/Bank/Payable/Receivable movement (resolveTransactionAccounts).
  //  - PENDING: no real money has moved yet, but the expectation should still be
  //    visible — so it posts to Accounts Receivable/Payable instead (resolvePendingAccounts),
  //    same as an accrual. See update() for how this gets reversed and re-posted
  //    once the real status is known.
  //  - CANCELLED: nothing posts — it never happened.
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
          partyAccountId: dto.partyAccountId,
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
      } else if (dto.status === 'PENDING') {
        const pending = await this.resolvePendingAccounts(dto.companyId, dto.category);
        await this.ledgerPosting.postManualJournalEntryTx(tx, dto.companyId, {
          debitAccountId: pending.debitAccountId,
          creditAccountId: pending.creditAccountId,
          amount: dto.amount,
          dateAd: dto.dateAd,
          description: `${dto.description || 'Transaction entry'} (pending)`,
          referenceType: 'TRANSACTION_PENDING',
          referenceId: transaction.id,
        });
      }

      // Party (vendor/customer) running ledger — a real passbook-style history,
      // not a single toggling entry. See sideForEnteringPartyLedger for the rule.
      const initialSide = sideForEnteringPartyLedger(dto.status);
      if (dto.partyAccountId && initialSide) {
        await this.ledgerPosting.postPartyLedgerLineTx(tx, dto.companyId, {
          partyAccountId: dto.partyAccountId,
          amount: dto.amount,
          dateAd: dto.dateAd,
          description: dto.description || 'Transaction entry',
          referenceId: transaction.id,
          side: initialSide,
        });
      }

      return transaction;
    });
  }

  // Always resolves to Accounts Receivable/Payable, regardless of payment method —
  // used only while a transaction is PENDING (see create()/update()), since no
  // payment method's cash/bank leg is real yet.
  private async resolvePendingAccounts(companyId: string, category: string) {
    if (category === 'INCOME') {
      const [accountsReceivable, salesRevenueAccount] = await Promise.all([
        this.ledgerPosting.getOrCreateSystemAccount(companyId, 'Accounts Receivable', 'ASSET'),
        this.ledgerPosting.getOrCreateSystemAccount(companyId, 'Sales Revenue', 'INCOME'),
      ]);
      return { debitAccountId: accountsReceivable.id, creditAccountId: salesRevenueAccount.id };
    }
    const [purchaseExpenseAccount, accountsPayable] = await Promise.all([
      this.ledgerPosting.getOrCreateSystemAccount(companyId, 'Purchase Expenses', 'EXPENSE'),
      this.ledgerPosting.getOrCreateSystemAccount(companyId, 'Accounts Payable', 'LIABILITY'),
    ]);
    return { debitAccountId: purchaseExpenseAccount.id, creditAccountId: accountsPayable.id };
  }

  // dto.debitAccountId/creditAccountId are resolved independently — either side can be
  // explicitly supplied (e.g. a specific party's ledger account from the Ledger page)
  // while the other side still falls back to the default system account below.
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

    let defaultDebitId: string;
    let defaultCreditId: string;
    if (isIncome) {
      defaultDebitId = isCredit ? accountsReceivable.id : cashOrBankAccount.id;
      defaultCreditId = salesRevenueAccount.id;
    } else {
      // Expense path
      defaultDebitId = purchaseExpenseAccount.id;
      defaultCreditId = isCredit ? accountsPayable.id : cashOrBankAccount.id;
    }

    return {
      debitAccountId: dto.debitAccountId ?? defaultDebitId,
      creditAccountId: dto.creditAccountId ?? defaultCreditId,
    };
  }

  // Wrapped in one $transaction — same reasoning as create(): if the ledger
  // posting below throws, the change must roll back with it.
  //
  // Whatever was previously posted for this transaction (a PENDING accrual
  // entry, a COMPLETED real entry, or nothing if it was CANCELLED) is reversed
  // first, then re-posted correctly for the new status AND/OR new amount. This
  // keeps every transition — PENDING→COMPLETED, PENDING→CANCELLED,
  // COMPLETED→CANCELLED, COMPLETED→PENDING, or just "the amount was wrong" —
  // consistent with a single rule instead of only handling the status change.
  //
  // Note: changing category/type post-creation is NOT handled here — that would
  // need the debit/credit *accounts* re-resolved, not just the amount reposted,
  // and there's no UI path that edits those fields today.
  // `companyId` (the param) comes from the controller's `@Query('companyId')`,
  // which the frontend's generic update() call never actually sends — it's
  // undefined in practice. That's harmless for `where` filters (Prisma omits
  // undefined there), which is why the record lookup below still works, but it
  // is NOT harmless for ledger *writes*: postManualJournalEntryTx/
  // postPartyLedgerLineTx put companyId into a `create()` payload, where Prisma
  // requires a real value. So everything below uses `record.companyId` (read
  // straight from the found row) instead of the param, once the record is found.
  async update(id: string, companyId: string, dto: UpdateTransactionDTO) {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.transaction.findFirst({ where: { id, companyId } });
      if (!record) throw new NotFoundException('Transaction not found');

      const updated = await tx.transaction.update({ where: { id }, data: dto as any });

      const statusChanged = !!dto.status && dto.status !== record.status;
      const amountChanged = dto.amount !== undefined && Number(dto.amount) !== Number(record.amount);
      const effectiveStatus = dto.status ?? record.status;

      if ((statusChanged || amountChanged) && record.debitAccountId && record.creditAccountId) {
        await this.ledgerPosting.reverseEntriesTx(tx, record.companyId, 'TRANSACTION', record.id);
        await this.ledgerPosting.reverseEntriesTx(tx, record.companyId, 'TRANSACTION_PENDING', record.id);

        if (effectiveStatus === 'COMPLETED') {
          await this.ledgerPosting.postManualJournalEntryTx(tx, record.companyId, {
            debitAccountId: record.debitAccountId,
            creditAccountId: record.creditAccountId,
            amount: Number(updated.amount),
            dateAd: updated.dateAd.toISOString(),
            description: updated.description || 'Transaction entry',
            referenceType: 'TRANSACTION',
            referenceId: record.id,
          });
        } else if (effectiveStatus === 'PENDING') {
          const pending = await this.resolvePendingAccounts(record.companyId, updated.category);
          await this.ledgerPosting.postManualJournalEntryTx(tx, record.companyId, {
            debitAccountId: pending.debitAccountId,
            creditAccountId: pending.creditAccountId,
            amount: Number(updated.amount),
            dateAd: updated.dateAd.toISOString(),
            description: `${updated.description || 'Transaction entry'} (pending)`,
            referenceType: 'TRANSACTION_PENDING',
            referenceId: record.id,
          });
        }
        // CANCELLED: nothing to re-post — already reversed above.
      }

      // Party (vendor/customer) running ledger — never deletes/replaces a prior
      // line, only ADDS a new one, so the full history stays visible (Pending's
      // Credit line stays even after a Debit line settles it, same as a real
      // passbook). On any status change, post one line whose side is whatever
      // the NEW status enters with (Credit for Pending, Debit for Completed) —
      // or, if the new status doesn't enter with a side of its own (Cancelled),
      // the side that reverses whatever the OLD status entered with. See
      // sideForPartyLedgerTransition for the full truth table.
      if (record.partyAccountId) {
        if (statusChanged) {
          const side = sideForPartyLedgerTransition(record.status, effectiveStatus);
          if (side) {
            await this.ledgerPosting.postPartyLedgerLineTx(tx, record.companyId, {
              partyAccountId: record.partyAccountId,
              amount: Number(updated.amount),
              dateAd: updated.dateAd.toISOString(),
              description: updated.description || 'Transaction entry',
              referenceId: record.id,
              side,
            });
          }
        } else if (amountChanged) {
          // Status didn't change, but the amount did — post an adjusting line
          // for just the difference, same side the current status normally
          // enters with (or the opposite side if the amount went down).
          const currentSide = sideForEnteringPartyLedger(effectiveStatus);
          if (currentSide) {
            const delta = Number(updated.amount) - Number(record.amount);
            if (Math.abs(delta) > 0.005) {
              const adjustingSide = delta > 0 ? currentSide : oppositeSide(currentSide);
              await this.ledgerPosting.postPartyLedgerLineTx(tx, record.companyId, {
                partyAccountId: record.partyAccountId,
                amount: Math.abs(delta),
                dateAd: updated.dateAd.toISOString(),
                description: `${updated.description || 'Transaction entry'} (adjustment)`,
                referenceId: record.id,
                side: adjustingSide,
              });
            }
          }
        }
      }

      return updated;
    });
  }

  // Reverses everything this transaction ever posted — the real ledger entry
  // (or its PENDING accrual), and the party memo entry — before deleting the
  // row. Without this, the Transaction disappears but Cash/Bank/AP/AR (and any
  // vendor/customer tracking) stay permanently wrong with nothing left to
  // explain why.
  async remove(id: string, companyId: string) {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.transaction.findFirst({ where: { id, companyId } });
      if (!record) throw new NotFoundException('Transaction not found');

      await this.ledgerPosting.reverseEntriesTx(tx, companyId, 'TRANSACTION', record.id);
      await this.ledgerPosting.reverseEntriesTx(tx, companyId, 'TRANSACTION_PENDING', record.id);
      await this.ledgerPosting.reverseEntriesTx(tx, companyId, 'TRANSACTION_MEMO', record.id);

      return tx.transaction.delete({ where: { id } });
    });
  }
}

type PartyLedgerSide = 'CREDIT' | 'DEBIT';

function oppositeSide(side: PartyLedgerSide): PartyLedgerSide {
  return side === 'CREDIT' ? 'DEBIT' : 'CREDIT';
}

// What a status posts to the party ledger the moment a transaction enters it:
// Pending = Credit (now outstanding/owed), Completed = Debit (now settled).
// Cancelled has no line of its own — it only ever reverses whatever came before.
function sideForEnteringPartyLedger(status: string): PartyLedgerSide | null {
  if (status === 'PENDING') return 'CREDIT';
  if (status === 'COMPLETED') return 'DEBIT';
  return null;
}

// The single line to post for a status TRANSITION, covering both directions:
//  - If the new status enters with its own side, that side wins (e.g.
//    Pending→Completed posts a Debit — which also happens to be exactly the
//    reversal Pending needed, so one line does both jobs).
//  - Otherwise (moving to Cancelled, which has no side of its own), post
//    whatever reverses the OLD status's side (e.g. Completed→Cancelled posts a
//    Credit, undoing the earlier settlement Debit).
//  - No line at all if neither status ever had a side (e.g. Cancelled→Cancelled,
//    or any change that isn't actually a status change).
function sideForPartyLedgerTransition(oldStatus: string, newStatus: string): PartyLedgerSide | null {
  const entering = sideForEnteringPartyLedger(newStatus);
  if (entering) return entering;
  const oldSide = sideForEnteringPartyLedger(oldStatus);
  return oldSide ? oppositeSide(oldSide) : null;
}
