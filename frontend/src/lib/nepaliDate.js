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

// Format BS date string
export function formatBsDate(bsDateStr) {
  if (!bsDateStr) return '';
  const parts = bsDateStr.split('-');
  if (parts.length !== 3) return bsDateStr;
  const month = parseInt(parts[1]) - 1;
  return `${parts[2]} ${NEPALI_MONTHS[month] || ''} ${parts[0]}`;
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
