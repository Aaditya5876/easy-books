import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, DollarSign, AlertCircle, Users, TrendingUp, CheckCircle, Sparkles } from 'lucide-react';
import { schoolDashboardApi, aiApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function StatCard({ icon: Icon, label, value, sub, color = 'blue', loading }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   border: 'border-blue-100' },
    green:  { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
    amber:  { bg: 'bg-amber-50',  icon: 'text-amber-600',  border: 'border-amber-100' },
    red:    { bg: 'bg-red-50',    icon: 'text-red-600',    border: 'border-red-100' },
    violet: { bg: 'bg-violet-50', icon: 'text-violet-600', border: 'border-violet-100' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`bg-white rounded-xl border ${c.border} p-5 flex gap-4 items-start`}>
      <div className={`${c.bg} p-3 rounded-lg shrink-0`}>
        <Icon className={`w-5 h-5 ${c.icon}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
        {loading ? (
          <div className="h-7 w-24 bg-muted rounded animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold text-foreground mt-0.5 tabular-nums">{value ?? '—'}</p>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function SchoolDashboard() {
  const companyId = getActiveCompanyId();
  const [insightsDialog, setInsightsDialog] = useState(false);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['school-dashboard', companyId],
    queryFn: () => schoolDashboardApi.summary().then(r => r.data),
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const fmt = (n) => n?.toLocaleString('en-NP') ?? '0';
  const fmtAmt = (n) =>
    n != null
      ? 'Rs. ' + Number(n).toLocaleString('en-NP', { minimumFractionDigits: 2 })
      : 'Rs. 0.00';

  async function getClassInsights() {
    if (!data) { toast.error('Dashboard data not loaded yet'); return; }
    setInsightsLoading(true);
    setInsightsDialog(true);
    try {
      const res = await aiApi.classInsights({
        totalStudents: data.totalStudents,
        totalClasses: data.totalClasses,
        attendanceToday: data.attendanceToday,
        studentsWithDues: data.studentsWithDues,
        totalPendingFees: data.totalPendingFees,
        feeCollectedThisMonth: data.feeCollectedThisMonth,
      });
      setInsights(res.data.insights);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'AI insights failed — check GEMINI_API_KEY');
      setInsightsDialog(false);
    } finally {
      setInsightsLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">School Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview of students, fees, and attendance</p>
        </div>
        <button
          onClick={getClassInsights}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-50 text-violet-700 text-sm font-medium hover:bg-violet-100 transition-colors disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          Class Insights
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          icon={GraduationCap}
          label="Total Students"
          value={fmt(data?.totalStudents)}
          sub={`${fmt(data?.activeStudents)} active`}
          color="blue"
          loading={isLoading}
        />
        <StatCard
          icon={Users}
          label="Total Classes"
          value={fmt(data?.totalClasses)}
          color="violet"
          loading={isLoading}
        />
        <StatCard
          icon={TrendingUp}
          label="Fee Collected (This Month)"
          value={fmtAmt(data?.feeCollectedThisMonth)}
          color="green"
          loading={isLoading}
        />
        <StatCard
          icon={AlertCircle}
          label="Pending Dues"
          value={fmtAmt(data?.totalPendingFees)}
          sub={`${fmt(data?.studentsWithDues)} students`}
          color="amber"
          loading={isLoading}
        />
        <StatCard
          icon={CheckCircle}
          label="Attendance Today"
          value={data?.attendanceToday ? `${data.attendanceToday.present} / ${data.attendanceToday.present + data.attendanceToday.absent}` : '—'}
          sub={data?.attendanceToday ? `${data.attendanceToday.absent} absent` : undefined}
          color="green"
          loading={isLoading}
        />
        <StatCard
          icon={DollarSign}
          label="Fee Collected (This Year)"
          value={fmtAmt(data?.feeCollectedThisYear)}
          color="blue"
          loading={isLoading}
        />
      </div>

      {/* Pending fees table */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Students with Pending Fees</h2>
          <span className="text-xs text-muted-foreground">{fmt(data?.studentsWithDues)} students</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : data?.pendingFeesList?.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">All fees are collected — great work!</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Class</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Month</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.pendingFeesList ?? []).slice(0, 10).map((row) => (
                  <tr key={row.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium">{row.studentName}</td>
                    <td className="px-5 py-3 text-muted-foreground">{row.className}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-amber-700">
                      Rs. {Number(row.dueAmount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{row.month}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={insightsDialog} onOpenChange={setInsightsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" /> AI Class Insights
            </DialogTitle>
          </DialogHeader>
          {insightsLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Analyzing school data…</div>
          ) : (
            <div className="space-y-3 pt-1">
              {(insights || []).map((insight, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-violet-50 border border-violet-100">
                  <div className="w-6 h-6 rounded-full bg-violet-200 text-violet-800 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                  <p className="text-sm text-gray-800">{typeof insight === 'string' ? insight : insight.text || JSON.stringify(insight)}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
