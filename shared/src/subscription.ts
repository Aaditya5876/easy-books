import { z } from 'zod';

// OneBook subscription plans — from the GeoInfosys price sheet ("one book
// pricing.xlsx"). Each company is on one PRODUCT LINE (decided by its business
// type) and one TIER. Tiers differ by logins: Basic is the admin alone;
// Standard and Premium allow more users with roles. A new client starts on a
// one-month free trial of Premium; the first purchase (installation fee)
// covers one year; after that the plan is renewed monthly, quarterly,
// half-yearly or yearly.

export const PRODUCT_LINES = ['SCHOOL', 'TRADING', 'CLINIC_PHARMACY', 'HOTEL_CAFE', 'HRM_CRM'] as const;
export type ProductLine = (typeof PRODUCT_LINES)[number];

export const PRODUCT_LINE_LABELS: Record<ProductLine, string> = {
  SCHOOL: 'School Management',
  TRADING: 'Trading & Inventory',
  CLINIC_PHARMACY: 'Clinic & Pharmacy',
  HOTEL_CAFE: 'Hotel & Cafe',
  HRM_CRM: 'HRM & CRM',
};

export const PLAN_TIERS = ['BASIC', 'STANDARD', 'PREMIUM'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const PLAN_TIER_LABELS: Record<PlanTier, string> = { BASIC: 'Basic', STANDARD: 'Standard', PREMIUM: 'Premium' };

export const BILLING_PERIODS = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export const BILLING_PERIOD_MONTHS: Record<BillingPeriod, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 };
export const BILLING_PERIOD_LABELS: Record<BillingPeriod, string> = {
  MONTHLY: 'Monthly', QUARTERLY: 'Quarterly (3 months)', HALF_YEARLY: 'Half-yearly (6 months)', YEARLY: 'Yearly',
};

export const TRIAL_MONTHS = 1;
export const TRIAL_TIER: PlanTier = 'PREMIUM';
// The installation fee includes the first year.
export const FIRST_TERM_MONTHS = 12;

export const SUBSCRIPTION_PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'QR', 'ESEWA', 'KHALTI', 'OTHER'] as const;

// Logins a tier allows, counting the admin. null = no limit.
export function maxUsersFor(tier: string | null | undefined): number | null {
  return tier === 'BASIC' ? 1 : null;
}

// The app's business types → the price sheet's product lines. Anything that
// isn't a school, pharmacy, food place or services firm is trading.
export function productLineFor(businessType: string | null | undefined): ProductLine {
  const t = String(businessType ?? '').trim().toUpperCase();
  if (t === 'SCHOOL') return 'SCHOOL';
  if (t === 'PHARMACY') return 'CLINIC_PHARMACY';
  if (t === 'FOOD_BEVERAGE') return 'HOTEL_CAFE';
  if (t === 'SERVICES') return 'HRM_CRM';
  return 'TRADING';
}

// Calendar months later, same time of day. A day that doesn't exist in the
// target month falls back to its last day (31 Jan + 1 month = 28/29 Feb).
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export interface PlanPriceRow {
  productLine: ProductLine;
  tier: PlanTier;
  installationFee: number;
  monthly: number;
  quarterly: number;
  halfYearly: number;
  yearly: number;
}

// The price sheet as agreed (NPR). Loaded into the database the first time
// prices are read; after that GeoInfosys edits them in Settings → Pricing.
const SHEET: Record<ProductLine, [install: [number, number, number], basic: number[], standard: number[], premium: number[]]> = {
  SCHOOL: [[75000, 94000, 106000], [2500, 8500, 14800, 26000], [3500, 9300, 16800, 30000], [3995, 10400, 17900, 34000]],
  TRADING: [[8000, 13500, 14995], [800, 2800, 4600, 8000], [1490, 4650, 8500, 15500], [2360, 9559, 17230, 31908]],
  CLINIC_PHARMACY: [[15000, 24000, 29995], [1260, 4500, 8200, 15200], [1850, 6500, 11650, 20570], [2350, 8600, 16100, 30120]],
  HOTEL_CAFE: [[8000, 12000, 15500], [500, 1800, 2950, 4530], [850, 3100, 5200, 9500], [1150, 3950, 6950, 12340]],
  HRM_CRM: [[12000, 17500, 19990], [800, 2800, 4600, 8000], [1490, 4650, 8500, 15500], [2360, 9559, 17230, 31908]],
};

export const DEFAULT_PLAN_PRICES: PlanPriceRow[] = PRODUCT_LINES.flatMap((productLine) => {
  const [install, ...tiers] = SHEET[productLine];
  return PLAN_TIERS.map((tier, i) => {
    const [monthly, quarterly, halfYearly, yearly] = tiers[i];
    return { productLine, tier, installationFee: install[i], monthly, quarterly, halfYearly, yearly };
  });
});

export function priceForPeriod(row: Pick<PlanPriceRow, 'monthly' | 'quarterly' | 'halfYearly' | 'yearly'>, period: BillingPeriod): number {
  return Number({ MONTHLY: row.monthly, QUARTERLY: row.quarterly, HALF_YEARLY: row.halfYearly, YEARLY: row.yearly }[period]);
}

const money = z.coerce.number({ message: 'Amount must be a number' }).min(0, 'Amount cannot be negative').max(100_000_000, 'Amount is too large');
const paymentFields = {
  amount: money.optional(), // blank = the price list's amount
  paymentMethod: z.enum(SUBSCRIPTION_PAYMENT_METHODS, { message: 'Choose how it was paid' }),
  paidAt: z.coerce.date({ message: 'Payment date is not a valid date' }).optional(),
  reference: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
};

// First purchase: installation fee, one year of the chosen tier.
export const ActivatePlanSchema = z.object({
  planTier: z.enum(PLAN_TIERS, { message: 'Choose Basic, Standard or Premium' }),
  productLine: z.enum(PRODUCT_LINES).optional(),
  ...paymentFields,
});

// Later renewals; planTier changes the plan (upgrade/downgrade) from now on.
export const RenewPlanSchema = z.object({
  period: z.enum(BILLING_PERIODS, { message: 'Choose monthly, quarterly, half-yearly or yearly' }),
  planTier: z.enum(PLAN_TIERS).optional(),
  ...paymentFields,
});

export const UpdatePlanPriceSchema = z.object({
  installationFee: money,
  monthly: money,
  quarterly: money,
  halfYearly: money,
  yearly: money,
});

export const RequestRenewalSchema = z.object({
  period: z.enum(BILLING_PERIODS).optional(),
  planTier: z.enum(PLAN_TIERS).optional(),
}).optional();

export type ActivatePlanDTO = z.infer<typeof ActivatePlanSchema>;
export type RenewPlanDTO = z.infer<typeof RenewPlanSchema>;
export type UpdatePlanPriceDTO = z.infer<typeof UpdatePlanPriceSchema>;
