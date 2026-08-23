import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { portalApi } from '@/api';
import { CalendarDays } from 'lucide-react';
import { pageVariants, containerVariants, itemVariants } from '@/lib/portalAnimations';
import PortalFilterSelect from '@/components/portal/PortalFilterSelect';
import PortalPagination from '@/components/portal/PortalPagination';
import PortalPageHeader from '@/components/portal/PortalPageHeader';
import { useTranslation } from 'react-i18next';

const EVENT_TYPE_CONFIG = {
  GENERAL:  { label: 'General',  color: '#3B82F6', bg: '#EFF6FF' },
  HOLIDAY:  { label: 'Holiday',  color: '#10B981', bg: '#ECFDF5' },
  EXAM:     { label: 'Exam',     color: '#8B5CF6', bg: '#F5F3FF' },
  SPORTS:   { label: 'Sports',   color: '#F97316', bg: '#FFF7ED' },
  CULTURAL: { label: 'Cultural', color: '#F43F5E', bg: '#FFF1F2' },
  MEETING:  { label: 'Meeting',  color: '#F59E0B', bg: '#FFFBEB' },
};
const EVENT_TYPE_KEYS = {
  GENERAL: 'portal.eventGeneral', HOLIDAY: 'portal.eventHoliday', EXAM: 'portal.eventExam',
  SPORTS: 'portal.eventSports', CULTURAL: 'portal.eventCultural', MEETING: 'portal.eventMeeting',
};
const PAGE_SIZE = 6;

export default function PortalEvents() {
  const { t } = useTranslation();
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['portal-events'],
    queryFn: () => portalApi.events().then(r => r.data),
  });

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-NP', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const isPast = (e) => new Date(e.endDate || e.startDate) < new Date(new Date().toDateString());

  const sorted = useMemo(() => [...events].sort((a, b) => new Date(a.startDate) - new Date(b.startDate)), [events]);

  const typeOptions = useMemo(() => {
    const present = [...new Set(sorted.map(e => e.eventType).filter(Boolean))];
    return [
      { value: 'all', label: t('portal.allTypes', { defaultValue: 'All Types' }) },
      ...present.map(ty => ({ value: ty, label: t(EVENT_TYPE_KEYS[ty] || '', { defaultValue: EVENT_TYPE_CONFIG[ty]?.label || ty }) })),
    ];
  }, [sorted, t]);

  const filtered = useMemo(
    () => type === 'all' ? sorted : sorted.filter(e => e.eventType === type),
    [sorted, type],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const setTypeFiltered = (v) => { setType(v); setPage(1); };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="p-5 md:p-7 space-y-4 max-w-7xl mx-auto">
      <PortalPageHeader
        icon={CalendarDays}
        title={t('portal.schoolEvents', { defaultValue: 'School Events' })}
        badge={events.length > 0 ? t('portal.nEvents', { defaultValue: '{{count}} events', count: events.length }) : null}
        action={typeOptions.length > 2 && (
          <PortalFilterSelect value={type} onChange={setTypeFiltered} options={typeOptions} />
        )}
      />

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">{t('portal.loading', { defaultValue: 'Loading…' })}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <CalendarDays className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            {events.length === 0
              ? t('portal.noEvents', { defaultValue: 'No events scheduled yet' })
              : t('portal.noEventsMatch', { defaultValue: 'No events match this filter' })}
          </p>
        </div>
      ) : (
        <>
          <motion.div key={page} variants={containerVariants} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {paged.map(e => {
              const cfg = EVENT_TYPE_CONFIG[e.eventType] || EVENT_TYPE_CONFIG.GENERAL;
              const past = isPast(e);
              return (
                <motion.div key={e.id} variants={itemVariants}>
                  <div
                    className={`bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow ${past ? 'opacity-60' : ''}`}
                    style={{ borderTop: `3px solid ${cfg.color}` }}
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: cfg.bg }}>
                          <CalendarDays className="w-4 h-4" style={{ color: cfg.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h2 className="font-bold text-slate-900 text-base leading-tight">{e.title}</h2>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ background: cfg.bg, color: cfg.color }}>
                              {t(EVENT_TYPE_KEYS[e.eventType] || EVENT_TYPE_KEYS.GENERAL, { defaultValue: cfg.label })}
                            </span>
                          </div>
                          {e.description && <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap mt-2">{e.description}</p>}
                          <p className="text-xs text-slate-400 mt-3">
                            {fmtDate(e.startDate)}
                            {e.endDate && new Date(e.endDate).toDateString() !== new Date(e.startDate).toDateString() ? ` – ${fmtDate(e.endDate)}` : ''}
                          </p>
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
