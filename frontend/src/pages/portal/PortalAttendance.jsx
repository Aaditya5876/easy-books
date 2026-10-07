import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { portalApi } from '@/api';
import { CalendarCheck } from 'lucide-react';
import { pageVariants, containerVariants, itemVariants } from '@/lib/portalAnimations';
import PortalFilterSelect from '@/components/portal/PortalFilterSelect';
import PortalRing from '@/components/portal/PortalRing';
import { useTranslation } from 'react-i18next';

const STATUS_CONFIG = {
  PRESENT: { label: 'Present', labelKey: 'portal.present', color: '#10B981', bg: '#F0FDF4' },
  LATE:    { label: 'Late',    labelKey: 'portal.late',    color: '#F59E0B', bg: '#FFFBEB' },
  ABSENT:  { label: 'Absent',  labelKey: 'portal.absent',  color: '#F43F5E', bg: '#FFF1F2' },
  EXCUSED: { label: 'Excused', labelKey: 'portal.excused', color: '#3B82F6', bg: '#EFF6FF' },
};

const ringColor = (pct) => (pct >= 75 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#F43F5E');

const MONTH_FMT = (ym) => {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-NP', { month: 'long', year: 'numeric' });
};

export default function PortalAttendance() {
  const { t } = useTranslation();
  const [month, setMonth] = useState('all');
  const { data, isLoading } = useQuery({
    queryKey: ['portal-attendance'],
    queryFn: () => portalApi.attendance().then(r => r.data),
  });

  const records = data?.records || [];

  const monthOptions = useMemo(() => {
    const set = new Set(records.map(r => r.date.slice(0, 7)));
    return [...set].sort().reverse();
  }, [records]);

  const filtered = useMemo(
    () => (month === 'all' ? records : records.filter(r => r.date.slice(0, 7) === month)),
    [records, month],
  );

  const stats = useMemo(() => {
    const total = filtered.length;
    const present = filtered.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
    const absent = filtered.filter(r => r.status === 'ABSENT').length;
    return { total, present, absent, percentage: total ? Math.round((present / total) * 100) : 0 };
  }, [filtered]);

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-NP', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="p-5 md:p-7 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{t('portal.attendance', { defaultValue: 'Attendance' })}</h1>
        {monthOptions.length > 0 && (
          <PortalFilterSelect value={month} onChange={setMonth} options={[
            { value: 'all', label: t('portal.allTime', { defaultValue: 'All time' }) },
            ...monthOptions.map(ym => ({ value: ym, label: MONTH_FMT(ym) })),
          ]} />
        )}
      </div>

      {/* Summary band — one horizontal card, never mismatched in height against the list below */}
      {data?.summary && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="rounded-3xl p-6 shadow-sm border border-slate-200 bg-gradient-to-br from-white to-slate-50 flex flex-col sm:flex-row items-center gap-6"
        >
          <PortalRing percentage={stats.percentage} color={ringColor(stats.percentage)} label={t('portal.attended', { defaultValue: 'Attended' })} />
          <div className="grid grid-cols-3 gap-3 w-full">
            {[
              { label: t('portal.totalDays', { defaultValue: 'Total Days' }), value: stats.total,   color: '#475569', bg: '#F8FAFC' },
              { label: t('portal.present', { defaultValue: 'Present' }),      value: stats.present, color: '#10B981', bg: '#F0FDF4' },
              { label: t('portal.absent', { defaultValue: 'Absent' }),        value: stats.absent,  color: '#F43F5E', bg: '#FFF1F2' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-4 text-center border" style={{ background: s.bg, borderColor: s.color + '25' }}>
                <p className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Full-width record list */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            {month === 'all' ? t('portal.allRecords', { defaultValue: 'All Records' }) : MONTH_FMT(month)}
          </h2>
          <span className="text-xs text-slate-400">{t('portal.nDays', { defaultValue: '{{count}} days', count: filtered.length })}</span>
        </div>
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">{t('portal.loading', { defaultValue: 'Loading…' })}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarCheck className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">{t('portal.noAttendanceRecords', { defaultValue: 'No attendance records yet' })}</p>
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="initial" animate="animate" className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-slate-100">
            {filtered.map((r, i) => {
              const cfg = STATUS_CONFIG[r.status] || { label: r.status, color: '#64748B', bg: '#F8FAFC' };
              return (
                <motion.div
                  key={r.id}
                  variants={itemVariants}
                  className={`flex items-center justify-between px-5 py-3.5 border-b border-slate-100 sm:[&:nth-last-child(-n+2)]:border-b-0 ${i % 2 === 0 ? 'sm:border-r sm:border-slate-100' : ''}`}
                >
                  <p className="text-sm text-slate-700">{fmtDate(r.date)}</p>
                  <div className="flex items-center gap-3">
                    {r.notes && <p className="text-xs text-slate-400 hidden md:block max-w-[160px] truncate">{r.notes}</p>}
                    <span
                      className="inline-flex px-3 py-1 rounded-full text-xs font-semibold"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {cfg.labelKey ? t(cfg.labelKey, { defaultValue: cfg.label }) : cfg.label}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
