import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { portalApi } from '@/api';
import { CalendarCheck } from 'lucide-react';
import { pageVariants, containerVariants, cardVariants, itemVariants } from '@/lib/portalAnimations';

const STATUS_CONFIG = {
  PRESENT: { label: 'Present', color: '#10B981', bg: '#F0FDF4' },
  LATE:    { label: 'Late',    color: '#F59E0B', bg: '#FFFBEB' },
  ABSENT:  { label: 'Absent',  color: '#F43F5E', bg: '#FFF1F2' },
  EXCUSED: { label: 'Excused', color: '#3B82F6', bg: '#EFF6FF' },
};

function AttendanceRing({ percentage }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Number(percentage) / 100) * circ;
  const color = percentage >= 75 ? '#10B981' : percentage >= 50 ? '#F59E0B' : '#F43F5E';

  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#E2E8F0" strokeWidth="8" />
        <motion.circle
          cx="50" cy="50" r={r}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.6, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-slate-900">{percentage}%</span>
        <span className="text-[10px] text-slate-500 font-medium">Attendance</span>
      </div>
    </div>
  );
}

export default function PortalAttendance() {
  const { data, isLoading } = useQuery({
    queryKey: ['portal-attendance'],
    queryFn: () => portalApi.attendance().then(r => r.data),
  });

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-NP', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="p-5 md:p-7 space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>

      {data?.summary && (
        <motion.div
          variants={containerVariants} initial="initial" animate="animate"
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <AttendanceRing percentage={data.summary.percentage} />
            <div className="grid grid-cols-3 gap-3 flex-1 w-full">
              {[
                { label: 'Total Days', value: data.summary.total,   color: '#64748B', bg: '#F8FAFC' },
                { label: 'Present',   value: data.summary.present,  color: '#10B981', bg: '#F0FDF4' },
                { label: 'Absent',    value: data.summary.absent,   color: '#F43F5E', bg: '#FFF1F2' },
              ].map(s => (
                <motion.div
                  key={s.label}
                  variants={cardVariants}
                  className="rounded-xl p-3 text-center border"
                  style={{ background: s.bg, borderColor: s.color + '30' }}
                >
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">{s.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading…</div>
        ) : !data?.records?.length ? (
          <div className="p-12 text-center">
            <CalendarCheck className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No attendance records yet</p>
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="initial" animate="animate">
            {data.records.map(r => {
              const cfg = STATUS_CONFIG[r.status] || { label: r.status, color: '#64748B', bg: '#F8FAFC' };
              return (
                <motion.div
                  key={r.id}
                  variants={itemVariants}
                  className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 last:border-0"
                >
                  <p className="text-sm text-slate-700">{fmtDate(r.date)}</p>
                  <div className="flex items-center gap-3">
                    {r.notes && <p className="text-xs text-slate-400 hidden sm:block">{r.notes}</p>}
                    <span
                      className="inline-flex px-3 py-1 rounded-full text-xs font-semibold"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
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
