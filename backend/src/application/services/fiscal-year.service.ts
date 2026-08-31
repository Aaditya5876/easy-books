import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { LedgerPostingService } from './ledger-posting.service';
import { NotificationServiceImpl } from './notification.service.impl';
import { currentBsFiscalYear, fiscalYearAdRange, isFiscalYearEnded } from '@easy-books/shared';

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class FiscalYearService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: LedgerPostingService,
    private readonly notifications: NotificationServiceImpl,
  ) {}

  // Closing (and reopening) posts irreversible-in-spirit financial entries,
  // so both require re-entering the account password — not just being
  // logged in — the same "prove it's really you, right now" gate as other
  // high-consequence actions elsewhere in the app (e.g. the Recycle Bin).
  private async verifyPassword(userId: string, password: string) {
    if (!password) throw new UnauthorizedException('Password is required');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
    if (!user) throw new UnauthorizedException('User not found');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Incorrect password');
  }

  async getStatus(companyId: string) {
    const current = currentBsFiscalYear();
    const { startAd: currentStart } = fiscalYearAdRange(current);
    const prevYearNum = parseInt(current.split('-')[0], 10) - 1;
    const previous = `${prevYearNum}-${String(prevYearNum + 1).slice(-2)}`;

    const closes = await this.prisma.fiscalYearClose.findMany({
      where: { companyId },
      orderBy: { fiscalYear: 'desc' },
    });
    // A reopened year is open again — it must not block re-closing the same
    // fiscal year once it's genuinely ready.
    const activelyClosedYears = new Set(closes.filter((c) => !c.reopenedAt).map((c) => c.fiscalYear));

    const previousClosed = activelyClosedYears.has(previous);
    const previousEnded = isFiscalYearEnded(previous);
    let preview: { fiscalYear: string; totalIncome: number; totalExpense: number; netProfit: number } | null = null;
    if (previousEnded && !previousClosed) {
      const totals = await this.computePnlTotals(companyId);
      preview = { fiscalYear: previous, ...totals };
    }

    return {
      currentFiscalYear: current,
      currentFiscalYearStartedAt: currentStart,
      closedYears: closes.map((c) => ({
        fiscalYear: c.fiscalYear,
        closedAt: c.closedAt,
        totalIncome: Number(c.totalIncome),
        totalExpense: Number(c.totalExpense),
        netProfit: Number(c.netProfit),
        reopenedAt: c.reopenedAt,
      })),
      closeable: previewIsCloseable(previousEnded, previousClosed),
      preview,
    };
  }

  // Every Income/Expense account's net balance right now — since a prior
  // close (if any) already zeroed them out, "all-time cumulative" and
  // "since the last close" are the same query. No date filtering needed.
  private async computePnlTotals(companyId: string) {
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['accountId'],
      where: { companyId, referenceType: { not: 'TRANSACTION_MEMO' } },
      _sum: { debit: true, credit: true },
    });
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { id: { in: grouped.map((g) => g.accountId) }, accountType: { in: ['INCOME', 'EXPENSE'] } },
    });
    const accountById = new Map(accounts.map((a) => [a.id, a]));

    let totalIncome = 0;
    let totalExpense = 0;
    const lines: { accountId: string; accountType: 'INCOME' | 'EXPENSE'; net: number }[] = [];

    for (const g of grouped) {
      const account = accountById.get(g.accountId);
      if (!account) continue;
      const debitSum = Number(g._sum.debit ?? 0);
      const creditSum = Number(g._sum.credit ?? 0);
      const opening = Number(account.openingBalance);
      if (account.accountType === 'INCOME') {
        // Credit-normal: net > 0 is the usual "money earned" balance.
        const net = round2(opening - debitSum + creditSum);
        if (net !== 0) { totalIncome += net; lines.push({ accountId: account.id, accountType: 'INCOME', net }); }
      } else {
        // Debit-normal: net > 0 is the usual "money spent" balance.
        const net = round2(opening + debitSum - creditSum);
        if (net !== 0) { totalExpense += net; lines.push({ accountId: account.id, accountType: 'EXPENSE', net }); }
      }
    }

    return { totalIncome: round2(totalIncome), totalExpense: round2(totalExpense), netProfit: round2(totalIncome - totalExpense), lines };
  }

  // Full accounting close: zeroes every Income/Expense account by posting the
  // offsetting entry against Retained Earnings, dated at the fiscal year's
  // last day. Afterward, Trial Balance / P&L for the new year start from
  // zero (nothing special needed there — it's the same all-time-cumulative
  // query as always, and the closing entry IS the reset). Balance Sheet is
  // unaffected/still correct automatically: its synthetic "retained earnings"
  // line (getNetAccountBalances-based, see ReportsService.getBalanceSheet)
  // now nets to just the current, still-open year's P&L, while the real
  // Retained Earnings EQUITY account (created here) carries every closed
  // year's profit forward — the two together still sum to the same total.
  async closeFiscalYear(companyId: string, fiscalYear: string, userId: string, password: string) {
    await this.verifyPassword(userId, password);

    if (!isFiscalYearEnded(fiscalYear)) {
      throw new BadRequestException(`Fiscal year ${fiscalYear} hasn't ended yet`);
    }
    const already = await this.prisma.fiscalYearClose.findUnique({ where: { companyId_fiscalYear: { companyId, fiscalYear } } });
    if (already && !already.reopenedAt) throw new BadRequestException(`Fiscal year ${fiscalYear} is already closed`);

    const { totalIncome, totalExpense, netProfit, lines } = await this.computePnlTotals(companyId);
    const { endAd } = fiscalYearAdRange(fiscalYear);
    const retainedEarnings = await this.posting.getOrCreateSystemAccount(companyId, 'Retained Earnings', 'EQUITY');

    const close = await this.prisma.$transaction(async (tx) => {
      // Re-closing a previously reopened year reuses the same row (a fresh
      // closedAt/totals, cleared reopen stamp) rather than fighting the
      // @@unique([companyId, fiscalYear]) constraint with a second row.
      const record = already
        ? await tx.fiscalYearClose.update({
            where: { id: already.id },
            data: { closedAt: new Date(), closedByUserId: userId, totalIncome, totalExpense, netProfit, reopenedAt: null, reopenedByUserId: null },
          })
        : await tx.fiscalYearClose.create({
            data: { companyId, fiscalYear, closedByUserId: userId, totalIncome, totalExpense, netProfit },
          });

      for (const line of lines) {
        const amount = Math.abs(line.net);
        if (amount === 0) continue;
        // Income (credit-normal, net > 0 is the common case): debit it to
        // zero, credit Retained Earnings. Reversed for a net < 0 income
        // account (rare — heavy refunds), and mirrored for Expense.
        const incomeClosingToRE = line.accountType === 'INCOME' ? line.net > 0 : line.net < 0;
        const debitAccountId = incomeClosingToRE ? line.accountId : retainedEarnings.id;
        const creditAccountId = incomeClosingToRE ? retainedEarnings.id : line.accountId;
        await this.posting.postManualJournalEntryTx(tx, companyId, {
          debitAccountId,
          creditAccountId,
          amount,
          dateAd: endAd.toISOString(),
          description: `Fiscal year ${fiscalYear} close`,
          referenceType: 'FISCAL_YEAR_CLOSE',
          referenceId: record.id,
        });
      }

      return record;
    });

    try {
      await this.notifications.notifyRole(companyId, ['ADMIN'], {
        type: 'SYSTEM_AUTOMATION',
        title: `Fiscal year ${fiscalYear} closed`,
        message: `Net ${netProfit >= 0 ? 'profit' : 'loss'} of Rs. ${Math.abs(netProfit).toLocaleString('en-NP')} transferred to Retained Earnings.`,
        link: '/settings',
        referenceType: 'FISCAL_YEAR_CLOSE',
        referenceId: close.id,
      });
    } catch (err) {
      console.error('Fiscal year close notification failed:', (err as Error).message);
    }

    return { ...close, totalIncome, totalExpense, netProfit };
  }

  // Undoes a close by posting REVERSING entries (swap debit/credit on each
  // original closing leg) rather than deleting history — the close, and the
  // fact it was later reopened, both stay visible in the ledger and in
  // FiscalYearClose. Income/Expense accounts go back to exactly their
  // pre-close balances; Retained Earnings drops back by the same net profit.
  async reopenFiscalYear(companyId: string, fiscalYear: string, userId: string, password: string) {
    await this.verifyPassword(userId, password);

    const close = await this.prisma.fiscalYearClose.findUnique({ where: { companyId_fiscalYear: { companyId, fiscalYear } } });
    if (!close) throw new NotFoundException(`Fiscal year ${fiscalYear} was never closed`);
    if (close.reopenedAt) throw new BadRequestException(`Fiscal year ${fiscalYear} is already reopened`);

    const closingEntries = await this.prisma.ledgerEntry.findMany({
      where: { companyId, referenceType: 'FISCAL_YEAR_CLOSE', referenceId: close.id },
    });
    if (closingEntries.length === 0) throw new BadRequestException('No closing entries found to reverse');
    const retainedEarnings = await this.posting.getOrCreateSystemAccount(companyId, 'Retained Earnings', 'EQUITY');

    await this.prisma.$transaction(async (tx) => {
      // Each original closing line produced two rows (the P&L leg + its
      // Retained Earnings leg). Drive the reversal off the P&L leg only —
      // processing the RE leg too would double-reverse the same line.
      for (const entry of closingEntries) {
        if (entry.accountId === retainedEarnings.id) continue;
        const amount = Number(entry.debit) > 0 ? Number(entry.debit) : Number(entry.credit);
        if (amount === 0) continue;
        const wasDebit = Number(entry.debit) > 0;
        await this.posting.postManualJournalEntryTx(tx, companyId, {
          debitAccountId: wasDebit ? retainedEarnings.id : entry.accountId,
          creditAccountId: wasDebit ? entry.accountId : retainedEarnings.id,
          amount,
          dateAd: new Date().toISOString(),
          description: `Reopen fiscal year ${fiscalYear} — reversing close`,
          referenceType: 'FISCAL_YEAR_CLOSE_REOPEN',
          referenceId: close.id,
        });
      }

      await tx.fiscalYearClose.update({
        where: { id: close.id },
        data: { reopenedAt: new Date(), reopenedByUserId: userId },
      });
    });

    try {
      await this.notifications.notifyRole(companyId, ['ADMIN'], {
        type: 'SYSTEM_AUTOMATION',
        title: `Fiscal year ${fiscalYear} reopened`,
        message: `The close for ${fiscalYear} was reversed — Income/Expense accounts are back to their pre-close balances.`,
        link: '/settings',
        referenceType: 'FISCAL_YEAR_CLOSE',
        referenceId: close.id,
      });
    } catch (err) {
      console.error('Fiscal year reopen notification failed:', (err as Error).message);
    }

    return { fiscalYear, reopenedAt: new Date() };
  }
}

function previewIsCloseable(previousEnded: boolean, previousClosed: boolean) {
  return previousEnded && !previousClosed;
}
