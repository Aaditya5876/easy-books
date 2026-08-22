import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { portalApi } from '@/api';
import { ClipboardList } from 'lucide-react';
import { pageVariants, containerVariants, itemVariants } from '@/lib/portalAnimations';
import PortalFilterSelect from '@/components/portal/PortalFilterSelect';
import PortalPagination from '@/components/portal/PortalPagination';
import { useTranslation } from 'react-i18next';

const SUBJECT_COLORS = ['#3B82F6','#10B981','#8B5CF6','#F97316','#F43F5E','#14B8A6','#F59E0B','#6366F1'];
const PAGE_SIZE = 8;

function subjectColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xFFFFFF;
  return SUBJECT_COLORS[Math.abs(h) % SUBJECT_COLORS.length];
}

export default function PortalHomework() {
  const { t } = useTranslation();
  const [student, setStudent] = useState(null);
  const [subject, setSubject] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  useEffect(() => {
    try { setStudent(JSON.parse(localStorage.getItem('portal_student') || 'null')); } catch {}
  }, []);

  const { data: homework = [], isLoading } = useQuery({
    queryKey: ['portal-homework', student?.classId],
    queryFn: () => portalApi.homework(student?.classId).then(r => r.data),
    enabled: !!student,
  });

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-NP', { day: 'numeric', month: 'short', year: 'numeric' });
  const isOverdue = (d) => new Date(d) < new Date();

  const subjectOptions = useMemo(() => {
    const names = [...new Set(homework.map(h => h.subject?.name).filter(Boolean))];
    return [{ value: 'all', label: t('portal.allSubjects', { defaultValue: 'All Subjects' }) }, ...names.map(n => ({ value: n, label: n }))];
  }, [homework, t]);

  const filtered = useMemo(() => {
    const sorted = [...homework].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    return sorted
      .filter(h => subject === 'all' || h.subject?.name === subject)
      .filter(h => status === 'all' || (status === 'overdue' ? isOverdue(h.dueDate) : !isOverdue(h.dueDate)));
  }, [homework, subject, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const setSubjectFiltered = (v) => { setSubject(v); setPage(1); };
  const setStatusFiltered  = (v) => { setStatus(v); setPage(1); };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="p-5 md:p-7 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{t('portal.homework', { defaultValue: 'Homework' })}</h1>
          {homework.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full">
              {t('portal.nAssigned', { defaultValue: '{{count}} assigned', count: homework.length })}
            </span>
          )}
        </div>
        {homework.length > 0 && (
          <div className="flex items-center gap-2">
            <PortalFilterSelect value={status} onChange={setStatusFiltered} options={[
              { value: 'all', label: t('portal.allStatuses', { defaultValue: 'All' }) },
              { value: 'overdue', label: t('portal.overdue', { defaultValue: 'Overdue' }) },
              { value: 'upcoming', label: t('portal.upcoming', { defaultValue: 'Upcoming' }) },
            ]} />
            {subjectOptions.length > 2 && (
              <PortalFilterSelect value={subject} onChange={setSubjectFiltered} options={subjectOptions} />
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">{t('portal.loading', { defaultValue: 'Loading…' })}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            {homework.length === 0
              ? t('portal.noHomework', { defaultValue: 'No homework assigned yet' })
              : t('portal.noHomeworkMatch', { defaultValue: 'No homework matches this filter' })}
          </p>
        </div>
      ) : (
        <>
          <motion.div key={page} variants={containerVariants} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {paged.map(h => {
              const overdue = isOverdue(h.dueDate);
              const color   = subjectColor(h.subject?.name || '');
              return (
                <motion.div key={h.id} variants={itemVariants}>
                  <div
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex"
                    style={{ borderLeft: `4px solid ${overdue ? '#F43F5E' : color}` }}
                  >
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 leading-tight">{h.title}</p>
                          {h.subject && (
                            <p className="text-xs font-semibold mt-1" style={{ color }}>
                              {h.subject.name}
                            </p>
                          )}
                          {h.description && (
                            <p className="text-sm text-slate-500 mt-2 leading-relaxed">{h.description}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${overdue ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                            {overdue ? t('portal.overdue', { defaultValue: '⚠ Overdue' }) : t('portal.due', { defaultValue: 'Due' })}
                          </span>
                          <p className="text-xs text-slate-400 mt-1">{fmtDate(h.dueDate)}</p>
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
