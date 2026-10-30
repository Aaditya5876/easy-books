import { nepalDateKey, nepalToday, nepalMidnight, nepalMonthStart, nepalYearStart, addDays } from '../../core/utils/nepal-time';

// Production servers run on UTC; Nepal is UTC+5:45. "Today" must be Nepal's
// date at every hour — including 00:00–05:45 Nepal time, when UTC is still on
// the previous day.
describe('nepal-time', () => {
  const earlyMorning = new Date('2026-10-28T20:00:00Z'); // 01:45 on 29 Oct in Nepal
  const afternoon = new Date('2026-10-29T09:00:00Z');    // 14:45 on 29 Oct in Nepal

  it('gives Nepal\'s calendar date, not UTC\'s', () => {
    expect(nepalDateKey(earlyMorning)).toBe('2026-10-29');
    expect(nepalDateKey(afternoon)).toBe('2026-10-29');
  });

  it('nepalToday matches how date-only columns are stored (UTC midnight of that date)', () => {
    expect(nepalToday(earlyMorning).toISOString()).toBe('2026-10-29T00:00:00.000Z');
    expect(addDays(nepalToday(earlyMorning), 1).toISOString()).toBe('2026-10-30T00:00:00.000Z');
  });

  it('nepalMidnight is the real instant the Nepal day began (for timestamps)', () => {
    expect(nepalMidnight(afternoon).toISOString()).toBe('2026-10-28T18:15:00.000Z');
  });

  it('month and year starts follow Nepal\'s date', () => {
    const newYearsEve = new Date('2026-12-31T19:00:00Z'); // 00:45 on 1 Jan 2027 in Nepal
    expect(nepalMonthStart(newYearsEve).toISOString()).toBe('2026-12-31T18:15:00.000Z');
    expect(nepalYearStart(newYearsEve).toISOString()).toBe('2026-12-31T18:15:00.000Z');
  });
});
