import { useQuery } from '@tanstack/react-query';
import { portalApi } from '@/api';
import { Megaphone } from 'lucide-react';

const PRIORITY_STYLE = {
  HIGH:   'bg-red-100 text-red-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW:    'bg-gray-100 text-gray-500',
};

export default function PortalNotices() {
  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['portal-notices'],
    queryFn: () => portalApi.notices().then(r => r.data),
  });

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-NP', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">School Notices</h1>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : notices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Megaphone className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No notices yet</p>
        </div>
      ) : (
        notices.map(n => (
          <div key={n.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                <Megaphone className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-gray-900">{n.title}</h2>
                  {n.priority && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_STYLE[n.priority] || 'bg-gray-100 text-gray-500'}`}>
                      {n.priority}
                    </span>
                  )}
                  {n.targetAudience && n.targetAudience !== 'ALL' && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600">{n.targetAudience}</span>
                  )}
                </div>
                <p className="text-gray-600 text-sm mt-2 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                <p className="text-xs text-gray-400 mt-3">{fmtDate(n.publishedAt || n.createdAt)}</p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
