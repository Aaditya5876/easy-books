import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { portalApi } from '@/api';
import { CalendarCheck, DollarSign, ClipboardList, AlertCircle } from 'lucide-react';

export default function PortalDashboard() {
  const [student, setStudent] = useState(null);

  useEffect(() => {
    try { setStudent(JSON.parse(localStorage.getItem('portal_student') || 'null')); } catch {}
  }, []);

  const { data: attendance } = useQuery({
    queryKey: ['portal-attendance'],
    queryFn: () => portalApi.attendance().then(r => r.data),
  });

  const { data: fees = [] } = useQuery({
    queryKey: ['portal-fees'],
    queryFn: () => portalApi.fees().then(r => r.data),
  });

  const { data: homework = [] } = useQuery({
    queryKey: ['portal-homework'],
    queryFn: () => portalApi.homework(student?.classId).then(r => r.data),
    enabled: !!student?.classId,
  });

  const pendingFees = fees.filter(f => f.status === 'PENDING' || f.status === 'PARTIAL');
  const overdueHw = homework.filter(h => new Date(h.dueDate) < new Date());
  const fmtAmt = (n) => `Rs. ${Number(n).toLocaleString('en-NP')}`;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome{student?.name ? `, ${student.name}` : ''}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {student?.class ? `${student.class.name}${student.class.section ? ` (${student.class.section})` : ''}` : 'Your academic overview'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{attendance?.summary?.percentage ?? '—'}%</p>
              <p className="text-xs text-gray-500">Attendance</p>
            </div>
          </div>
          {attendance && (
            <p className="text-xs text-gray-400 mt-2">{attendance.summary.present} present / {attendance.summary.total} days</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingFees.length}</p>
              <p className="text-xs text-gray-500">Pending Fees</p>
            </div>
          </div>
          {pendingFees.length > 0 && (
            <p className="text-xs text-amber-600 mt-2">
              Total due: {fmtAmt(pendingFees.reduce((s, f) => s + (Number(f.totalAmount) - Number(f.paidAmount)), 0))}
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{overdueHw.length}</p>
              <p className="text-xs text-gray-500">Overdue Homework</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending fees */}
      {pendingFees.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-900">Pending Fee Invoices</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingFees.slice(0, 5).map(f => (
              <div key={f.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{f.month}</p>
                  {f.description && <p className="text-xs text-gray-400">{f.description}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-amber-600">
                    {fmtAmt(Number(f.totalAmount) - Number(f.paidAmount))} due
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${f.status === 'PARTIAL' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                    {f.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming homework */}
      {homework.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Upcoming Homework</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {homework.slice(0, 5).map(h => {
              const overdue = new Date(h.dueDate) < new Date();
              return (
                <div key={h.id} className="px-5 py-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{h.title}</p>
                    {h.subject && <p className="text-xs text-emerald-700">{h.subject.name}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${overdue ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                    {new Date(h.dueDate).toLocaleDateString('en-NP', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
