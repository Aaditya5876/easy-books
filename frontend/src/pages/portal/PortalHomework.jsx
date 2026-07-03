import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { portalApi } from '@/api';
import { ClipboardList } from 'lucide-react';

export default function PortalHomework() {
  const [student, setStudent] = useState(null);
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

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Homework</h1>

      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">Loading…</div>
        ) : homework.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No homework assigned yet</p>
          </div>
        ) : (
          homework.map(h => {
            const overdue = isOverdue(h.dueDate);
            return (
              <div key={h.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{h.title}</p>
                    {h.subject && (
                      <p className="text-xs text-emerald-700 mt-0.5 font-medium">{h.subject.name}</p>
                    )}
                    {h.description && (
                      <p className="text-sm text-gray-600 mt-2 leading-relaxed">{h.description}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                      overdue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {overdue ? 'Overdue' : 'Due'}: {fmtDate(h.dueDate)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
