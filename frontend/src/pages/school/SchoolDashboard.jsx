import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { GraduationCap, DollarSign, AlertCircle, Users, TrendingUp, CheckCircle, Sparkles, CalendarClock, CalendarDays, ClipboardList, CreditCard, Megaphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { schoolDashboardApi, schoolAnalyticsApi, aiApi, transactionApi, examSchedulesApi, schoolEventsApi, noticesApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRole } from '@/lib/useRole';
import { formatDate } from '@/lib/utils';

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
  const { t } = useTranslation();
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
              {unmarked ? t('dashboard.notMarked', { defaultValue: 'not marked' }) : `${r.present}/${r.marked} · ${r.pct}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function WeekAhead({ weekAhead }) {
  const { t } = useTranslation();
  const items = [
    ...(weekAhead?.exams ?? []).map(e => ({
      icon: CalendarClock, color: 'text-purple-600 bg-purple-50', date: e.date,
      text: `${e.examName}${e.subject ? ` · ${e.subject}` : ''} — ${e.className}${e.startTime ? ` at ${e.startTime}` : ''}`,
      tag: t('dashboard.tagExam', { defaultValue: 'Exam' }),
    })),
    ...(weekAhead?.events ?? []).map(e => ({
      icon: CalendarDays, color: 'text-amber-600 bg-amber-50', date: e.date,
      text: e.title, tag: e.eventType,
    })),
    ...(weekAhead?.homework ?? []).map(h => ({
      icon: ClipboardList, color: 'text-blue-600 bg-blue-50', date: h.dueDate,
      text: `${h.title}${h.subject ? ` · ${h.subject}` : ''} — ${h.className}`, tag: t('dashboard.tagHomeworkDue', { defaultValue: 'Homework due' }),
    })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 8);

  if (items.length === 0) {
    return <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">{t('dashboard.nothingScheduled', { defaultValue: 'Nothing scheduled for the next 7 days' })}</div>;
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

// Unified reminders across pending Cheque/Credit transactions, upcoming exams and
// upcoming events — unlike WeekAhead (which only covers the next 7 days), this pulls
// from the full exam-schedule/event lists so nothing later-dated gets forgotten, and
// pending transactions stay listed (highlighted) even once they're overdue.
function Reminders({ transactions, examSchedules, schoolEvents }) {
  const { t } = useTranslation();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const txnItems = (transactions ?? [])
    .filter(txn => txn.status === 'PENDING' && (txn.type === 'CHEQUE' || txn.type === 'CREDIT'))
    .map(txn => ({
      icon: CreditCard, color: 'text-emerald-600 bg-emerald-50', date: txn.dateAd,
      text: `${txn.partyName ? `${txn.partyName} — ` : ''}${txn.description || 'Transaction'} · Rs. ${Number(txn.amount ?? 0).toLocaleString('en-NP')}`,
      tag: txn.type === 'CREDIT' ? t('dashboard.tagCredit', { defaultValue: 'Credit' }) : t('dashboard.tagCheque', { defaultValue: 'Cheque' }),
    }));

  const examItems = (examSchedules ?? [])
    .filter(e => e.examDate && new Date(e.examDate) >= today)
    .map(e => ({
      icon: CalendarClock, color: 'text-purple-600 bg-purple-50', date: e.examDate,
      text: `${e.examName}${e.subject?.name ? ` · ${e.subject.name}` : ''} — ${e.class?.name ?? ''}${e.class?.section ? '-' + e.class.section : ''}`,
      tag: t('dashboard.tagExam', { defaultValue: 'Exam' }),
    }));

  const eventItems = (schoolEvents ?? [])
    .filter(e => e.startDate && new Date(e.startDate) >= today)
    .map(e => ({
      icon: CalendarDays, color: 'text-amber-600 bg-amber-50', date: e.startDate,
      text: e.title, tag: e.eventType,
    }));

  const items = [...txnItems, ...examItems, ...eventItems].sort((a, b) => new Date(a.date) - new Date(b.date));

  if (items.length === 0) {
    return <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">{t('dashboard.noReminders', { defaultValue: "Nothing pending — you're all caught up" })}</div>;
  }

  return (
    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
      {items.map((item, i) => {
        const Icon = item.icon;
        const overdue = new Date(item.date) < today;
        return (
          <div key={i} className="flex items-center gap-3 text-sm">
            <div className={`p-1.5 rounded-md shrink-0 ${overdue ? 'text-red-600 bg-red-100' : item.color}`}><Icon className="w-3.5 h-3.5" /></div>
            <div className="flex-1 min-w-0">
              <p className="truncate">{item.text}</p>
              <p className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                {overdue && `${t('dashboard.overdue', { defaultValue: 'Overdue' })} · `}
                {new Date(item.date).toLocaleDateString('en-NP', { weekday: 'short', day: 'numeric', month: 'short' })} · {item.tag}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecentNotices({ notices }) {
  const { t } = useTranslation();
  const items = (notices ?? [])
    .filter(n => n.isPublished)
    .sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt))
    .slice(0, 6);

  if (items.length === 0) {
    return <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">{t('dashboard.noNotices', { defaultValue: 'No notices yet' })}</div>;
  }

  return (
    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
      {items.map((n) => (
        <div key={n.id} className="flex items-center gap-3 text-sm">
          <div className="p-1.5 rounded-md shrink-0 text-amber-600 bg-amber-50"><Megaphone className="w-3.5 h-3.5" /></div>
          <div className="flex-1 min-w-0">
            <p className="truncate">{n.title}</p>
            <p className="text-xs text-muted-foreground">{formatDate(n.publishedAt || n.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const fmtRs = (n) => `Rs. ${Number(n ?? 0).toLocaleString('en-NP')}`;

export default function SchoolDashboard() {
  const { t } = useTranslation();
  const companyId = getActiveCompanyId();
  const { isTeacher, isLibrarian, isAdmin, isAccountant } = useRole();
  // Teachers/librarians don't have visibility into Fees anywhere else in the app
  // (see SidebarNav.jsx) — keep the dashboard consistent with that instead of
  // leading with money figures they can't act on or drill into. STAFF does have
  // Fees access (front-desk cashier use case) so stays "financial" here, but NOT
  // Ledger/Transactions access — that query is gated separately below.
  const showFinancials = !isTeacher && !isLibrarian;
  const canViewTransactions = isAdmin || isAccountant;
  const [insightsDialog, setInsightsDialog] = useState(false);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['school-dashboard', companyId],
    queryFn: () => schoolDashboardApi.summary().then(r => r.data),
    enabled: !!companyId,
    staleTime: 60_000,
  });

  // Reminders widget data — fetched independently of weekAhead so it isn't capped to 7 days.
  const { data: transactions } = useQuery({
    queryKey: ['school-dashboard-transactions', companyId],
    queryFn: () => transactionApi.list().then(r => r.data ?? []),
    enabled: !!companyId && canViewTransactions,
    staleTime: 60_000,
  });
  const { data: examSchedules } = useQuery({
    queryKey: ['school-dashboard-exam-schedules', companyId],
    queryFn: () => examSchedulesApi.list().then(r => r.data ?? []),
    enabled: !!companyId,
    staleTime: 60_000,
  });
  const { data: schoolEvents } = useQuery({
    queryKey: ['school-dashboard-events', companyId],
    queryFn: () => schoolEventsApi.list().then(r => r.data ?? []),
    enabled: !!companyId,
    staleTime: 60_000,
  });
  const { data: notices } = useQuery({
    queryKey: ['school-dashboard-notices', companyId],
    queryFn: () => noticesApi.list().then(r => r.data ?? []),
    enabled: !!companyId && !showFinancials,
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
        companyId,
        classData: {
          totalStudents: data.totalStudents,
          totalClasses: data.totalClasses,
          attendanceToday: data.attendanceToday,
          attendanceLast30Days: data.attendanceTrend,
          todayAttendanceByClass: data.todayByClass,
          ...(showFinancials ? {
            studentsWithDues: data.studentsWithDues,
            totalPendingFees: data.totalPendingFees,
            feeCollectedThisMonth: data.feeCollectedThisMonth,
            feeCollectionByMonth: data.feeMonths,
          } : {}),
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
          <h1 className="text-2xl font-bold">{t('dashboard.title', { defaultValue: 'School Dashboard' })}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {showFinancials
              ? t('dashboard.subtitle', { defaultValue: 'Overview of students, fees, and attendance' })
              : t('dashboard.subtitleAcademic', { defaultValue: 'Overview of classes, attendance, and schedule' })}
          </p>
        </div>
        <button
          onClick={getClassInsights}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-50 text-violet-700 text-sm font-medium hover:bg-violet-100 transition-colors disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {t('dashboard.classInsights', { defaultValue: 'Class Insights' })}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          icon={GraduationCap}
          label={t('dashboard.totalStudents', { defaultValue: 'Total Students' })}
          value={fmt(data?.totalStudents)}
          sub={t('dashboard.nActive', { defaultValue: '{{count}} active', count: data?.activeStudents ?? 0 })}
          color="blue"
          loading={isLoading}
        />
        <StatCard
          icon={Users}
          label={t('dashboard.totalClasses', { defaultValue: 'Total Classes' })}
          value={fmt(data?.totalClasses)}
          color="violet"
          loading={isLoading}
        />
        {showFinancials && (
          <StatCard
            icon={TrendingUp}
            label={t('dashboard.feeCollectedMonth', { defaultValue: 'Fee Collected (This Month)' })}
            value={fmtAmt(data?.feeCollectedThisMonth)}
            color="green"
            loading={isLoading}
          />
        )}
        {showFinancials && (
          <StatCard
            icon={AlertCircle}
            label={t('dashboard.pendingDues', { defaultValue: 'Pending Dues' })}
            value={fmtAmt(data?.totalPendingFees)}
            sub={t('dashboard.nStudents', { defaultValue: '{{count}} students', count: data?.studentsWithDues ?? 0 })}
            color="amber"
            loading={isLoading}
          />
        )}
        <StatCard
          icon={CheckCircle}
          label={t('dashboard.attendanceToday', { defaultValue: 'Attendance Today' })}
          value={data?.attendanceToday ? `${data.attendanceToday.present} / ${data.attendanceToday.present + data.attendanceToday.absent}` : '—'}
          sub={data?.attendanceToday ? t('dashboard.nAbsent', { defaultValue: '{{count}} absent', count: data.attendanceToday.absent }) : undefined}
          color="green"
          loading={isLoading}
        />
        {showFinancials && (
          <StatCard
            icon={DollarSign}
            label={t('dashboard.feeCollectedYear', { defaultValue: 'Fee Collected (This Year)' })}
            value={fmtAmt(data?.feeCollectedThisYear)}
            color="blue"
            loading={isLoading}
          />
        )}
      </div>

      {/* Analytics row 1 — reminders + today's attendance
          (Attendance Trend moved to School Reports → Attendance tab) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title={t('dashboard.reminders', { defaultValue: 'Reminders' })}
          sub={canViewTransactions
            ? t('dashboard.remindersSub', { defaultValue: 'Pending cheque/credit transactions, upcoming exams and events' })
            : t('dashboard.remindersSubAcademic', { defaultValue: 'Upcoming exams and events' })}
        >
          <Reminders transactions={transactions} examSchedules={examSchedules} schoolEvents={schoolEvents} />
        </ChartCard>

        <ChartCard
          title={t('dashboard.todayByClass', { defaultValue: "Today's Attendance by Class" })}
          sub={t('dashboard.todayByClassSub', { defaultValue: 'Red = below 75% · grey = not marked yet' })}
          empty={!isLoading && !(data?.todayByClass?.length) ? t('dashboard.noClassesYet', { defaultValue: 'No classes created yet' }) : null}
        >
          <TodayByClass rows={data?.todayByClass ?? []} />
        </ChartCard>
      </div>

      {/* Analytics row 2 — money + upcoming (financial roles), or notices + upcoming (academic roles) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {showFinancials ? (
          <ChartCard
            title={t('dashboard.feeByMonth', { defaultValue: 'Fee Collection by Month' })}
            sub={t('dashboard.feeByMonthSub', { defaultValue: 'Collected vs still pending, per fee month' })}
            empty={!isLoading && !(data?.feeMonths?.length) ? t('dashboard.noInvoicesYet', { defaultValue: 'No fee invoices generated yet' }) : null}
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
        ) : (
          <ChartCard
            title={t('dashboard.recentNotices', { defaultValue: 'Recent Notices' })}
            sub={t('dashboard.recentNoticesSub', { defaultValue: 'Latest announcements for your school' })}
          >
            <RecentNotices notices={notices} />
          </ChartCard>
        )}

        <ChartCard
          title={t('dashboard.weekAhead', { defaultValue: 'This Week Ahead' })}
          sub={t('dashboard.weekAheadSub', { defaultValue: 'Exams, events and homework due in the next 7 days' })}
        >
          <WeekAhead weekAhead={data?.weekAhead} />
        </ChartCard>
      </div>

      {/* Pending fees table — financial roles only */}
      {showFinancials && (
        <div className="bg-white rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm">{t('dashboard.pendingFeesTitle', { defaultValue: 'Students with Pending Fees' })}</h2>
            <span className="text-xs text-muted-foreground">{t('dashboard.nStudents', { defaultValue: '{{count}} students', count: data?.studentsWithDues ?? 0 })}</span>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t('common.loading', { defaultValue: 'Loading…' })}</div>
          ) : data?.pendingFeesList?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t('dashboard.allFeesCollected', { defaultValue: 'All fees are collected — great work!' })}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('common.student', { defaultValue: 'Student' })}</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('common.class', { defaultValue: 'Class' })}</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('dashboard.dueAmount', { defaultValue: 'Due Amount' })}</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('common.month', { defaultValue: 'Month' })}</th>
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
      )}

      <Dialog open={insightsDialog} onOpenChange={setInsightsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" /> {t('dashboard.aiInsightsTitle', { defaultValue: 'AI Class Insights' })}
            </DialogTitle>
          </DialogHeader>
          {insightsLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">{t('dashboard.analyzing', { defaultValue: 'Analyzing school data…' })}</div>
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
