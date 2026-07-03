import { useQuery } from '@tanstack/react-query';
import { portalApi } from '@/api';
import { CalendarCheck } from 'lucide-react';

const STATUS_STYLE = {
  PRESENT: 'bg-emerald-100 text-emerald-700',
  LATE:    'bg-yellow-100 text-yellow-700',
  ABSENT:  'bg-red-100 text-red-700',
  EXCUSED: 'bg-blue-100 text-blue-700',
};

export default function PortalAttendance() {
  const { data, isLoading } = useQuery({
    queryKey: ['portal-attendance'],
    queryFn: () => portalApi.attendance().then(r => r.data),
  });

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-NP', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>

      {data?.summary && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Days',  value: data.summary.total,   color: 'bg-gray-50 text-gray-700' },
            { label: 'Present',     value: data.summary.present,  color: 'bg-emerald-50 text-emerald-700' },
            { label: 'Absent',      value: data.summary.absent,   color: 'bg-red-50 text-red-700' },
            { label: 'Percentage',  value: `${data.summary.percentage}%`, color: 'bg-blue-50 text-blue-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-4 ${s.color} border border-white`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs mt-0.5 opacity-70">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading…</div>
        ) : !data?.records?.length ? (
          <div className="p-12 text-center">
            <CalendarCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No attendance records yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Date</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.records.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-700">{fmtDate(r.date)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[r.status] || 'bg-gray-100 text-gray-600'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
