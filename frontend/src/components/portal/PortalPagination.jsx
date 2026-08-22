import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Simple client-side pagination control — every portal list is fetched in
// full (small per-student/per-class datasets) and paginated in the browser,
// so this only ever slices an already-loaded array. Renders nothing for a
// single page.
export default function PortalPagination({ page, totalPages, onChange }) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-1 pt-1">
      <p className="text-xs text-slate-400">
        {t('portal.pageOf', { defaultValue: 'Page {{page}} of {{total}}', page, total: totalPages })}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
