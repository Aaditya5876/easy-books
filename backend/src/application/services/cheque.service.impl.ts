import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { LedgerPostingService } from './ledger-posting.service';
import { TransactionServiceImpl } from './transaction.service.impl';
import { adToBs } from '@easy-books/shared';

@Injectable()
export class ChequeServiceImpl {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerPosting: LedgerPostingService,
    private readonly transactionService: TransactionServiceImpl,
  ) {}

  async findAll(companyId: string, filters?: { status?: string; isReceivable?: boolean }) {
    return this.prisma.cheque.findMany({
      where: {
        companyId,
        ...(filters?.status ? { status: filters.status as any } : {}),
        ...(filters?.isReceivable !== undefined ? { isReceivable: filters.isReceivable } : {}),
      },
      include: { bankAccount: { select: { bankName: true, accountNumber: true } } },
      orderBy: { dateAd: 'desc' },
    });
  }

  async findById(id: string, companyId: string) {
    const cheque = await this.prisma.cheque.findFirst({ where: { id, companyId } });
    if (!cheque) throw new NotFoundException('Cheque not found');
    return cheque;
  }

  async create(companyId: string, data: {
    chequeNumber: string;
    partyName: string;
    amount: number;
    dateAd: string;
    isReceivable: boolean;
    bankAccountId?: string;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
  }) {
    const dateAd = new Date(data.dateAd);
    return this.prisma.cheque.create({
      data: {
        companyId,
        chequeNumber: data.chequeNumber,
        partyName: data.partyName,
        amount: data.amount,
        dateAd,
        dateBs: adToBs(dateAd),
        isReceivable: data.isReceivable,
        bankAccountId: data.bankAccountId,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        notes: data.notes,
        status: 'ISSUED',
      },
    });
  }

  async updateStatus(id: string, companyId: string, status: string, notes?: string) {
    const cheque = await this.prisma.cheque.findFirst({ where: { id, companyId } });
    if (!cheque) throw new NotFoundException('Cheque not found');

    const validTransitions: Record<string, string[]> = {
      ISSUED: ['DEPOSITED', 'CANCELLED'],
      DEPOSITED: ['CLEARED', 'BOUNCED'],
      BOUNCED: ['DEPOSITED', 'CANCELLED'],
    };

    if (!validTransitions[cheque.status]?.includes(status)) {
      throw new BadRequestException(`Cannot transition cheque from ${cheque.status} to ${status}`);
    }

    const chequeUpdateData = {
      status: status as any,
      ...(status === 'CLEARED' ? { clearedAt: new Date() } : {}),
      ...(notes ? { notes } : {}),
    };
    const isLinkedToTransaction = cheque.referenceType === 'TRANSACTION' && !!cheque.referenceId;

    if (!isLinkedToTransaction) {
      // Standalone cheque (no linked Transaction) — the status change and its
      // ledger posting must succeed or fail together, same as any other atomic
      // fix in this codebase: a thrown ledger error must not leave the cheque
      // stuck as "Cleared" with nothing posted.
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.cheque.update({ where: { id }, data: chequeUpdateData });
        if (status === 'CLEARED') {
          await this.ledgerPosting.postChequeClearedTx(tx, companyId, id);
        }
        return updated;
      });
    }

    // Linked to a Transaction — the Transaction's own status is the source of
    // truth for ledger postings (TransactionServiceImpl.update() is atomic on
    // its own), so the cheque row itself is just a status label here.
    const updated = await this.prisma.cheque.update({ where: { id }, data: chequeUpdateData });

    if (status === 'CLEARED') {
      try {
        // Go through TransactionServiceImpl.update() (not a raw prisma write) so the
        // COMPLETED transition actually posts its ledger entry.
        await this.transactionService.update(cheque.referenceId!, companyId, { status: 'COMPLETED' });
      } catch (e) {
        // ignore if transaction not found — still attempt cheque ledger posting
        await this.ledgerPosting.postChequeCleared(companyId, id);
      }
    }

    if (status === 'CANCELLED' || status === 'BOUNCED') {
      const txStatus = status === 'CANCELLED' ? 'CANCELLED' : 'PENDING';
      await this.transactionService.update(cheque.referenceId!, companyId, { status: txStatus });
    }

    return updated;
  }
}
