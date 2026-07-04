import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { schoolAnalyticsApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { BarChart2, CalendarCheck2, DollarSign, Trophy, Boxes, Phone } from 'lucide-react';

const fmtRs = (n) => `Rs. ${Number(n ?? 0).toLocaleString('en-NP')}`;
const kFmt = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v);

function Card({ title, sub, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-border p-5 ${className}`}>
      <div className="mb-3">
        <h2 className="font-semibold text-sm">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }) {
  return <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">{children}</div>;
}

function Stat({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p className="text-xl font-bold mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

const heatColor = (p) =>
  p >= 75 ? 'bg-emerald-50 text-emerald-700'
  : p >= 50 ? 'bg-amber-50 text-amber-700'
  : 'bg-red-50 text-red-700';

// ── Attendance tab ─────────────────────────────────────────────────────────────

function AttendanceTab() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-attendance', month],
    queryFn: () => schoolAnalyticsApi.attendance(month).then(r => r.data),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <input
          type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Monthly Attendance by Class" sub="% present (late counts as present)">
          {isLoading ? <Empty>Loading…</Empty> : !data?.byClass?.length ? <Empty>No attendance data for this month</Empty> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data.byClass} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="className" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, 'Present']} />
                <Bar dataKey="pct" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Day-of-Week Pattern" sub="Average attendance % per weekday — spot recurring dips">
          {isLoading ? <Empty>Loading…</Empty> : !data?.dayOfWeek?.some(d => d.marked > 0) ? <Empty>No data</Empty> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data.dayOfWeek.filter(d => d.marked > 0)} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, 'Present']} />
                <Bar dataKey="pct" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card title="Chronic Absentees" sub="Below 75% attendance this month (min. 5 marked days) — call the guardian">
        {isLoading ? <Empty>Loading…</Empty> : !data?.chronicAbsentees?.length ? (
          <Empty>No chronic absentees this month 🎉</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2 text-right">Present / Marked</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2">Guardian</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.chronicAbsentees.map((s, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium">{s.name}{s.rollNumber ? ` (${s.rollNumber})` : ''}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.className}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.presentDays} / {s.markedDays}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${heatColor(s.pct)}`}>{s.pct}%</span>
                    </td>
                    <td className="px-3 py-2">
                      {s.guardianPhone ? (
                        <a href={`tel:${s.guardianPhone}`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                          <Phone className="w-3.5 h-3.5" /> {s.guardianPhone}
                        </a>
                      ) : <span className="text-muted-foreground">—</span>}
                      {s.guardianName && <span className="text-xs text-muted-foreground ml-1">({s.guardianName})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Fees tab ───────────────────────────────────────────────────────────────────

function FeesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-fees'],
    queryFn: () => schoolAnalyticsApi.fees().then(r => r.data),
  });

  return (
    <div className="space-y-4">
      <Card title="Collection Trend" sub="Per fee month — bars are amounts, line is collection rate %">
        {isLoading ? <Empty>Loading…</Empty> : !data?.byMonth?.length ? <Empty>No fee invoices yet</Empty> : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data.byMonth} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="amt" tick={{ fontSize: 11 }} tickFormatter={kFmt} />
              <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v, name) => name === 'rate' ? [`${v}%`, 'Collection rate'] : [fmtRs(v), name === 'collected' ? 'Collected' : 'Pending']} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => v === 'collected' ? 'Collected' : v === 'pending' ? 'Pending' : 'Rate %'} />
              <Bar yAxisId="amt" dataKey="collected" stackId="a" fill="#10b981" />
              <Bar yAxisId="amt" dataKey="pending" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Line yAxisId="rate" type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Outstanding by Class" sub="Where the dues concentrate">
          {isLoading ? <Empty>Loading…</Empty> : !data?.outstandingByClass?.length ? <Empty>No outstanding dues 🎉</Empty> : (
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {(() => {
                const max = Math.max(...data.outstandingByClass.map(c => c.due), 1);
                return data.outstandingByClass.map(c => (
                  <div key={c.className} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 truncate">{c.className}</span>
                    <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${(c.due / max) * 100}%` }} />
                    </div>
                    <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{fmtRs(c.due)}</span>
                  </div>
                ));
              })()}
            </div>
          )}
        </Card>

        <Card title="Dues Aging" sub="How long invoices have been unpaid — older is worse">
          {isLoading ? <Empty>Loading…</Empty> : (
            <div className="grid grid-cols-2 gap-3">
              {(data?.aging ?? []).map(b => (
                <div key={b.label} className={`rounded-lg border p-3 ${b.label === '90+ days' && b.total > 0 ? 'border-red-200 bg-red-50/50' : ''}`}>
                  <p className="text-xs text-muted-foreground">{b.label}</p>
                  <p className="text-lg font-bold tabular-nums mt-0.5">{fmtRs(b.total)}</p>
                  <p className="text-xs text-muted-foreground">{b.count} invoice{b.count === 1 ? '' : 's'}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {(data?.aging ?? []).filter(b => b.top.length > 0).map(b => (
        <Card key={b.label} title={`Top dues · ${b.label}`} sub={`${b.count} unpaid invoices in this bucket`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Fee Month</th>
                  <th className="px-3 py-2 text-right">Days Overdue</th>
                  <th className="px-3 py-2 text-right">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {b.top.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium">{r.studentName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.className}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.month}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.daysOver}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-amber-700">{fmtRs(r.due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Academics tab ──────────────────────────────────────────────────────────────

function AcademicsTab() {
  const [examName, setExamName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-academics', examName],
    queryFn: () => schoolAnalyticsApi.academics(examName || undefined).then(r => r.data),
  });

  if (!isLoading && !data?.selected) {
    return <Empty>No exam results entered yet — add marks under Exams first</Empty>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <select
          value={examName || data?.selected || ''}
          onChange={e => setExamName(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
        >
          {(data?.examNames ?? []).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Pass Rate by Class" sub={`Subject results ≥ 40% · ${data?.selected ?? ''}`}>
          {isLoading ? <Empty>Loading…</Empty> : !data?.passRateByClass?.length ? <Empty>No results</Empty> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data.passRateByClass} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="className" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, 'Pass rate']} />
                <Bar dataKey="passRate" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Grade Distribution" sub="Computed from percentage (NEB-style letters)">
          {isLoading ? <Empty>Loading…</Empty> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data?.gradeDistribution ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="grade" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, 'Results']} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card title="Subject Averages by Class" sub="Green ≥ 75% · amber 50–74% · red < 50% — red cells show where teaching effort is needed">
        {isLoading ? <Empty>Loading…</Empty> : !data?.subjectAverages?.length ? <Empty>No results</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2 text-right">Average</th>
                  <th className="px-3 py-2 text-right">Students</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.subjectAverages.map((s, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{s.className}</td>
                    <td className="px-3 py-2 font-medium">{s.subjectName}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${heatColor(s.avgPct)}`}>{s.avgPct}%</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Operations tab ─────────────────────────────────────────────────────────────

function OperationsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-operations'],
    queryFn: () => schoolAnalyticsApi.operations().then(r => r.data),
  });

  if (isLoading) return <Empty>Loading…</Empty>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Hostel Occupancy" value={`${data?.hostel?.occupied ?? 0} / ${data?.hostel?.capacity ?? 0}`} sub={`${data?.hostel?.occupancyPct ?? 0}% of ${data?.hostel?.rooms ?? 0} rooms`} />
        <Stat label="Overdue Library Books" value={data?.library?.overdueIssues ?? 0} sub="Issued and past due date" />
        <Stat label="Library Fines Collected" value={fmtRs(data?.library?.finesCollected)} />
        <Stat label="Staff Attendance" value={`${data?.staff?.attendancePct ?? 0}%`} sub={`${data?.staff?.markedThisMonth ?? 0} records this month`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Most Issued Books" sub="All-time issue counts">
          {!data?.library?.topBooks?.length ? <Empty>No books issued yet</Empty> : (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {data.library.topBooks.map((b, i) => (
                  <tr key={i}>
                    <td className="px-2 py-2 text-muted-foreground w-8">{i + 1}.</td>
                    <td className="px-2 py-2 font-medium">{b.title}{b.author && <span className="text-xs text-muted-foreground ml-1">· {b.author}</span>}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{b.issues} issue{b.issues === 1 ? '' : 's'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Transport Routes" sub="Active student assignments per route">
          {!data?.transport?.length ? <Empty>No routes created yet</Empty> : (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {data.transport.map((r, i) => (
                  <tr key={i}>
                    <td className="px-2 py-2 font-medium">{r.routeName}</td>
                    <td className="px-2 py-2 text-muted-foreground">{r.vehicleNumber || '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.students} student{r.students === 1 ? '' : 's'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Payroll Cost by Month" sub="Net salary total (staff cost trend)">
        {!data?.payrollByMonth?.length ? <Empty>No payroll processed yet</Empty> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.payrollByMonth} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={kFmt} />
              <Tooltip formatter={(v) => [fmtRs(v), 'Net payroll']} />
              <Bar dataKey="total" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck2, component: AttendanceTab },
  { key: 'fees', label: 'Fees', icon: DollarSign, component: FeesTab },
  { key: 'academics', label: 'Academics', icon: Trophy, component: AcademicsTab },
  { key: 'operations', label: 'Operations', icon: Boxes, component: OperationsTab },
];

export default function SchoolReports() {
  const companyId = getActiveCompanyId();
  const [tab, setTab] = useState('attendance');
  const Active = TABS.find(t => t.key === tab)?.component ?? AttendanceTab;

  if (!companyId) return null;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <BarChart2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">School Reports</h1>
          <p className="text-muted-foreground text-sm">Attendance, fees, academics and operations analysis</p>
        </div>
      </div>

      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <Active />
    </div>
  );
}
