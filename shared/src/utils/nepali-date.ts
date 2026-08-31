import NepaliDate from 'nepali-date-converter';

/**
 * Converts an AD (Gregorian) date to a BS (Bikram Sambat) "YYYY-MM-DD" string.
 * Backed by the `nepali-date-converter` calendar table (BS 2000-2090, i.e. AD ~1943-2033).
 */
export function adToBs(adDate: Date): string {
  const nd = new NepaliDate(adDate);
  const year = nd.getYear();
  const month = nd.getMonth() + 1;
  const day = nd.getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Converts a BS "YYYY-MM-DD" string to an AD Date. Throws if the BS date falls
 * outside the supported range (BS 2000-2090) instead of silently corrupting data.
 */
export function bsToAd(bsDate: string): Date {
  return new NepaliDate(bsDate).toJsDate();
}

export function todayBs(): string {
  return adToBs(new Date());
}

/**
 * The BS "YYYY-MM" bucket a given AD date falls in — the canonical format for
 * FeeInvoice.month, so a manual billing run and the nightly auto-billing cron
 * always land in the same bucket regardless of which one created the invoice.
 */
export function bsYearMonth(adDate: Date): string {
  return adToBs(adDate).split('-').slice(0, 2).join('-');
}

const BS_YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** True for a strict BS "YYYY-MM" string, e.g. "2083-05". */
export function isValidBsYearMonth(value: string): boolean {
  return BS_YEAR_MONTH_RE.test(value);
}

// ── Fiscal Year (Nepal: fixed Shrawan 1 – Ashadh end, not configurable) ──────
// Canonical source for what several services previously each hand-rolled
// independently (invoice/purchase/quotation/credit-note/debit-note numbering,
// the dashboard's "this fiscal year" widget) — same "2082-83"-style label,
// same Shrawan(month 4)-start rule, computed in exactly one place.

/** The fiscal-year label (e.g. "2082-83") a BS year+month falls into. BS months are 1-indexed (Baishakh=1 … Chaitra=12); the fiscal year starts at Shrawan (month 4). */
export function bsFiscalYearOf(bsYear: number, bsMonth: number): string {
  const fyStart = bsMonth >= 4 ? bsYear : bsYear - 1;
  return `${fyStart}-${String(fyStart + 1).slice(-2)}`;
}

/** The fiscal-year label the given AD date (default: now) falls into. */
export function bsFiscalYearOfAd(adDate: Date = new Date()): string {
  const [y, m] = adToBs(adDate).split('-').map(Number);
  return bsFiscalYearOf(y, m);
}

/** The fiscal year currently in progress, e.g. "2082-83". */
export function currentBsFiscalYear(): string {
  return bsFiscalYearOfAd(new Date());
}

/**
 * AD start/end instants for a fiscal-year label, e.g. "2082-83" → Shrawan 1
 * 2082 through the last instant of Ashadh 2083. `endAd` is exclusive-safe:
 * it's 1ms before the next fiscal year starts, so `< endAd` / `<= endAd` both
 * work as "within this fiscal year."
 */
export function fiscalYearAdRange(fiscalYearLabel: string): { startAd: Date; endAd: Date } {
  const fyStart = parseInt(fiscalYearLabel.split('-')[0], 10);
  const startAd = bsToAd(`${fyStart}-04-01`);
  const endAd = new Date(bsToAd(`${fyStart + 1}-04-01`).getTime() - 1);
  return { startAd, endAd };
}

/** Has this fiscal year's end date already passed? */
export function isFiscalYearEnded(fiscalYearLabel: string, now: Date = new Date()): boolean {
  return fiscalYearAdRange(fiscalYearLabel).endAd < now;
}
