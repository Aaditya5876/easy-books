// Nepali (BS) Calendar Utility
// Mapping of BS year months (days in each month)
const BS_CALENDAR_DATA = {
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2081: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2082: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2083: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2084: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2085: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2086: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2087: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2088: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  2089: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2090: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
};

// Reference date: BS 2080-01-01 = AD 2023-04-14
const BS_REF = { year: 2080, month: 1, day: 1 };
const AD_REF = new Date(2023, 3, 14); // April 14, 2023

const NEPALI_MONTHS = [
  'Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getDaysInBsMonth(year, month) {
  if (BS_CALENDAR_DATA[year]) {
    return BS_CALENDAR_DATA[year][month - 1] || 30;
  }
  // Fallback approximation
  const defaultDays = [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30];
  return defaultDays[month - 1] || 30;
}

function getDaysInBsYear(year) {
  let total = 0;
  for (let m = 1; m <= 12; m++) {
    total += getDaysInBsMonth(year, m);
  }
  return total;
}

// Convert AD date to BS
export function adToBs(adDate) {
  const date = new Date(adDate);
  const diffDays = Math.floor((date - AD_REF) / (1000 * 60 * 60 * 24));
  
  let bsYear = BS_REF.year;
  let bsMonth = BS_REF.month;
  let bsDay = BS_REF.day;
  
  let remainingDays = diffDays;
  
  if (remainingDays >= 0) {
    // Forward calculation
    while (remainingDays > 0) {
      const daysInMonth = getDaysInBsMonth(bsYear, bsMonth);
      const daysLeftInMonth = daysInMonth - bsDay;
      
      if (remainingDays <= daysLeftInMonth) {
        bsDay += remainingDays;
        remainingDays = 0;
      } else {
        remainingDays -= (daysLeftInMonth + 1);
        bsMonth++;
        bsDay = 1;
        if (bsMonth > 12) {
          bsMonth = 1;
          bsYear++;
        }
      }
    }
  } else {
    // Backward calculation
    remainingDays = Math.abs(remainingDays);
    while (remainingDays > 0) {
      if (remainingDays < bsDay) {
        bsDay -= remainingDays;
        remainingDays = 0;
      } else {
        remainingDays -= bsDay;
        bsMonth--;
        if (bsMonth < 1) {
          bsMonth = 12;
          bsYear--;
        }
        bsDay = getDaysInBsMonth(bsYear, bsMonth);
      }
    }
  }
  
  return {
    year: bsYear,
    month: bsMonth,
    day: bsDay,
    formatted: `${bsYear}-${String(bsMonth).padStart(2, '0')}-${String(bsDay).padStart(2, '0')}`,
    monthName: NEPALI_MONTHS[bsMonth - 1]
  };
}

// Get today's BS date
export function getTodayBS() {
  return adToBs(new Date());
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