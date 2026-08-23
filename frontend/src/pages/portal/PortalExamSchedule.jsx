import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { portalApi } from '@/api';
import { GraduationCap } from 'lucide-react';
import { pageVariants, containerVariants, itemVariants } from '@/lib/portalAnimations';
import PortalFilterSelect from '@/components/portal/PortalFilterSelect';
import PortalPagination from '@/components/portal/PortalPagination';
import PortalPageHeader from '@/components/portal/PortalPageHeader';
import { useTranslation } from 'react-i18next';

const SUBJECT_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F97316', '#F43F5E', '#14B8A6', '#F59E0B', '#6366F1'];
const PAGE_SIZE = 8;
function subjectColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xFFFFFF;
  return SUBJECT_COLORS[Math.abs(h) % SUBJECT_COLORS.length];
}

export default function PortalExamSchedule() {
  const { t } = useTranslation();
  const [student, setStudent] = useState(null);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  useEffect(() => {
    try { setStudent(JSON.parse(localStorage.getItem('portal_student') || 'null')); } catch {}
  }, []);

  const { data: schedule = [], isLoading } = useQuery({
    queryKey: ['portal-exam-schedule', student?.classId],
    queryFn: () => portalApi.examSchedule(student?.classId).then(r => r.data),
    enabled: !!student,
  });

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-NP', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const isPast = (d) => new Date(d) < new Date(new Date().toDateString());

  const sorted = useMemo(() => [...schedule].sort((a, b) => new Date(a.examDate) - new Date(b.examDate)), [schedule]);
  const filtered = useMemo(
    () => sorted.filter(e => status === 'all' || (status === 'completed' ? isPast(e.examDate) : !isPast(e.examDate))),
    [sorted, status],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const setStatusFiltered = (v) => { setStatus(v); setPage(1); };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="p-5 md:p-7 space-y-4 max-w-7xl mx-auto">
      <PortalPageHeader
        icon={GraduationCap}
        title={t('portal.examSchedule', { defaultValue: 'Exam Schedule' })}
        badge={schedule.length > 0 ? t('portal.nExams', { defaultValue: '{{count}} exams', count: schedule.length }) : null}
        action={schedule.length > 0 && (
          <PortalFilterSelect value={status} onChange={setStatusFiltered} options={[
            { value: 'all', label: t('portal.allStatuses', { defaultValue: 'All' }) },
            { value: 'upcoming', label: t('portal.upcoming', { defaultValue: 'Upcoming' }) },
            { value: 'completed', label: t('portal.completed', { defaultValue: 'Completed' }) },
          ]} />
        )}
      />

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">{t('portal.loading', { defaultValue: 'Loading…' })}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <GraduationCap className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            {schedule.length === 0
              ? t('portal.noExamSchedule', { defaultValue: 'No exam schedule published yet' })
              : t('portal.noExamScheduleMatch', { defaultValue: 'No exams match this filter' })}
          </p>
        </div>
      ) : (
        <>
          <motion.div key={page} variants={containerVariants} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {paged.map(e => {
              const past = isPast(e.examDate);
              const color = subjectColor(e.subject?.name || e.examName || '');
              return (
                <motion.div key={e.id} variants={itemVariants}>
                  <div
                    className={`bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex ${past ? 'opacity-60' : ''}`}
                    style={{ borderLeft: `4px solid ${color}` }}
                  >
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 leading-tight">{e.examName}</p>
                          {e.subject && (
                            <p className="text-xs font-semibold mt-1" style={{ color }}>{e.subject.name}</p>
                          )}
                          {e.roomNumber && (
                            <p className="text-xs text-slate-500 mt-1">{t('portal.room', { defaultValue: 'Room {{room}}', room: e.roomNumber })}</p>
                          )}
                          {e.notes && <p className="text-sm text-slate-500 mt-2 leading-relaxed">{e.notes}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${past ? 'bg-slate-100 text-slate-500' : 'bg-purple-100 text-purple-700'}`}>
                            {past ? t('portal.completed', { defaultValue: 'Completed' }) : t('portal.upcoming', { defaultValue: 'Upcoming' })}
                          </span>
                          <p className="text-xs text-slate-400 mt-1">{fmtDate(e.examDate)}</p>
                          {(e.startTime || e.endTime) && (
                            <p className="text-xs text-slate-400">{e.startTime}{e.startTime && e.endTime ? ' – ' : ''}{e.endTime}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
          <PortalPagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </motion.div>
  );
}
