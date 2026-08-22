import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { portalApi } from '@/api';
import apiClient from '@/api/client';
import { BookOpen, Download } from 'lucide-react';
import { pageVariants, containerVariants, itemVariants } from '@/lib/portalAnimations';
import PortalFilterSelect from '@/components/portal/PortalFilterSelect';
import PortalPagination from '@/components/portal/PortalPagination';
import { useTranslation } from 'react-i18next';

const FILE_TYPE_ICONS = { pdf: '📄', doc: '📝', docx: '📝', image: '🖼️', other: '📎' };
const PAGE_SIZE = 9;

function resolveFileUrl(url = '') {
  return url.startsWith('http') ? url : `${apiClient.defaults.baseURL}${url}`;
}

const SUBJECT_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F97316', '#F43F5E', '#14B8A6', '#F59E0B', '#6366F1'];
function subjectColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xFFFFFF;
  return SUBJECT_COLORS[Math.abs(h) % SUBJECT_COLORS.length];
}

export default function PortalStudyMaterials() {
  const { t } = useTranslation();
  const [student, setStudent] = useState(null);
  const [subject, setSubject] = useState('all');
  const [page, setPage] = useState(1);
  useEffect(() => {
    try { setStudent(JSON.parse(localStorage.getItem('portal_student') || 'null')); } catch {}
  }, []);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['portal-study-materials', student?.classId],
    queryFn: () => portalApi.studyMaterials(student?.classId).then(r => r.data),
    enabled: !!student,
  });

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-NP', { day: 'numeric', month: 'short', year: 'numeric' });

  const subjectOptions = useMemo(() => {
    const names = [...new Set(materials.map(m => m.subject?.name).filter(Boolean))];
    return [{ value: 'all', label: t('portal.allSubjects', { defaultValue: 'All Subjects' }) }, ...names.map(n => ({ value: n, label: n }))];
  }, [materials, t]);

  const filtered = useMemo(
    () => subject === 'all' ? materials : materials.filter(m => m.subject?.name === subject),
    [materials, subject],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const setSubjectFiltered = (v) => { setSubject(v); setPage(1); };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="p-5 md:p-7 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{t('portal.studyMaterials', { defaultValue: 'Study Materials' })}</h1>
          {materials.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full">
              {t('portal.nFiles', { defaultValue: '{{count}} files', count: materials.length })}
            </span>
          )}
        </div>
        {subjectOptions.length > 2 && (
          <PortalFilterSelect value={subject} onChange={setSubjectFiltered} options={subjectOptions} />
        )}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">{t('portal.loading', { defaultValue: 'Loading…' })}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            {materials.length === 0
              ? t('portal.noStudyMaterials', { defaultValue: 'No study materials shared yet' })
              : t('portal.noStudyMaterialsMatch', { defaultValue: 'No materials match this filter' })}
          </p>
        </div>
      ) : (
        <>
          <motion.div key={page} variants={containerVariants} initial="initial" animate="animate" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {paged.map(m => {
              const color = subjectColor(m.subject?.name || '');
              return (
                <motion.div key={m.id} variants={itemVariants}>
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3 h-full">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl leading-none">{FILE_TYPE_ICONS[m.fileType] || FILE_TYPE_ICONS.other}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{m.title}</p>
                        {m.subject && (
                          <p className="text-xs font-semibold mt-1" style={{ color }}>{m.subject.name}</p>
                        )}
                      </div>
                    </div>
                    {m.description && <p className="text-xs text-slate-500 leading-relaxed">{m.description}</p>}
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                      <p className="text-[11px] text-slate-400">{fmtDate(m.createdAt)}</p>
                      <a href={resolveFileUrl(m.fileUrl)} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                        <Download className="w-3.5 h-3.5" /> {t('portal.download', { defaultValue: 'Download' })}
                      </a>
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
