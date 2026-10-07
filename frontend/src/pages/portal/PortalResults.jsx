import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { portalApi } from '@/api';
import { Trophy, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { pageVariants, containerVariants, cardVariants } from '@/lib/portalAnimations';
import PortalFilterSelect from '@/components/portal/PortalFilterSelect';
import PortalPagination from '@/components/portal/PortalPagination';
import PortalRing from '@/components/portal/PortalRing';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 3;
const PASS_PCT = 40;

function tier(pct) {
  if (pct >= 80) return { label: 'Excellent', labelKey: 'portal.excellent', gradient: 'from-emerald-500 to-teal-600', color: '#10B981', bg: '#F0FDF4' };
  if (pct >= 60) return { label: 'Good', labelKey: 'portal.good', gradient: 'from-blue-500 to-indigo-600', color: '#3B82F6', bg: '#EFF6FF' };
  if (pct >= 40) return { label: 'Average', labelKey: 'portal.average', gradient: 'from-amber-500 to-orange-600', color: '#F59E0B', bg: '#FFFBEB' };
  return { label: 'Needs Work', labelKey: 'portal.needsWork', gradient: 'from-rose-500 to-red-600', color: '#F43F5E', bg: '#FFF1F2' };
}

function ScoreBar({ pct, color }) {
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
      />
    </div>
  );
}

export default function PortalResults() {
  const { t } = useTranslation();
  const [examFilter, setExamFilter] = useState('all');
  const [page, setPage] = useState(1);
  const { data: results = [], isLoading } = useQuery({
    queryKey: ['portal-results'],
    queryFn: () => portalApi.results().then(r => r.data),
  });

  // Group into exams, most recent first, with the summary stats a plain list
  // can't show at a glance: overall %, best/weakest subject, pass count.
  const exams = useMemo(() => {
    const byName = new Map();
    for (const r of results) {
      if (!byName.has(r.examName)) byName.set(r.examName, []);
      byName.get(r.examName).push(r);
    }
    return [...byName.entries()]
      .map(([examName, rows]) => {
        const withPct = rows.map(r => ({ ...r, pct: Number(r.totalMarks) > 0 ? (Number(r.marksObtained) / Number(r.totalMarks)) * 100 : 0 }));
        const totalObtained = rows.reduce((s, r) => s + Number(r.marksObtained), 0);
        const totalMax = rows.reduce((s, r) => s + Number(r.totalMarks), 0);
        const pct = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
        const sortedByPct = [...withPct].sort((a, b) => b.pct - a.pct);
        return {
          examName,
          rows: withPct,
          date: rows.reduce((max, r) => (new Date(r.examDate) > max ? new Date(r.examDate) : max), new Date(0)),
          totalObtained,
          totalMax,
          pct,
          best: sortedByPct[0],
          weakest: sortedByPct.length > 1 ? sortedByPct[sortedByPct.length - 1] : null,
          passedCount: withPct.filter(r => r.pct >= PASS_PCT).length,
        };
      })
      .sort((a, b) => b.date - a.date);
  }, [results]);

  const examOptions = useMemo(() => [
    { value: 'all', label: t('portal.allExams', { defaultValue: 'All Exams' }) },
    ...exams.map(e => ({ value: e.examName, label: e.examName })),
  ], [exams, t]);

  const filtered = examFilter === 'all' ? exams : exams.filter(e => e.examName === examFilter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const setExamFiltered = (v) => { setExamFilter(v); setPage(1); };
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-NP', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="p-5 md:p-7 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-slate-900">{t('portal.examResults', { defaultValue: 'Exam Results' })}</h1>
        {examOptions.length > 2 && (
          <PortalFilterSelect value={examFilter} onChange={setExamFiltered} options={examOptions} />
        )}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">{t('portal.loading', { defaultValue: 'Loading…' })}</div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Trophy className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">{t('portal.noExamResults', { defaultValue: 'No exam results yet' })}</p>
        </div>
      ) : (
        <>
          <motion.div key={page} variants={containerVariants} initial="initial" animate="animate" className="space-y-5">
            {paged.map(exam => {
              const g = tier(exam.pct);
              return (
                <motion.div key={exam.examName} variants={cardVariants} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                  {/* Hero header */}
                  <div className={`relative overflow-hidden bg-gradient-to-br ${g.gradient} px-6 py-6 md:px-8 md:py-7`}>
                    <div className="absolute -right-8 -top-12 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                      <PortalRing percentage={exam.pct} color={g.color} light label={t(g.labelKey, { defaultValue: g.label })} />
                      <div className="flex-1 w-full">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h2 className="text-xl font-bold text-white">{exam.examName}</h2>
                          <p className="text-sm text-white/70">{fmtDate(exam.date)}</p>
                        </div>
                        <p className="text-sm text-white/80 mt-0.5">
                          {t('portal.marksOf', { defaultValue: '{{obtained}} / {{total}} marks', obtained: exam.totalObtained, total: exam.totalMax })}
                        </p>
                        <div className="grid grid-cols-3 gap-2.5 mt-4">
                          <div className="rounded-xl bg-white/15 backdrop-blur-sm px-3 py-2">
                            <div className="flex items-center gap-1.5 text-white/70 text-[10px] font-semibold uppercase tracking-wide">
                              <TrendingUp className="w-3 h-3" /> {t('portal.strongest', { defaultValue: 'Strongest' })}
                            </div>
                            <p className="text-sm font-bold text-white truncate mt-0.5">{exam.best?.subject?.name || '—'}</p>
                          </div>
                          <div className="rounded-xl bg-white/15 backdrop-blur-sm px-3 py-2">
                            <div className="flex items-center gap-1.5 text-white/70 text-[10px] font-semibold uppercase tracking-wide">
                              <TrendingDown className="w-3 h-3" /> {t('portal.weakest', { defaultValue: 'Focus area' })}
                            </div>
                            <p className="text-sm font-bold text-white truncate mt-0.5">{exam.weakest?.subject?.name || '—'}</p>
                          </div>
                          <div className="rounded-xl bg-white/15 backdrop-blur-sm px-3 py-2">
                            <div className="flex items-center gap-1.5 text-white/70 text-[10px] font-semibold uppercase tracking-wide">
                              <CheckCircle2 className="w-3 h-3" /> {t('portal.passed', { defaultValue: 'Passed' })}
                            </div>
                            <p className="text-sm font-bold text-white mt-0.5">{exam.passedCount} / {exam.rows.length}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Subject grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-slate-100">
                    {exam.rows.map((r, i) => {
                      const rc = tier(r.pct);
                      return (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.04 * i, duration: 0.3 }}
                          className={`px-5 py-4 ${i % 2 === 0 ? 'md:border-r md:border-slate-100' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-sm font-semibold text-slate-800">{r.subject?.name || '—'}</p>
                            <div className="flex items-center gap-2">
                              {r.grade && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{r.grade}</span>
                              )}
                              <span className="text-xs font-semibold tabular-nums" style={{ color: rc.color }}>{r.pct.toFixed(0)}%</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs text-slate-400 tabular-nums shrink-0">{r.marksObtained} / {r.totalMarks}</span>
                            <div className="flex-1"><ScoreBar pct={r.pct} color={rc.color} /></div>
                          </div>
                          {r.remarks && (
                            <p className="text-xs text-slate-500 italic mt-1.5 leading-relaxed">&ldquo;{r.remarks}&rdquo;</p>
                          )}
                        </motion.div>
                      );
                    })}
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
