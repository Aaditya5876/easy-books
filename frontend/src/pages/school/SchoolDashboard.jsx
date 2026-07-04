import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { GraduationCap, DollarSign, AlertCircle, Users, TrendingUp, CheckCircle, Sparkles, Circle, ChevronRight, CalendarClock, CalendarDays, ClipboardList } from 'lucide-react';
import { schoolDashboardApi, schoolAnalyticsApi, aiApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// First-run checklist, ordered by dependency — each step needs the previous ones.
// Hidden once every step has at least one record.
const SETUP_STEPS = [
  { key: 'academicYears', label: 'Create an academic year', desc: 'e.g. 2083-84 — used to tag attendance', path: '/academic-years' },
  { key: 'teachers', label: 'Add teachers', desc: 'Needed to assign class teachers & payroll', path: '/employees' },
  { key: 'classes', label: 'Create classes & sections', desc: 'e.g. Grade 1 (A) — students belong to these', path: '/classes' },
  { key: 'subjects', label: 'Add subjects', desc: 'Used by timetable, exams & homework', path: '/subjects' },
  { key: 'students', label: 'Enroll students', desc: 'One by one, or Import from Excel in one go', path: '/students' },
  { key: 'feeStructures', label: 'Define fee structures', desc: 'Tuition, exam, transport fees per class', path: '/fees' },
];

function GettingStarted({ setup }) {
  const done = SETUP_STEPS.filter(s => (setup?.[s.key] ?? 0) > 0).length;
  if (!setup || done === SETUP_STEPS.length) return null;

  return (
    <div className="bg-white rounded-xl border border-blue-100 overflow-hidden">
      <div className="px-5 py-4 border-b bg-blue-50/50 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Getting Started</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Set up your school in order — each step unlocks the next</p>
        </div>
        <span className="text-sm font-medium text-blue-700 tabular-nums">{done}/{SETUP_STEPS.length} done</span>
      </div>
      <div className="divide-y">
        {SETUP_STEPS.map((step, i) => {
          const isDone = (setup[step.key] ?? 0) > 0;
          return (
            <Link
              key={step.key}
              to={step.path}
              className={`flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors ${isDone ? 'opacity-60' : ''}`}
            >
              {isDone
                ? <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                : <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isDone ? 'line-through' : ''}`}>{i + 1}. {step.label}</p>
                <p className="text-xs text-muted-foreground truncate">{step.desc}</p>
              </div>
              {!isDone && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

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

function ChartCard({ title, sub, children, empty }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="mb-3">
        <h2 className="font-semibold text-sm">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {empty ? (
        <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">{empty}</div>
      ) : children}
    </div>
  );
}

// Horizontal per-class bars — grey when unmarked, red below 75%
function TodayByClass({ rows }) {
  return (
    <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
      {rows.map(r => {
        const unmarked = r.marked === 0;
        const barColor = unmarked ? 'bg-slate-200' : r.pct < 75 ? 'bg-red-400' : 'bg-emerald-400';
        return (
          <div key={r.className} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 truncate">{r.className}</span>
            <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
              <div className={`h-full ${barColor}`} style={{ width: unmarked ? '100%' : `${r.pct}%` }} />
            </div>
            <span className={`w-24 shrink-0 text-right text-xs tabular-nums ${unmarked ? 'text-muted-foreground italic' : r.pct < 75 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
              {unmarked ? 'not marked' : `${r.present}/${r.marked} · ${r.pct}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function WeekAhead({ weekAhead }) {
  const items = [
    ...(weekAhead?.exams ?? []).map(e => ({
      icon: CalendarClock, color: 'text-purple-600 bg-purple-50', date: e.date,
      text: `${e.examName}${e.subject ? ` · ${e.subject}` : ''} — ${e.className}${e.startTime ? ` at ${e.startTime}` : ''}`,
      tag: 'Exam',
    })),
    ...(weekAhead?.events ?? []).map(e => ({
      icon: CalendarDays, color: 'text-amber-600 bg-amber-50', date: e.date,
      text: e.title, tag: e.eventType,
    })),
    ...(weekAhead?.homework ?? []).map(h => ({
      icon: ClipboardList, color: 'text-blue-600 bg-blue-50', date: h.dueDate,
      text: `${h.title}${h.subject ? ` · ${h.subject}` : ''} — ${h.className}`, tag: 'Homework due',
    })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 8);

  if (items.length === 0) {
    return <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">Nothing scheduled for the next 7 days</div>;
  }

  return (
    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div key={i} className="flex items-center gap-3 text-sm">
            <div className={`p-1.5 rounded-md shrink-0 ${item.color}`}><Icon className="w-3.5 h-3.5" /></div>
            <div className="flex-1 min-w-0">
              <p className="truncate">{item.text}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(item.date).toLocaleDateString('en-NP', { weekday: 'short', day: 'numeric', month: 'short' })} · {item.tag}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const fmtRs = (n) => `Rs. ${Number(n ?? 0).toLocaleString('en-NP')}`;

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
      // Exam data isn't on the dashboard payload — fetch it so the AI can
      // comment on academics too. Non-fatal if there are no results yet.
      const academics = await schoolAnalyticsApi.academics().then(r => r.data).catch(() => null);

      const res = await aiApi.classInsights({
        classData: {
          totalStudents: data.totalStudents,
          totalClasses: data.totalClasses,
          attendanceToday: data.attendanceToday,
          attendanceLast30Days: data.attendanceTrend,
          todayAttendanceByClass: data.todayByClass,
          studentsWithDues: data.studentsWithDues,
          totalPendingFees: data.totalPendingFees,
          feeCollectedThisMonth: data.feeCollectedThisMonth,
          feeCollectionByMonth: data.feeMonths,
          latestExam: academics?.selected ?? null,
          examPassRateByClass: academics?.passRateByClass ?? [],
          weakestSubjects: (academics?.subjectAverages ?? [])
            .slice()
            .sort((a, b) => a.avgPct - b.avgPct)
            .slice(0, 5),
        },
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
    <div className="p-6 space-y-6">
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

      {!isLoading && <GettingStarted setup={data?.setup} />}

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

      {/* Analytics row 1 — attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Attendance Trend"
          sub="Last 30 days — % of students present"
          empty={!isLoading && !(data?.attendanceTrend?.length) ? 'No attendance marked yet' : null}
        >
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={data?.attendanceTrend ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v, name) => name === 'pct' ? [`${v}%`, 'Present'] : [v, name]} labelFormatter={d => d} />
              <Line type="monotone" dataKey="pct" stroke="#10b981" strokeWidth={2} dot={false} name="pct" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Today's Attendance by Class"
          sub="Red = below 75% · grey = not marked yet"
          empty={!isLoading && !(data?.todayByClass?.length) ? 'No classes created yet' : null}
        >
          <TodayByClass rows={data?.todayByClass ?? []} />
        </ChartCard>
      </div>

      {/* Analytics row 2 — money + upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Fee Collection by Month"
          sub="Collected vs still pending, per fee month"
          empty={!isLoading && !(data?.feeMonths?.length) ? 'No fee invoices generated yet' : null}
        >
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={data?.feeMonths ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
              <Tooltip formatter={(v, name) => [fmtRs(v), name === 'collected' ? 'Collected' : 'Pending']} />
              <Legend formatter={v => v === 'collected' ? 'Collected' : 'Pending'} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="collected" stackId="a" fill="#10b981" />
              <Bar dataKey="pending" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="This Week Ahead" sub="Exams, events and homework due in the next 7 days">
          <WeekAhead weekAhead={data?.weekAhead} />
        </ChartCard>
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
