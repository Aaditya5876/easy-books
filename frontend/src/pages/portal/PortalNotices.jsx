import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { portalApi } from '@/api';
import { Megaphone } from 'lucide-react';
import { pageVariants, containerVariants, itemVariants } from '@/lib/portalAnimations';
import PortalFilterSelect from '@/components/portal/PortalFilterSelect';
import PortalPagination from '@/components/portal/PortalPagination';
import PortalPageHeader from '@/components/portal/PortalPageHeader';
import { useTranslation } from 'react-i18next';

const AUDIENCE_LABELS = { ALL: 'Everyone', TEACHERS: 'Teachers', STUDENTS: 'Students', PARENTS: 'Parents' };
const AUDIENCE_KEYS   = { ALL: 'portal.everyone', TEACHERS: 'portal.teachers', STUDENTS: 'portal.students', PARENTS: 'portal.parents' };

const PRIORITY_CONFIG = {
  HIGH:   { label: 'Important', labelKey: 'portal.important', color: '#F43F5E', bg: '#FFF1F2', bar: '#F43F5E' },
  MEDIUM: { label: 'Notice',    labelKey: 'portal.notice',    color: '#F59E0B', bg: '#FFFBEB', bar: '#F59E0B' },
  LOW:    { label: 'Info',      labelKey: 'portal.info',      color: '#64748B', bg: '#F8FAFC', bar: '#CBD5E1' },
};
const PAGE_SIZE = 6;

export default function PortalNotices() {
  const { t } = useTranslation();
  const [audience, setAudience] = useState('all');
  const [page, setPage] = useState(1);
  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['portal-notices'],
    queryFn: () => portalApi.notices().then(r => r.data),
  });

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-NP', { day: 'numeric', month: 'long', year: 'numeric' });

  const audienceOptions = useMemo(() => {
    const present = [...new Set(notices.map(n => n.targetAudience).filter(Boolean))];
    return [
      { value: 'all', label: t('portal.allAudiences', { defaultValue: 'All' }) },
      ...present.map(a => ({ value: a, label: AUDIENCE_LABELS[a] ? t(AUDIENCE_KEYS[a], { defaultValue: AUDIENCE_LABELS[a] }) : a })),
    ];
  }, [notices, t]);

  const filtered = useMemo(
    () => audience === 'all' ? notices : notices.filter(n => n.targetAudience === audience),
    [notices, audience],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const setAudienceFiltered = (v) => { setAudience(v); setPage(1); };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="p-5 md:p-7 space-y-4 max-w-7xl mx-auto">
      <PortalPageHeader
        icon={Megaphone}
        title={t('portal.schoolNotices', { defaultValue: 'School Notices' })}
        badge={notices.length > 0 ? t('portal.nNotices', { defaultValue: '{{count}} notices', count: notices.length }) : null}
        action={audienceOptions.length > 2 && (
          <PortalFilterSelect value={audience} onChange={setAudienceFiltered} options={audienceOptions} />
        )}
      />

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">{t('portal.loading', { defaultValue: 'Loading…' })}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Megaphone className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            {notices.length === 0
              ? t('portal.noNotices', { defaultValue: 'No notices yet' })
              : t('portal.noNoticesMatch', { defaultValue: 'No notices match this filter' })}
          </p>
        </div>
      ) : (
        <>
          <motion.div key={page} variants={containerVariants} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {paged.map(n => {
              const cfg = PRIORITY_CONFIG[n.priority] || PRIORITY_CONFIG.LOW;
              return (
                <motion.div key={n.id} variants={itemVariants}>
                  <div
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    style={{ borderTop: `3px solid ${cfg.bar}` }}
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: cfg.bg }}
                        >
                          <Megaphone className="w-4 h-4" style={{ color: cfg.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h2 className="font-bold text-slate-900 text-base leading-tight">{n.title}</h2>
                            {n.priority && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                                style={{ background: cfg.bg, color: cfg.color }}
                              >
                                {cfg.labelKey ? t(cfg.labelKey, { defaultValue: cfg.label }) : cfg.label}
                              </span>
                            )}
                            {n.targetAudience && n.targetAudience !== 'ALL' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">
                                {AUDIENCE_LABELS[n.targetAudience]
                                  ? t(AUDIENCE_KEYS[n.targetAudience], { defaultValue: AUDIENCE_LABELS[n.targetAudience] })
                                  : n.targetAudience}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap mt-2">{n.content}</p>
                          <p className="text-xs text-slate-400 mt-3">{fmtDate(n.publishedAt || n.createdAt)}</p>
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
