import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { portalApi } from '@/api';
import { Trophy } from 'lucide-react';
import { pageVariants, containerVariants, cardVariants } from '@/lib/portalAnimations';
import { useTranslation } from 'react-i18next';

function gradeColor(pct) {
  if (pct >= 80) return { color: '#10B981', bg: '#F0FDF4', label: 'Excellent', labelKey: 'portal.excellent' };
  if (pct >= 60) return { color: '#3B82F6', bg: '#EFF6FF', label: 'Good', labelKey: 'portal.good' };
  if (pct >= 40) return { color: '#F59E0B', bg: '#FFFBEB', label: 'Average', labelKey: 'portal.average' };
  return { color: '#F43F5E', bg: '#FFF1F2', label: 'Needs Work', labelKey: 'portal.needsWork' };
}

function ScoreBar({ obtained, total }) {
  const pct = total > 0 ? (obtained / total) * 100 : 0;
  const gc  = gradeColor(pct);
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 tabular-nums">{obtained} / {total}</span>
        <span className="text-xs font-semibold tabular-nums" style={{ color: gc.color }}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: gc.color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </div>
  );
}

export default function PortalResults() {
  const { t } = useTranslation();
  const { data: results = [], isLoading } = useQuery({
    queryKey: ['portal-results'],
    queryFn: () => portalApi.results().then(r => r.data),
  });

  const examNames = [...new Set(results.map(r => r.examName))];

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="p-5 md:p-7 space-y-5 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900">{t('portal.examResults', { defaultValue: 'Exam Results' })}</h1>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">{t('portal.loading', { defaultValue: 'Loading…' })}</div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Trophy className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">{t('portal.noExamResults', { defaultValue: 'No exam results yet' })}</p>
        </div>
      ) : (
        <motion.div variants={containerVariants} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {examNames.map(examName => {
            const examResults    = results.filter(r => r.examName === examName);
            const totalObtained  = examResults.reduce((s, r) => s + Number(r.marksObtained), 0);
            const totalMax       = examResults.reduce((s, r) => s + Number(r.totalMarks), 0);
            const pct            = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
            const gc             = gradeColor(pct);

            return (
              <motion.div key={examName} variants={cardVariants} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                {/* Header */}
                <div className="px-5 py-4 flex items-center justify-between" style={{ background: gc.bg }}>
                  <div>
                    <h2 className="font-bold text-slate-900">{examName}</h2>
                    <p className="text-xs mt-0.5" style={{ color: gc.color }}>{gc.labelKey ? t(gc.labelKey, { defaultValue: gc.label }) : gc.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums" style={{ color: gc.color }}>
                      {pct.toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums">{t('portal.marksOf', { defaultValue: '{{obtained}} / {{total}} marks', obtained: totalObtained, total: totalMax })}</p>
                  </div>
                </div>

                {/* Subject rows */}
                <div className="divide-y divide-slate-100">
                  {examResults.map((r, i) => {
                    const sPct = Number(r.totalMarks) > 0
                      ? (Number(r.marksObtained) / Number(r.totalMarks)) * 100
                      : 0;
                    return (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * i, duration: 0.3 }}
                        className="px-5 py-3"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-sm font-semibold text-slate-800">{r.subject?.name || '—'}</p>
                          <div className="flex items-center gap-2">
                            {r.grade && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {r.grade}
                              </span>
                            )}
                          </div>
                        </div>
                        <ScoreBar obtained={Number(r.marksObtained)} total={Number(r.totalMarks)} />
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
