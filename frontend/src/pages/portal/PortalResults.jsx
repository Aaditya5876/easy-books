import { useQuery } from '@tanstack/react-query';
import { portalApi } from '@/api';
import { Trophy } from 'lucide-react';

export default function PortalResults() {
  const { data: results = [], isLoading } = useQuery({
    queryKey: ['portal-results'],
    queryFn: () => portalApi.results().then(r => r.data),
  });

  const examNames = [...new Set(results.map(r => r.examName))];

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Exam Results</h1>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Trophy className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No exam results yet</p>
        </div>
      ) : (
        examNames.map(examName => {
          const examResults = results.filter(r => r.examName === examName);
          const totalObtained = examResults.reduce((s, r) => s + Number(r.marksObtained), 0);
          const totalMax = examResults.reduce((s, r) => s + Number(r.totalMarks), 0);
          const pct = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : '—';
          return (
            <div key={examName} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">{examName}</h2>
                <div className="text-right">
                  <span className="text-sm font-bold text-gray-900">{totalObtained} / {totalMax}</span>
                  <span className={`ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                    Number(pct) >= 80 ? 'bg-emerald-100 text-emerald-700' :
                    Number(pct) >= 60 ? 'bg-blue-100 text-blue-700' :
                    Number(pct) >= 40 ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>{pct}%</span>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Subject</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Marks</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">%</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {examResults.map(r => {
                    const subjectPct = ((Number(r.marksObtained) / Number(r.totalMarks)) * 100).toFixed(1);
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-800">{r.subject?.name || '—'}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-gray-700">
                          {Number(r.marksObtained).toFixed(0)} / {Number(r.totalMarks).toFixed(0)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-gray-600">{subjectPct}%</td>
                        <td className="px-5 py-3">
                          {r.grade ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">{r.grade}</span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}
