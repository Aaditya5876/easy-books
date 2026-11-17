// "101-110" → 101…110, "T1-T8" → T1…T8, "A, B, C" → A, B, C (mixable).
export function parseSpaceNames(text) {
  const out = [];
  for (const part of String(text || '').split(',')) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^([A-Za-z-]*?)(\d+)\s*-\s*\1?(\d+)$/);
    if (m) {
      const [, prefix, a, b] = m;
      const from = parseInt(a, 10);
      const to = parseInt(b, 10);
      if (to >= from && to - from < 500) {
        const width = a.length > 1 && a.startsWith('0') ? a.length : 0;
        for (let i = from; i <= to; i++) out.push(`${prefix}${width ? String(i).padStart(width, '0') : i}`);
        continue;
      }
    }
    out.push(p);
  }
  // First spelling wins on case-insensitive duplicates.
  const seen = new Set();
  return out.filter((x) => !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()));
}

export const SPACE_STATUS_STYLE = {
  FREE: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30',
  OCCUPIED: 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
  RESERVED: 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
  CLEANING: 'border-sky-300 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30',
  OUT_OF_SERVICE: 'border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/50',
};

export function spaceStatusLabel(t, s) {
  return {
    FREE: t('spaces.statusFree', { defaultValue: 'Free' }),
    OCCUPIED: t('spaces.statusOccupied', { defaultValue: 'Occupied' }),
    RESERVED: t('spaces.statusReserved', { defaultValue: 'Reserved' }),
    CLEANING: t('spaces.statusCleaning', { defaultValue: 'Cleaning' }),
    OUT_OF_SERVICE: t('spaces.statusOutOfService', { defaultValue: 'Out of service' }),
  }[s] || s;
}

export function rateUnitLabel(t, u) {
  return {
    NIGHT: t('spaces.perNight', { defaultValue: 'per night' }),
    DAY: t('spaces.perDay', { defaultValue: 'per day' }),
    HOUR: t('spaces.perHour', { defaultValue: 'per hour' }),
    VISIT: t('spaces.perVisit', { defaultValue: 'per visit' }),
  }[u] || '';
}

// "2h 15m" / "3d 4h" since a time.
export function since(date) {
  if (!date) return '';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
