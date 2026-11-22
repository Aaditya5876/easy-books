import { useTranslation } from 'react-i18next';
import { PLAN_TIERS, BILLING_PERIODS } from '@easy-books/shared';
import { planState, TONE_CLASSES, formatNpr, formatDate } from '@/lib/subscription';

export const TIER_KEYS = { BASIC: 'subscription.tierBasic', STANDARD: 'subscription.tierStandard', PREMIUM: 'subscription.tierPremium' };
export const TIER_DEFAULTS = { BASIC: 'Basic', STANDARD: 'Standard', PREMIUM: 'Premium' };
export const PERIOD_DEFAULTS = { MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', HALF_YEARLY: 'Half-yearly', YEARLY: 'Yearly' };
export const LINE_DEFAULTS = {
  SCHOOL: 'School Management', TRADING: 'Trading & Inventory', CLINIC_PHARMACY: 'Clinic & Pharmacy',
  HOTEL_CAFE: 'Hotel & Cafe', HRM_CRM: 'HRM & CRM',
};
export const PAYMENT_METHOD_DEFAULTS = {
  CASH: 'Cash', BANK_TRANSFER: 'Bank transfer', CHEQUE: 'Cheque', QR: 'QR / Fonepay', ESEWA: 'eSewa', KHALTI: 'Khalti', OTHER: 'Other',
};

export function useLabels() {
  const { t } = useTranslation();
  return {
    t,
    tier: (k) => (k ? t(TIER_KEYS[k] ?? '', { defaultValue: TIER_DEFAULTS[k] ?? k }) : ''),
    period: (k) => t(`subscription.period_${k}`, { defaultValue: PERIOD_DEFAULTS[k] ?? k }),
    line: (k) => t(`subscription.line_${k}`, { defaultValue: LINE_DEFAULTS[k] ?? k }),
    method: (k) => t(`subscription.method_${k}`, { defaultValue: PAYMENT_METHOD_DEFAULTS[k] ?? k }),
  };
}

// "Premium · Free trial", "Basic · 12 days left", "Expired", "No plan"
export function PlanBadge({ sub, className = '' }) {
  const { t, tier } = useLabels();
  const { status, tone } = planState(sub);
  const text = status === 'LEGACY'
    ? t('subscription.noPlan', { defaultValue: 'No plan (unlimited)' })
    : status === 'EXPIRED'
      ? `${tier(sub.planTier)} · ${t('subscription.expired', { defaultValue: 'Expired' })}`.replace(/^ · /, '')
      : status === 'TRIAL'
        ? `${tier(sub.planTier)} · ${t('subscription.freeTrial', { defaultValue: 'Free trial' })}`
        : tier(sub.planTier);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}>
      {text}
    </span>
  );
}

export function DaysLeft({ sub }) {
  const { t } = useLabels();
  if (!sub?.subscriptionExpiresAt) return <span className="text-muted-foreground">{t('subscription.noExpiry', { defaultValue: 'No expiry' })}</span>;
  if (sub.isExpired) return <span className="text-red-600 font-medium">{t('subscription.expired', { defaultValue: 'Expired' })}</span>;
  const { tone } = planState(sub);
  const color = tone === 'danger' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : '';
  return (
    <span className={`font-medium ${color}`}>
      {sub.daysLeft === 1
        ? t('subscription.oneDayLeft', { defaultValue: '1 day left' })
        : t('subscription.nDaysLeft', { n: sub.daysLeft, defaultValue: '{{n}} days left' })}
    </span>
  );
}

// Plans & prices for one product line; the company's current tier highlighted.
export function PriceTable({ prices, currentTier }) {
  const { t, tier, period } = useLabels();
  const byTier = Object.fromEntries((prices || []).map((p) => [p.tier, p]));
  const users = (k) => (k === 'BASIC'
    ? t('subscription.usersAdminOnly', { defaultValue: 'Admin only' })
    : t('subscription.usersMultiple', { defaultValue: 'Multiple users & roles' }));
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{t('subscription.colPlan', { defaultValue: 'Plan' })}</th>
            <th className="px-3 py-2 text-left font-medium">{t('subscription.colUsers', { defaultValue: 'Users' })}</th>
            <th className="px-3 py-2 text-right font-medium">{t('subscription.colFirstPurchase', { defaultValue: 'First purchase (1 year)' })}</th>
            {BILLING_PERIODS.map((p) => <th key={p} className="px-3 py-2 text-right font-medium">{period(p)}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y">
          {PLAN_TIERS.filter((k) => byTier[k]).map((k) => {
            const row = byTier[k];
            const current = k === currentTier;
            return (
              <tr key={k} className={current ? 'bg-primary/5' : ''}>
                <td className="px-3 py-2 font-medium whitespace-nowrap">
                  {tier(k)}
                  {current && <span className="ml-1.5 text-[10px] text-primary font-semibold uppercase">{t('subscription.current', { defaultValue: 'Current' })}</span>}
                </td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{users(k)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNpr(row.installationFee)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNpr(row.monthly)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNpr(row.quarterly)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNpr(row.halfYearly)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNpr(row.yearly)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PaymentHistory({ payments }) {
  const { t, tier, period, method } = useLabels();
  if (!payments?.length) {
    return <p className="text-sm text-muted-foreground py-4 text-center">{t('subscription.noPayments', { defaultValue: 'No payments yet.' })}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{t('subscription.colReceipt', { defaultValue: 'Receipt' })}</th>
            <th className="px-3 py-2 text-left font-medium">{t('subscription.colPaidOn', { defaultValue: 'Paid on' })}</th>
            <th className="px-3 py-2 text-left font-medium">{t('subscription.colFor', { defaultValue: 'For' })}</th>
            <th className="px-3 py-2 text-left font-medium">{t('subscription.colCovers', { defaultValue: 'Covers' })}</th>
            <th className="px-3 py-2 text-left font-medium">{t('subscription.colMethod', { defaultValue: 'Method' })}</th>
            <th className="px-3 py-2 text-right font-medium">{t('subscription.colAmount', { defaultValue: 'Amount' })}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{p.receiptNumber}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.paidAt)}</td>
              <td className="px-3 py-2">
                <span className="font-medium">{tier(p.planTier)}</span>{' · '}
                {p.kind === 'ACTIVATION'
                  ? t('subscription.firstPurchase', { defaultValue: 'First purchase (1 year)' })
                  : period(p.period)}
                {p.note && <span className="block text-xs text-muted-foreground">{p.note}</span>}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(p.periodStart)} – {formatDate(p.periodEnd)}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {method(p.paymentMethod)}
                {p.reference && <span className="block text-xs text-muted-foreground">{p.reference}</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">{formatNpr(p.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
