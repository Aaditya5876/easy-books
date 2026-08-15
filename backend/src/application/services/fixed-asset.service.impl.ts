import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { LedgerPostingService } from './ledger-posting.service';
import { adToBs } from '@easy-books/shared';

const SYSTEM_ACCOUNTS = {
  FIXED_ASSETS: 'Fixed Assets',
  ACCUMULATED_DEPRECIATION: 'Accumulated Depreciation',
  DEPRECIATION_EXPENSE: 'Depreciation Expense',
  GAIN_LOSS_ON_DISPOSAL: 'Gain/Loss on Disposal of Assets',
  CASH_IN_HAND: 'Cash in Hand',
  BANK_ACCOUNT: 'Bank Account',
  ACCOUNTS_PAYABLE: 'Accounts Payable',
};

@Injectable()
export class FixedAssetServiceImpl {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerPosting: LedgerPostingService,
  ) {}

  async findAll(companyId: string) {
    return this.prisma.fixedAsset.findMany({ where: { companyId }, orderBy: { purchaseDateAd: 'desc' } });
  }

  async findById(id: string, companyId: string) {
    const asset = await this.prisma.fixedAsset.findFirst({ where: { id, companyId } });
    if (!asset) throw new NotFoundException('Fixed asset not found');
    return asset;
  }

  // Records the asset AND posts the actual purchase cash movement — DR Fixed
  // Assets, CR Cash/Bank/Accounts Payable — so it shows up correctly as an
  // INVESTING outflow in the Cash Flow Statement (Fixed Assets is tagged
  // cashFlowActivity: INVESTING below).
  async create(companyId: string, data: {
    assetName: string;
    assetCode?: string;
    category?: string;
    purchaseDateAd: string;
    cost: number;
    usefulLifeYears: number;
    salvageValue?: number;
    paymentMethod?: 'CASH' | 'BANK' | 'CREDIT';
    notes?: string;
  }) {
    if (data.usefulLifeYears <= 0) throw new BadRequestException('Useful life must be greater than zero');
    const purchaseDate = new Date(data.purchaseDateAd);

    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.fixedAsset.create({
        data: {
          companyId,
          assetName: data.assetName,
          assetCode: data.assetCode,
          category: data.category,
          purchaseDateAd: purchaseDate,
          purchaseDateBs: adToBs(purchaseDate),
          cost: data.cost,
          usefulLifeYears: data.usefulLifeYears,
          salvageValue: data.salvageValue ?? 0,
        },
      });

      const fixedAssetsAccount = await this.ledgerPosting.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.FIXED_ASSETS, 'ASSET');
      await this.tagCashFlowActivity(fixedAssetsAccount.id, 'INVESTING');

      const counterAccountName = data.paymentMethod === 'CREDIT'
        ? SYSTEM_ACCOUNTS.ACCOUNTS_PAYABLE
        : data.paymentMethod === 'BANK'
          ? SYSTEM_ACCOUNTS.BANK_ACCOUNT
          : SYSTEM_ACCOUNTS.CASH_IN_HAND;
      const counterAccountType = data.paymentMethod === 'CREDIT' ? 'LIABILITY' : 'ASSET';
      const counterAccount = await this.ledgerPosting.getOrCreateSystemAccount(companyId, counterAccountName, counterAccountType);

      await this.ledgerPosting.postManualJournalEntryTx(tx, companyId, {
        debitAccountId: fixedAssetsAccount.id,
        creditAccountId: counterAccount.id,
        amount: data.cost,
        dateAd: data.purchaseDateAd,
        description: `Fixed Asset purchased — ${data.assetName}`,
        referenceType: 'FIXED_ASSET',
        referenceId: asset.id,
      });

      return asset;
    });
  }

  // Manual, on-demand straight-line depreciation for every ACTIVE asset, up to
  // `asOfDateAd`. Never auto-runs — the user explicitly triggers this (per the
  // approved plan: a manual "Run Depreciation" button, not a scheduled job).
  // Posts ONE aggregated journal entry for the whole run (same pattern as a
  // Payroll run), not one entry per asset.
  async runDepreciation(companyId: string, asOfDateAd: string) {
    const asOfDate = new Date(asOfDateAd);
    const assets = await this.prisma.fixedAsset.findMany({ where: { companyId, status: 'ACTIVE' } });

    const updates: { id: string; amount: number; newAccumulated: number }[] = [];
    let totalDepreciation = 0;

    for (const asset of assets) {
      const depreciableBase = Number(asset.cost) - Number(asset.salvageValue);
      if (depreciableBase <= 0) continue;

      const monthlyDepreciation = depreciableBase / (asset.usefulLifeYears * 12);
      const since = asset.lastDepreciationDateAd ?? asset.purchaseDateAd;
      const monthsElapsed = monthsBetween(since, asOfDate);
      if (monthsElapsed <= 0) continue;

      const alreadyDepreciated = Number(asset.accumulatedDepreciation);
      const remaining = depreciableBase - alreadyDepreciated;
      if (remaining <= 0) continue;

      const amount = Math.min(monthlyDepreciation * monthsElapsed, remaining);
      if (amount <= 0) continue;

      updates.push({ id: asset.id, amount, newAccumulated: alreadyDepreciated + amount });
      totalDepreciation += amount;
    }

    if (totalDepreciation <= 0) {
      return { assetsDepreciated: 0, totalDepreciation: 0 };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const u of updates) {
        await tx.fixedAsset.update({
          where: { id: u.id },
          data: { accumulatedDepreciation: u.newAccumulated, lastDepreciationDateAd: asOfDate },
        });
      }

      const depreciationExpense = await this.ledgerPosting.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.DEPRECIATION_EXPENSE, 'EXPENSE');
      const accumulatedDepreciation = await this.ledgerPosting.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.ACCUMULATED_DEPRECIATION, 'ASSET');

      await this.ledgerPosting.postManualJournalEntryTx(tx, companyId, {
        debitAccountId: depreciationExpense.id,
        creditAccountId: accumulatedDepreciation.id,
        amount: totalDepreciation,
        dateAd: asOfDateAd,
        description: `Depreciation run as of ${asOfDateAd} — ${updates.length} asset(s)`,
        referenceType: 'FIXED_ASSET_DEPRECIATION',
        referenceId: randomUUID(),
      });
    });

    return { assetsDepreciated: updates.length, totalDepreciation };
  }

  // Full gain/loss disposal accounting: removes the asset at cost, removes its
  // accumulated depreciation, records the proceeds, and posts the difference as
  // a gain (credit) or loss (debit) — all as one balanced multi-leg entry (not
  // the standard 2-leg postManualJournalEntryTx, since disposal always has 3-4
  // legs), atomic with the asset's own status change.
  async dispose(companyId: string, id: string, data: { disposalDateAd: string; disposalAmount: number; paymentMethod?: 'CASH' | 'BANK' }) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.fixedAsset.findFirst({ where: { id, companyId } });
      if (!asset) throw new NotFoundException('Fixed asset not found');
      if (asset.status !== 'ACTIVE') throw new BadRequestException('Asset has already been disposed');

      const cost = Number(asset.cost);
      const accumulatedDep = Number(asset.accumulatedDepreciation);
      const netBookValue = cost - accumulatedDep;
      const gainLoss = data.disposalAmount - netBookValue;
      const date = new Date(data.disposalDateAd);
      const dateBs = adToBs(date);
      const desc = `Disposal of Fixed Asset — ${asset.assetName}`;

      const fixedAssetsAcct = await this.ledgerPosting.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.FIXED_ASSETS, 'ASSET');
      const accumulatedDepAcct = await this.ledgerPosting.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.ACCUMULATED_DEPRECIATION, 'ASSET');
      const cashAcctName = data.paymentMethod === 'BANK' ? SYSTEM_ACCOUNTS.BANK_ACCOUNT : SYSTEM_ACCOUNTS.CASH_IN_HAND;
      const cashAcct = await this.ledgerPosting.getOrCreateSystemAccount(companyId, cashAcctName, 'ASSET');
      const gainLossAcct = await this.ledgerPosting.getOrCreateSystemAccount(companyId, SYSTEM_ACCOUNTS.GAIN_LOSS_ON_DISPOSAL, 'INCOME');

      const legs: { accountId: string; debit: number; credit: number }[] = [
        { accountId: fixedAssetsAcct.id, debit: 0, credit: cost },
        { accountId: accumulatedDepAcct.id, debit: accumulatedDep, credit: 0 },
        { accountId: cashAcct.id, debit: data.disposalAmount, credit: 0 },
      ];
      if (Math.abs(gainLoss) > 0.01) {
        legs.push(gainLoss > 0
          ? { accountId: gainLossAcct.id, debit: 0, credit: gainLoss }
          : { accountId: gainLossAcct.id, debit: -gainLoss, credit: 0 });
      }

      const accountIds = [...new Set(legs.map((l) => l.accountId))];
      const accounts = await tx.ledgerAccount.findMany({ where: { id: { in: accountIds } } });
      const accountById = new Map(accounts.map((a) => [a.id, a]));
      const debitNormal = (t: string) => t === 'ASSET' || t === 'EXPENSE';

      const referenceId = id;
      for (const leg of legs) {
        const account = accountById.get(leg.accountId)!;
        const net = leg.debit - leg.credit;
        const delta = debitNormal(account.accountType) ? net : -net;
        await tx.ledgerEntry.create({
          data: {
            companyId, accountId: leg.accountId, dateAd: date, dateBs, description: desc,
            debit: leg.debit, credit: leg.credit,
            balance: Number(account.currentBalance) + delta,
            referenceType: 'FIXED_ASSET_DISPOSAL', referenceId, isAutoPosted: true,
          },
        });
        await tx.ledgerAccount.update({ where: { id: leg.accountId }, data: { currentBalance: { increment: delta } } });
      }

      return tx.fixedAsset.update({
        where: { id },
        data: { status: 'DISPOSED', disposalDateAd: date, disposalAmount: data.disposalAmount },
      });
    });
  }

  private async tagCashFlowActivity(accountId: string, activity: 'OPERATING' | 'INVESTING' | 'FINANCING') {
    await this.prisma.ledgerAccount.updateMany({
      where: { id: accountId, cashFlowActivity: null },
      data: { cashFlowActivity: activity },
    });
  }
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}
