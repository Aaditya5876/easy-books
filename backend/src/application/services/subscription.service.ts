import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { isCompanyAccessible } from '../../../core/modules/company-access';
import { countActiveLogins } from '../../../core/utils/plan-limits';
import { NotificationServiceImpl } from './notification.service.impl';
import {
  adToBs, addMonths, maxUsersFor, productLineFor, priceForPeriod,
  DEFAULT_PLAN_PRICES, PRODUCT_LINES, PLAN_TIERS, PLAN_TIER_LABELS, PRODUCT_LINE_LABELS,
  BILLING_PERIOD_MONTHS, FIRST_TERM_MONTHS,
  type ActivatePlanDTO, type RenewPlanDTO, type UpdatePlanPriceDTO, type ProductLine, type PlanTier,
} from '@easy-books/shared';

const DAY_MS = 24 * 60 * 60 * 1000;
const COMPANY_ROLES = ['ADMIN', 'ACCOUNTANT', 'STAFF', 'TEACHER'];

type PriceRow = Prisma.PlanPriceGetPayload<object>;
type PaymentRow = Prisma.SubscriptionPaymentGetPayload<object>;

// OneBook plans: price list, what a company is on, and what it paid
// GeoInfosys. The free trial is set when a company is created
// (trialPlanFields); everything after that goes through activate/renew here.
@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationServiceImpl,
  ) {}

  // ── Price list ─────────────────────────────────────────────────────────
  // Filled from the price sheet the first time it's read (fresh databases,
  // production after the migration); edits made in Settings are kept.
  private async ensurePrices() {
    if ((await this.prisma.planPrice.count()) >= DEFAULT_PLAN_PRICES.length) return;
    await this.prisma.planPrice.createMany({ data: DEFAULT_PLAN_PRICES, skipDuplicates: true });
  }

  private static toPrice(r: PriceRow) {
    return {
      id: r.id, productLine: r.productLine, tier: r.tier,
      installationFee: Number(r.installationFee), monthly: Number(r.monthly), quarterly: Number(r.quarterly),
      halfYearly: Number(r.halfYearly), yearly: Number(r.yearly), updatedAt: r.updatedAt,
    };
  }

  private static order(rows: PriceRow[]) {
    const rank = (r: PriceRow) => PRODUCT_LINES.indexOf(r.productLine as ProductLine) * 10 + PLAN_TIERS.indexOf(r.tier as PlanTier);
    return [...rows].sort((a, b) => rank(a) - rank(b)).map(SubscriptionService.toPrice);
  }

  async listPrices() {
    await this.ensurePrices();
    return SubscriptionService.order(await this.prisma.planPrice.findMany());
  }

  async updatePrice(id: string, dto: UpdatePlanPriceDTO) {
    const row = await this.prisma.planPrice.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Price not found');
    return SubscriptionService.toPrice(await this.prisma.planPrice.update({ where: { id }, data: dto }));
  }

  private async priceFor(productLine: string, tier: string) {
    await this.ensurePrices();
    const row = await this.prisma.planPrice.findUnique({ where: { productLine_tier: { productLine, tier } } });
    if (!row) throw new BadRequestException(`No price is set for ${productLine} ${tier}`);
    return SubscriptionService.toPrice(row);
  }

  // ── A company's plan ───────────────────────────────────────────────────
  private static toPayment(p: PaymentRow) {
    return { ...p, amount: Number(p.amount) };
  }

  async getForCompany(companyId: string, userId: string, role: string) {
    if (role !== 'SUPER_ADMIN') {
      const member = await this.prisma.userCompany.findFirst({ where: { userId, companyId }, select: { id: true } });
      if (!member) throw new ForbiddenException('You do not have access to this company');
    }
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const productLine = (company.productLine ?? productLineFor(company.businessType)) as ProductLine;
    await this.ensurePrices();
    const [active, prices, payments] = await Promise.all([
      countActiveLogins(this.prisma, companyId),
      this.prisma.planPrice.findMany({ where: { productLine } }),
      this.prisma.subscriptionPayment.findMany({ where: { companyId }, orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }] }),
    ]);
    const expires = company.subscriptionExpiresAt;
    const now = Date.now();
    return {
      companyId,
      companyName: company.name,
      productLine,
      productLineLabel: PRODUCT_LINE_LABELS[productLine],
      planTier: company.planTier,
      planStatus: company.planStatus,
      subscriptionStartedAt: company.subscriptionStartedAt,
      trialEndsAt: company.trialEndsAt,
      subscriptionExpiresAt: expires,
      isExpired: !!expires && expires.getTime() <= now,
      daysLeft: expires ? Math.max(0, Math.ceil((expires.getTime() - now) / DAY_MS)) : null,
      lastRenewalRequestedAt: company.lastRenewalRequestedAt,
      users: { active, max: maxUsersFor(company.planTier) },
      prices: SubscriptionService.order(prices),
      payments: payments.map(SubscriptionService.toPayment),
    };
  }

  // Downgrading to a tier with a user limit while more logins are active
  // would leave the company over its plan — refuse until they're suspended.
  private async assertTierFits(companyId: string, companyName: string, tier: string) {
    const max = maxUsersFor(tier);
    if (max == null) return;
    const active = await countActiveLogins(this.prisma, companyId);
    if (active > max) {
      throw new BadRequestException(
        `The ${PLAN_TIER_LABELS[tier as PlanTier]} plan includes only the admin login, but ${companyName} has ${active} active logins. ` +
        'Suspend the other users first (Settings → Users), then try again.',
      );
    }
  }

  // SUB-<BS year>-0001, one sequence across all clients — GeoInfosys's own
  // receipts. The advisory lock keeps two saves from taking the same number.
  private async nextReceiptNumberTx(tx: Prisma.TransactionClient, at: Date) {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('subscription_receipt'))`);
    const prefix = `SUB-${adToBs(at).slice(0, 4)}-`;
    const last = await tx.subscriptionPayment.findFirst({
      where: { receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: 'desc' },
      select: { receiptNumber: true },
    });
    const n = last ? Number(last.receiptNumber.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(n).padStart(4, '0')}`;
  }

  // Saves the payment and the company's new plan together; tells everyone at
  // the company when this brings them back from an expired plan.
  private async record(
    company: { id: string; name: string; isActive: boolean; subscriptionExpiresAt: Date | null },
    payment: Omit<Prisma.SubscriptionPaymentUncheckedCreateInput, 'receiptNumber' | 'companyId'>,
    companyData: Prisma.CompanyUpdateInput,
  ) {
    const wasLockedOut = company.isActive && !isCompanyAccessible(company);
    const saved = await this.prisma.$transaction(async (tx) => {
      const receiptNumber = await this.nextReceiptNumberTx(tx, new Date());
      const row = await tx.subscriptionPayment.create({ data: { ...payment, companyId: company.id, receiptNumber } });
      await tx.company.update({
        where: { id: company.id },
        data: { ...companyData, accessBlockedNotifiedAt: null, lastRenewalRequestedAt: null, expiryReminderDays: null },
      });
      return row;
    });
    if (wasLockedOut) {
      const message = `${company.name}'s subscription was renewed and access is available again.`;
      await this.notifications.notifyRole(company.id, COMPANY_ROLES, { type: 'ACCESS_RESTORED', title: 'Subscription renewed', message });
    }
    const updated = await this.prisma.company.findUnique({
      where: { id: company.id },
      select: { id: true, productLine: true, planTier: true, planStatus: true, subscriptionStartedAt: true, subscriptionExpiresAt: true },
    });
    return { company: updated, payment: SubscriptionService.toPayment(saved) };
  }

  // First purchase: the installation fee buys one year of the chosen tier,
  // starting today. Also how a company set up before plans existed is put on one.
  async activate(companyId: string, dto: ActivatePlanDTO, recordedById: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    if (company.planStatus === 'ACTIVE') {
      throw new BadRequestException(`${company.name} has already bought a plan — use Renew to extend or change it.`);
    }
    const productLine = dto.productLine ?? company.productLine ?? productLineFor(company.businessType);
    await this.assertTierFits(companyId, company.name, dto.planTier);
    const price = await this.priceFor(productLine, dto.planTier);
    const now = new Date();
    const end = addMonths(now, FIRST_TERM_MONTHS);
    return this.record(company, {
      kind: 'ACTIVATION', planTier: dto.planTier, period: 'YEARLY', months: FIRST_TERM_MONTHS,
      amount: dto.amount ?? price.installationFee, paymentMethod: dto.paymentMethod,
      reference: dto.reference || null, note: dto.note || null, paidAt: dto.paidAt ?? now,
      periodStart: now, periodEnd: end, recordedById,
    }, {
      productLine, planTier: dto.planTier, planStatus: 'ACTIVE', subscriptionStartedAt: now, subscriptionExpiresAt: end,
    });
  }

  // Renewal: the period is added to the current expiry when renewing early
  // (no days lost), or to today when the plan has already run out. A new
  // tier applies from now and is charged at that tier's price.
  async renew(companyId: string, dto: RenewPlanDTO, recordedById: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    if (company.planStatus !== 'ACTIVE' || !company.planTier) {
      throw new BadRequestException(
        `${company.name} hasn't bought a plan yet — activate it first (installation fee, includes the first year).`,
      );
    }
    const tier = dto.planTier ?? company.planTier;
    if (tier !== company.planTier) await this.assertTierFits(companyId, company.name, tier);
    const productLine = company.productLine ?? productLineFor(company.businessType);
    const price = await this.priceFor(productLine, tier);
    const now = new Date();
    const expires = company.subscriptionExpiresAt;
    const start = expires && expires.getTime() > now.getTime() ? expires : now;
    const months = BILLING_PERIOD_MONTHS[dto.period];
    const end = addMonths(start, months);
    return this.record(company, {
      kind: 'RENEWAL', planTier: tier, period: dto.period, months,
      amount: dto.amount ?? priceForPeriod(price, dto.period), paymentMethod: dto.paymentMethod,
      reference: dto.reference || null, note: dto.note || null, paidAt: dto.paidAt ?? now,
      periodStart: start, periodEnd: end, recordedById,
    }, {
      productLine, planTier: tier, subscriptionExpiresAt: end,
    });
  }
}
