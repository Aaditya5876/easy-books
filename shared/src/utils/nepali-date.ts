const BS_MONTHS_DAYS: number[][] = [
  [],
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [31, 31, 32, 31, 31, 31, 30, 30, 30, 29, 30, 30],
];

const BS_YEAR_START = 2000;
const AD_YEAR_START = 1943;
const AD_MONTH_START = 4;
const AD_DAY_START = 14;

export function adToBs(adDate: Date): string {
  let totalDays = Math.floor(
    (adDate.getTime() - new Date(AD_YEAR_START, AD_MONTH_START - 1, AD_DAY_START).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  let bsYear = BS_YEAR_START;
  let bsMonth = 1;
  let bsDay = 1;

  for (let i = 1; i < BS_MONTHS_DAYS.length; i++) {
    for (let j = 0; j < 12; j++) {
      const daysInMonth = BS_MONTHS_DAYS[i][j];
      if (totalDays < daysInMonth) {
        bsYear = BS_YEAR_START + i - 1;
        bsMonth = j + 1;
        bsDay = totalDays + 1;
        return `${bsYear}-${String(bsMonth).padStart(2, '0')}-${String(bsDay).padStart(2, '0')}`;
      }
      totalDays -= daysInMonth;
    }
  }

  return '';
}

export function bsToAd(bsDate: string): Date {
  const [bsYear, bsMonth, bsDay] = bsDate.split('-').map(Number);
  const yearIndex = bsYear - BS_YEAR_START + 1;

  let totalDays = 0;
  for (let i = 1; i < yearIndex; i++) {
    for (let j = 0; j < 12; j++) {
      totalDays += BS_MONTHS_DAYS[i][j];
    }
  }
  for (let j = 0; j < bsMonth - 1; j++) {
    totalDays += BS_MONTHS_DAYS[yearIndex][j];
  }
  totalDays += bsDay - 1;

  const startDate = new Date(AD_YEAR_START, AD_MONTH_START - 1, AD_DAY_START);
  startDate.setDate(startDate.getDate() + totalDays);
  return startDate;
}

export function todayBs(): string {
  return adToBs(new Date());
}
