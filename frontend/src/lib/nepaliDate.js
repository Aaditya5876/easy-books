// Nepali (BS) Calendar Utility — backed by the `nepali-date-converter` library
// (same one used server-side in @easy-books/shared) so frontend and backend
// agree on both the epoch and the calendar data instead of maintaining two
// independent, short-lived hand-rolled tables.
import NepaliDate from 'nepali-date-converter';

const NEPALI_MONTHS = [
  'Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Convert AD date to BS
export function adToBs(adDate) {
  const nd = new NepaliDate(new Date(adDate));
  const year = nd.getYear();
  const month = nd.getMonth() + 1; // NepaliDate months are 0-indexed
  const day = nd.getDate();

  return {
    year,
    month,
    day,
    formatted: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    monthName: NEPALI_MONTHS[month - 1],
  };
}

// Get today's BS date
export function getTodayBS() {
  return adToBs(new Date());
}

// Convert BS date (year, month, day) to AD Date object
export function bsToAd(bsYear, bsMonth, bsDay) {
  return new NepaliDate(bsYear, bsMonth - 1, bsDay).toJsDate();
}

// Number of days in a given BS month (29-32, varies by year) — derived from the
// real calendar table via the AD gap between this month's start and the next,
// rather than guessed, since BS month lengths aren't a fixed pattern.
export function daysInBsMonth(bsYear, bsMonth) {
  const thisStart = bsToAd(bsYear, bsMonth, 1);
  const nextYear = bsMonth === 12 ? bsYear + 1 : bsYear;
  const nextMonth = bsMonth === 12 ? 1 : bsMonth + 1;
  const nextStart = bsToAd(nextYear, nextMonth, 1);
  return Math.round((nextStart - thisStart) / 86400000);
}

// Format BS date string
export function formatBsDate(bsDateStr) {
  if (!bsDateStr) return '';
  const parts = bsDateStr.split('-');
  if (parts.length !== 3) return bsDateStr;
  const month = parseInt(parts[1]) - 1;
  return `${parts[2]} ${NEPALI_MONTHS[month] || ''} ${parts[0]}`;
}

// Format a canonical invoice-month string ("2083-05") as "Bhadra 2083" for
// display. Falls back to the raw string for anything that isn't strict
// "YYYY-MM" (e.g. legacy/free-form data), so it never throws on bad input.
export function formatBsYearMonth(yearMonth) {
  if (!yearMonth) return '';
  const parts = yearMonth.split('-');
  if (parts.length !== 2) return yearMonth;
  const [year, month] = parts;
  const idx = parseInt(month, 10) - 1;
  return NEPALI_MONTHS[idx] ? `${NEPALI_MONTHS[idx]} ${year}` : yearMonth;
}

// Get current fiscal year in BS
export function getCurrentFiscalYear() {
  const today = getTodayBS();
  // Fiscal year starts from Shrawan (month 4) to Ashadh (month 3)
  if (today.month >= 4) {
    return `${today.year}/${today.year + 1}`;
  }
  return `${today.year - 1}/${today.year}`;
}

export { NEPALI_MONTHS, ENGLISH_MONTHS };
