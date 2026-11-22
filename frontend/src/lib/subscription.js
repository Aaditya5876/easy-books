// Display helpers for OneBook plans (Settings → Subscription, the superadmin's
// plan dialog). The rules themselves live in @easy-books/shared/subscription.
import { addMonths, priceForPeriod, BILLING_PERIOD_MONTHS, FIRST_TERM_MONTHS } from '@easy-books/shared';

// status: LEGACY (set up before plans; no expiry) | TRIAL | ACTIVE | EXPIRED
// tone drives the colour: muted | info | ok | warn (≤30 days) | danger (≤7 days or expired)
export function planState(sub) {
  if (!sub?.planTier && !sub?.subscriptionExpiresAt) return { status: 'LEGACY', tone: 'muted' };
  if (sub.isExpired) return { status: 'EXPIRED', tone: 'danger' };
  if (sub.planStatus === 'TRIAL') return { status: 'TRIAL', tone: 'info' };
  const days = sub.daysLeft;
  if (days != null && days <= 7) return { status: 'ACTIVE', tone: 'danger' };
  if (days != null && days <= 30) return { status: 'ACTIVE', tone: 'warn' };
  return { status: 'ACTIVE', tone: 'ok' };
}

export const TONE_CLASSES = {
  muted: 'bg-secondary text-muted-foreground',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  warn: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  danger: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

// The price list's amount for what is being bought ('' when unknown).
export function defaultAmount(prices, tier, mode, period) {
  const row = (prices || []).find((p) => p.tier === tier);
  if (!row) return '';
  return mode === 'ACTIVATE' ? Number(row.installationFee) : priceForPeriod(row, period);
}

// When the plan would run until if saved now — same rule as the server:
// first purchase = a year from today; renewal adds to the current expiry, or
// to today if it already ran out.
export function projectedExpiry({ mode, period, currentExpiry, now = new Date() }) {
  if (mode === 'ACTIVATE') return addMonths(now, FIRST_TERM_MONTHS);
  const cur = currentExpiry ? new Date(currentExpiry) : null;
  const base = cur && cur.getTime() > now.getTime() ? cur : now;
  return addMonths(base, BILLING_PERIOD_MONTHS[period] || 0);
}

export function perMonth(row, period) {
  return Math.round(priceForPeriod(row, period) / BILLING_PERIOD_MONTHS[period]);
}

// Browsers run a setTimeout longer than 2^31-1 ms (~24.8 days) IMMEDIATELY —
// that used to pop "subscription has expired" on login for any plan ending
// more than 24.8 days out (every trial and yearly plan). null = don't set a
// timer: the page re-checks on the next load anyway. 0 = already expired.
const MAX_TIMER_MS = 2 ** 31 - 1;
export function expiryTimerDelay(expiresAt, now = Date.now()) {
  if (!expiresAt) return null;
  const at = new Date(expiresAt).getTime();
  if (!Number.isFinite(at)) return null;
  const delay = at - now;
  if (delay <= 0) return 0;
  return delay > MAX_TIMER_MS ? null : delay;
}

export const formatNpr =(n) => `Rs ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const formatDate = (d) => (d
  ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—');
