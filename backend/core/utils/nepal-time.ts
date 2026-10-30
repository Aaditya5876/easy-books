// Calendar dates in Nepal time, independent of the server's clock (UTC on
// Vercel). Date-only columns (attendance, exams, events) are stored as UTC
// midnight of the date, so compare those against nepalToday(); compare real
// timestamps (createdAt, paidAt) against nepalMidnight().
export const NEPAL_TZ = 'Asia/Kathmandu';
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

export function nepalDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: NEPAL_TZ }).format(now);
}

export function nepalToday(now = new Date()): Date {
  return new Date(`${nepalDateKey(now)}T00:00:00.000Z`);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const toInstant = (dateOnly: Date) => new Date(dateOnly.getTime() - NEPAL_OFFSET_MS);

export function nepalMidnight(now = new Date()): Date {
  return toInstant(nepalToday(now));
}

export function nepalMonthStart(now = new Date()): Date {
  const [y, m] = nepalDateKey(now).split('-');
  return toInstant(new Date(`${y}-${m}-01T00:00:00.000Z`));
}

export function nepalYearStart(now = new Date()): Date {
  return toInstant(new Date(`${nepalDateKey(now).slice(0, 4)}-01-01T00:00:00.000Z`));
}
