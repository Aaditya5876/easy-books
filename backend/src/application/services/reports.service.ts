import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';

function dateRangeWhere(dateFrom?: string, dateTo?: string) {
  if (!dateFrom && !dateTo) return {};
  return {
    dateAd: {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    },
  };
}

const DEBIT_NORMAL_TYPES = new Set(['ASSET', 'EXPENSE']);

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // A chronological journal — every voucher (Sales, Purchase, Payment, Payroll,
  // Cheque, Petty Cash, Bank Guarantee, or a manual Transaction) reconstructed as
  // one row from its LedgerEntry pair, instead of showing each leg separately.
  // TRANSACTION_MEMO entries are excluded — they're single-sided vendor/customer
  // tracking, not a real posted voucher (see LedgerPostingService.postPartyLedgerLineTx).
  async getDayBook(companyId: string, dateFrom?: string, dateTo?: string) {
    if (!companyId) throw new BadRequestException('companyId is required');
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        companyId,
        referenceType: { not: 'TRANSACTION_MEMO' },
        ...dateRangeWhere(dateFrom, dateTo),
      },
      include: { account: { select: { accountName: true } } },
      orderBy: [{ dateAd: 'asc' }, { createdAt: 'asc' }],
    });

    const vouchers = new Map<string, {
      dateAd: Date; dateBs: string | null; referenceType: string | null; referenceId: string | null;
      description: string | null; debitAccounts: string[]; creditAccounts: string[]; amount: number;
    }>();

    for (const e of entries) {
      const key = `${e.referenceType ?? 'NONE'}:${e.referenceId ?? e.id}`;
      if (!vouchers.has(key)) {
        vouchers.set(key, {
          dateAd: e.dateAd, dateBs: e.dateBs, referenceType: e.referenceType, referenceId: e.referenceId,
          description: e.description, debitAccounts: [], creditAccounts: [], amount: 0,
        });
      }
      const v = vouchers.get(key)!;
      if (Number(e.debit) > 0) { v.debitAccounts.push(e.account.accountName); v.amount = Math.max(v.amount, Number(e.debit)); }
      if (Number(e.credit) > 0) { v.creditAccounts.push(e.account.accountName); v.amount = Math.max(v.amount, Number(e.credit)); }
    }

    return [...vouchers.values()].map((v) => ({
      dateAd: v.dateAd,
      dateBs: v.dateBs,
      referenceType: v.referenceType,
      referenceId: v.referenceId,
      description: v.description,
      debitAccount: v.debitAccounts.join(', '),
      creditAccount: v.creditAccounts.join(', '),
      amount: v.amount,
    }));
  }

  // One account's full running history — works for a system account (Cash in
  // Hand, Purchase Expenses...) or a vendor/customer's own Purchase/Sales Account.
  async getPartyStatement(companyId: string, accountId: string, dateFrom?: string, dateTo?: string) {
    if (!companyId) throw new BadRequestException('companyId is required');
    const account = await this.prisma.ledgerAccount.findFirst({ where: { id: accountId, companyId } });
    if (!account) throw new NotFoundException('Ledger account not found');

    const entries = await this.prisma.ledgerEntry.findMany({
      where: { companyId, accountId, ...dateRangeWhere(dateFrom, dateTo) },
      orderBy: [{ dateAd: 'asc' }, { createdAt: 'asc' }],
    });

    const totalDebit = entries.reduce((s, e) => s + Number(e.debit), 0);
    const totalCredit = entries.reduce((s, e) => s + Number(e.credit), 0);

    return {
      account: {
        id: account.id,
        name: account.accountName,
        type: account.accountType,
        openingBalance: Number(account.openingBalance),
        currentBalance: Number(account.currentBalance),
      },
      entries: entries.map((e) => ({
        id: e.id,
        dateAd: e.dateAd,
        dateBs: e.dateBs,
        description: e.description,
        debit: Number(e.debit),
        credit: Number(e.credit),
        balance: Number(e.balance),
        referenceType: e.referenceType,
      })),
      totalDebit,
      totalCredit,
    };
  }

  // Shared by getTrialBalance/getBalanceSheet — the real, balanced net position
  // of every account, re-summed directly from LedgerEntry rows and excluding
  // only TRANSACTION_MEMO entries. NOT filtered by isSystem: a vendor/customer
  // account is still a real, balanced leg of the books whenever it's used in an
  // ordinary manual journal entry (e.g. via the Ledger "New Entry" dialog) —
  // only the single-sided memo tracking entries (which have no offsetting leg
  // anywhere) need to be excluded for the books to actually balance.
  private async getNetAccountBalances(companyId: string) {
    if (!companyId) throw new BadRequestException('companyId is required');
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['accountId'],
      where: { companyId, referenceType: { not: 'TRANSACTION_MEMO' } },
      _sum: { debit: true, credit: true },
    });

    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { id: { in: grouped.map((g) => g.accountId) }, companyId },
    });
    const accountById = new Map(accounts.map((a) => [a.id, a]));

    return grouped
      .map((g) => {
        const account = accountById.get(g.accountId);
        if (!account) return null;
        const isDebitNormal = DEBIT_NORMAL_TYPES.has(account.accountType);
        const debitSum = Number(g._sum.debit ?? 0);
        const creditSum = Number(g._sum.credit ?? 0);
        const opening = Number(account.openingBalance);
        const net = isDebitNormal ? opening + debitSum - creditSum : opening - debitSum + creditSum;
        return { account, isDebitNormal, net };
      })
      .filter((r): r is { account: (typeof accounts)[number]; isDebitNormal: boolean; net: number } => r !== null);
  }

  async getTrialBalance(companyId: string) {
    const balances = await this.getNetAccountBalances(companyId);

    const rows = balances
      .map(({ account, isDebitNormal, net }) => ({
        accountId: account.id,
        accountName: account.accountName,
        accountType: account.accountType,
        debit: isDebitNormal ? Math.max(net, 0) : Math.max(-net, 0),
        credit: isDebitNormal ? Math.max(-net, 0) : Math.max(net, 0),
      }))
      .sort((a, b) => a.accountType.localeCompare(b.accountType) || a.accountName.localeCompare(b.accountName));

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

    return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  }

  // Assets = Liabilities + Equity + Retained Earnings — always true by
  // construction (the fundamental accounting equation), AS LONG AS every real
  // posting is a balanced pair, which getNetAccountBalances already ensures by
  // excluding memo entries. Retained Earnings is synthetic (not a posted
  // account) since this app has no real EQUITY postings — it's simply
  // cumulative Income minus Expense, which is exactly what's needed to make
  // the equation hold.
  async getBalanceSheet(companyId: string) {
    const balances = await this.getNetAccountBalances(companyId);

    const byType = (type: string) => balances.filter((b) => b.account.accountType === type);
    const toRows = (type: string) => byType(type).map((b) => ({ accountId: b.account.id, accountName: b.account.accountName, balance: b.net }));
    const sumType = (type: string) => byType(type).reduce((s, b) => s + b.net, 0);

    const assets = toRows('ASSET');
    const liabilities = toRows('LIABILITY');
    const equity = toRows('EQUITY');
    const totalAssets = sumType('ASSET');
    const totalLiabilities = sumType('LIABILITY');
    const totalEquity = sumType('EQUITY');
    const retainedEarnings = sumType('INCOME') - sumType('EXPENSE');
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + retainedEarnings;

    return {
      assets, totalAssets,
      liabilities, totalLiabilities,
      equity, totalEquity,
      retainedEarnings,
      totalLiabilitiesAndEquity,
      balanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
    };
  }

  // Direct method: look at every entry that actually touched Cash in Hand/Bank
  // Account, then classify each movement by what it was FOR — the offsetting
  // leg's own `cashFlowActivity` tag (Fixed Assets = INVESTING, etc.), falling
  // back to OPERATING (or FINANCING for EQUITY) when an account isn't tagged.
  // A voucher with more than two legs attributes its full cash movement to the
  // first non-cash leg — correct for the overwhelming majority (2-leg) case.
  async getCashFlowStatement(companyId: string, dateFrom?: string, dateTo?: string) {
    if (!companyId) throw new BadRequestException('companyId is required');
    const cashAccounts = await this.prisma.ledgerAccount.findMany({
      where: { companyId, isSystem: true, accountType: 'ASSET', accountName: { in: ['Cash in Hand', 'Bank Account'] } },
    });
    const cashAccountIds = cashAccounts.map((a) => a.id);
    const closingCash = cashAccounts.reduce((s, a) => s + Number(a.currentBalance), 0);

    if (cashAccountIds.length === 0) {
      return { operating: 0, investing: 0, financing: 0, netChange: 0, openingCash: 0, closingCash: 0 };
    }

    const cashEntries = await this.prisma.ledgerEntry.findMany({
      where: {
        companyId,
        accountId: { in: cashAccountIds },
        referenceType: { not: 'TRANSACTION_MEMO' },
        ...dateRangeWhere(dateFrom, dateTo),
      },
    });

    if (cashEntries.length === 0) {
      return { operating: 0, investing: 0, financing: 0, netChange: 0, openingCash: closingCash, closingCash };
    }

    const refPairs = cashEntries
      .filter((e) => e.referenceType && e.referenceId)
      .map((e) => ({ referenceType: e.referenceType as string, referenceId: e.referenceId as string }));

    const otherLegs = refPairs.length === 0 ? [] : await this.prisma.ledgerEntry.findMany({
      where: { companyId, OR: refPairs, accountId: { notIn: cashAccountIds } },
      include: { account: true },
    });
    const legsByRef = new Map<string, typeof otherLegs>();
    for (const leg of otherLegs) {
      const key = `${leg.referenceType}:${leg.referenceId}`;
      if (!legsByRef.has(key)) legsByRef.set(key, []);
      legsByRef.get(key)!.push(leg);
    }

    const bucket = { OPERATING: 0, INVESTING: 0, FINANCING: 0 };
    const defaultActivity = (accountType: string) => (accountType === 'EQUITY' ? 'FINANCING' : 'OPERATING') as keyof typeof bucket;

    for (const e of cashEntries) {
      const movement = Number(e.debit) - Number(e.credit); // + = cash in, - = cash out
      const legs = legsByRef.get(`${e.referenceType}:${e.referenceId}`) ?? [];
      const other = legs[0];
      const activity = (other?.account.cashFlowActivity as keyof typeof bucket | undefined) ?? defaultActivity(other?.account.accountType ?? 'EXPENSE');
      bucket[activity] += movement;
    }

    const netChange = bucket.OPERATING + bucket.INVESTING + bucket.FINANCING;

    return {
      operating: bucket.OPERATING,
      investing: bucket.INVESTING,
      financing: bucket.FINANCING,
      netChange,
      openingCash: closingCash - netChange,
      closingCash,
    };
  }
}
