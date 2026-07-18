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
