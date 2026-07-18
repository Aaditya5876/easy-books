import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { portalApi } from '@/api';
import { Clock } from 'lucide-react';
import { pageVariants, containerVariants, cardVariants } from '@/lib/portalAnimations';
import { useTranslation } from 'react-i18next';

const DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
const DAY_LABEL = { MONDAY:'Monday', TUESDAY:'Tuesday', WEDNESDAY:'Wednesday', THURSDAY:'Thursday', FRIDAY:'Friday', SATURDAY:'Saturday' };
const DAY_KEYS  = { MONDAY:'portal.monday', TUESDAY:'portal.tuesday', WEDNESDAY:'portal.wednesday', THURSDAY:'portal.thursday', FRIDAY:'portal.friday', SATURDAY:'portal.saturday' };
const DAY_SHORT = { MONDAY:'Mon', TUESDAY:'Tue', WEDNESDAY:'Wed', THURSDAY:'Thu', FRIDAY:'Fri', SATURDAY:'Sat' };

const SUBJECT_COLORS = ['#3B82F6','#10B981','#8B5CF6','#F97316','#F43F5E','#14B8A6','#F59E0B','#6366F1'];
function subjectColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xFFFFFF;
  return SUBJECT_COLORS[Math.abs(h) % SUBJECT_COLORS.length];
}

const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

export default function PortalTimetable() {
  const { t } = useTranslation();
  const [student, setStudent] = useState(null);
  useEffect(() => {
    try { setStudent(JSON.parse(localStorage.getItem('portal_student') || 'null')); } catch {}
  }, []);

  const { data: timetable = [], isLoading } = useQuery({
    queryKey: ['portal-timetable', student?.classId],
    queryFn: () => portalApi.timetable(student?.classId).then(r => r.data),
    enabled: !!student,
  });

  const byDay = DAYS.reduce((acc, d) => {
    acc[d] = timetable.filter(e => e.dayOfWeek === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
    return acc;
  }, {});

  const activeDays = DAYS.filter(d => byDay[d].length > 0);

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="p-5 md:p-7 space-y-5 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900">{t('portal.routine', { defaultValue: 'Routine' })}</h1>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">{t('portal.loading', { defaultValue: 'Loading…' })}</div>
      ) : timetable.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Clock className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">{t('portal.noRoutine', { defaultValue: 'No routine set for your class yet' })}</p>
        </div>
      ) : (
        <motion.div variants={containerVariants} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeDays.map(day => {
            const isToday = day === today;
            return (
              <motion.div key={day} variants={cardVariants} className={`bg-white rounded-2xl border overflow-hidden shadow-sm ${isToday ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}>
                {/* Day header */}
                <div className={`px-4 py-3 flex items-center justify-between ${isToday ? 'bg-blue-600' : 'bg-slate-800'}`}>
                  <h2 className="font-bold text-sm text-white">{t(DAY_KEYS[day], { defaultValue: DAY_LABEL[day] })}</h2>
                  {isToday && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-white/20 text-white rounded-full tracking-wide">
                      {t('portal.today', { defaultValue: 'TODAY' })}
                    </span>
                  )}
                </div>

                {/* Periods */}
                <div className="divide-y divide-slate-100">
                  {byDay[day].map((e, i) => {
                    const subjectName = e.subject?.name || e.subjectName || '—';
                    const color = subjectColor(subjectName);
                    return (
                      <motion.div
                        key={e.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * i }}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <div className="text-center shrink-0">
                          <p className="text-[10px] text-slate-400 font-medium tabular-nums">{e.startTime}</p>
                          <div className="w-px h-2 bg-slate-200 mx-auto my-0.5" />
                          <p className="text-[10px] text-slate-400 font-medium tabular-nums">{e.endTime}</p>
                        </div>
                        <div
                          className="w-1 h-10 rounded-full shrink-0"
                          style={{ background: color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{subjectName}</p>
                          {e.teacherName && <p className="text-xs text-slate-400 truncate">{e.teacherName}</p>}
                          {e.room && <p className="text-xs text-slate-400">{t('portal.room', { defaultValue: 'Room {{room}}', room: e.room })}</p>}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
