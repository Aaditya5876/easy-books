import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { LedgerPostingService } from './ledger-posting.service';
import { adToBs } from '@easy-books/shared';

@Injectable()
export class ChequeServiceImpl {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerPosting: LedgerPostingService,
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

    const updated = await this.prisma.cheque.update({
      where: { id },
      data: {
        status: status as any,
        ...(status === 'CLEARED' ? { clearedAt: new Date() } : {}),
        ...(notes ? { notes } : {}),
      },
    });

    // If cheque is linked to a Transaction (referenceType === 'TRANSACTION'),
    // update that transaction's status instead of posting standalone cheque
    // ledger entries here. The TransactionServiceImpl will post its manual
    // journal when the transaction becomes COMPLETED. For cheques not linked
    // to a transaction, call the ledger posting helper directly.
    if (status === 'CLEARED') {
      if (cheque.referenceType === 'TRANSACTION' && cheque.referenceId) {
        try {
          await this.prisma.transaction.update({ where: { id: cheque.referenceId }, data: { status: 'COMPLETED' } });
        } catch (e) {
          // ignore if transaction not found — still attempt cheque ledger posting
          await this.ledgerPosting.postChequeCleared(companyId, id);
        }
      } else {
        await this.ledgerPosting.postChequeCleared(companyId, id);
      }
    }

    // If cheque was cancelled or bounced and it's linked to a transaction,
    // reflect that on the transaction so the ledger will not be posted.
    if ((status === 'CANCELLED' || status === 'BOUNCED') && cheque.referenceType === 'TRANSACTION' && cheque.referenceId) {
      const txStatus = status === 'CANCELLED' ? 'CANCELLED' : 'PENDING';
      await this.prisma.transaction.update({ where: { id: cheque.referenceId }, data: { status: txStatus } });
    }

    return updated;
  }
}
