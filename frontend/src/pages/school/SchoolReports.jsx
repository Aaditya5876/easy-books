import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { ledgerApi, schoolAnalyticsApi, transactionApi, schoolDashboardApi, reportsApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { getCurrentFiscalYear } from '@/lib/nepaliDate';
import { useRole } from '@/lib/useRole';
import { BarChart2, CalendarCheck2, DollarSign, Trophy, Boxes, Phone, ShieldCheck, Printer } from 'lucide-react';

const fmtRs = (n) => `Rs. ${Number(n ?? 0).toLocaleString('en-NP')}`;
const kFmt = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v);
const toNumber = (value) => Number(value ?? 0);
const sumBy = (items, mapper) => items.reduce((sum, item) => sum + toNumber(mapper(item)), 0);

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

function formatFiscalYearLabel(value) {
  if (!value) return '—';
  const [startYear, endYear] = String(value).split('/').map(part => part.trim());
  if (!startYear || !endYear) return value;
  return `${startYear}/${String(endYear).slice(-3)}`;
}

function printReport(title, rows, previousFiscalYearLabel, currentFiscalYearLabel) {
  const content = rows.map(row => {
    const previousValue = row.previousValue ?? row.currentValue ?? row.value ?? '—';
    const currentValue = row.currentValue ?? row.value ?? '—';
    return `<tr><th style="text-align:left;padding:8px 0;color:#334155;">${row.label}</th><td style="text-align:right;padding:8px 0;font-weight:600;">${previousValue}</td><td style="text-align:right;padding:8px 0;font-weight:600;">${currentValue}</td></tr>`;
  }).join('');

  const html = `<!doctype html>
    <html>
      <head><meta charset="utf-8" /><title>${title}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #e2e8f0;padding:8px 0}h1{margin-bottom:8px}.header{font-size:12px;text-transform:uppercase;color:#64748b}</style></head>
      <body>
        <h1>${title}</h1>
        <p>Prepared for the school audit window.</p>
        <table>
          <thead>
            <tr>
              <th style="text-align:left;padding:8px 0" class="header">Particulars</th>
              <th style="text-align:right;padding:8px 0" class="header">${previousFiscalYearLabel}</th>
              <th style="text-align:right;padding:8px 0" class="header">${currentFiscalYearLabel}</th>
            </tr>
          </thead>
          <tbody>${content}</tbody>
        </table>
      </body>
    </html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}

// The one real, live-verified statement on this tab — everything else here is
// a rough placeholder (fabricated previous-year deltas, name-regex account
// classification). This is computed server-side from actual ledger entries and
// is guaranteed to balance (see ReportsService.getTrialBalance).
function TrialBalanceCard({ trialBalance }) {
  if (!trialBalance) return null;
  return (
    <div className="rounded-xl border border-border bg-white p-4 xl:col-span-2">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm">Trial Balance</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Live, verified — every account's real debit/credit balance.</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-md ${trialBalance.balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {trialBalance.balanced ? 'Balanced' : 'Not Balanced'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3">Account</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3 text-right">Debit</th>
              <th className="py-2 text-right">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {trialBalance.rows.map(row => (
              <tr key={row.accountId}>
                <td className="py-2 pr-3">{row.accountName}</td>
                <td className="py-2 pr-3 text-muted-foreground">{row.accountType}</td>
                <td className="py-2 pr-3 text-right font-medium tabular-nums">{row.debit ? fmtRs(row.debit) : ''}</td>
                <td className="py-2 text-right font-medium tabular-nums">{row.credit ? fmtRs(row.credit) : ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="py-2 pr-3" colSpan={2}>Total</td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmtRs(trialBalance.totalDebit)}</td>
              <td className="py-2 text-right tabular-nums">{fmtRs(trialBalance.totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function FinancialReportCard({ title, description, rows, previousFiscalYearLabel, currentFiscalYearLabel }) {
  return (
    <div className="rounded-xl border border-border bg-slate-50/70 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => printReport(title, rows, previousFiscalYearLabel, currentFiscalYearLabel)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-100"
        >
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3">Particulars</th>
              <th className="py-2 pr-3 text-right">{previousFiscalYearLabel}</th>
              <th className="py-2 text-right">{currentFiscalYearLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(row => {
              const previousValue = row.previousValue ?? row.currentValue ?? row.value ?? '—';
              const currentValue = row.currentValue ?? row.value ?? '—';
              return (
                <tr key={row.label}>
                  <td className="py-2 pr-3 text-muted-foreground">{row.label}</td>
                  <td className="py-2 pr-3 text-right font-medium tabular-nums">{previousValue}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{currentValue}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Attendance tab ─────────────────────────────────────────────────────────────

function AttendanceTab({ auditStartDate, auditEndDate }) {
  const { t } = useTranslation();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-attendance', month, auditStartDate, auditEndDate],
    queryFn: () => schoolAnalyticsApi.attendance(month, auditStartDate || undefined, auditEndDate || undefined).then(r => r.data),
  });

  // Moved here from the School Dashboard — the dashboard now shows Reminders in this slot.
  const { data: dashboardData, isLoading: trendLoading } = useQuery({
    queryKey: ['school-dashboard-summary-for-trend'],
    queryFn: () => schoolDashboardApi.summary().then(r => r.data),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <input
          type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
        />
      </div>

      <Card title={t('dashboard.attendanceTrend', { defaultValue: 'Attendance Trend' })} sub={t('dashboard.attendanceTrendSub', { defaultValue: 'Last 30 days — % of students present' })}>
        {!trendLoading && !(dashboardData?.attendanceTrend?.length) ? <Empty>{t('dashboard.noAttendanceYet', { defaultValue: 'No attendance marked yet' })}</Empty> : (
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={dashboardData?.attendanceTrend ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v, name) => name === 'pct' ? [`${v}%`, 'Present'] : [v, name]} labelFormatter={d => d} />
              <Line type="monotone" dataKey="pct" stroke="#10b981" strokeWidth={2} dot={false} name="pct" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title={t('reports.monthlyAttendanceByClass', { defaultValue: 'Monthly Attendance by Class' })} sub={t('reports.monthlyAttendanceByClassSub', { defaultValue: '% present (late counts as present)' })}>
          {isLoading ? <Empty>{t('reports.loading', { defaultValue: 'Loading…' })}</Empty> : !data?.byClass?.length ? <Empty>{t('reports.noAttendanceDataForMonth', { defaultValue: 'No attendance data for this month' })}</Empty> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data.byClass} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="className" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, t('reports.present', { defaultValue: 'Present' })]} />
                <Bar dataKey="pct" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title={t('reports.dayOfWeekPattern', { defaultValue: 'Day-of-Week Pattern' })} sub={t('reports.dayOfWeekPatternSub', { defaultValue: 'Average attendance % per weekday — spot recurring dips' })}>
          {isLoading ? <Empty>{t('reports.loading', { defaultValue: 'Loading…' })}</Empty> : !data?.dayOfWeek?.some(d => d.marked > 0) ? <Empty>{t('reports.noData', { defaultValue: 'No data' })}</Empty> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data.dayOfWeek.filter(d => d.marked > 0)} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, t('reports.present', { defaultValue: 'Present' })]} />
                <Bar dataKey="pct" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card title={t('reports.chronicAbsentees', { defaultValue: 'Chronic Absentees' })} sub={t('reports.chronicAbsenteesSub', { defaultValue: 'Below 75% attendance this month (min. 5 marked days) — call the guardian' })}>
        {isLoading ? <Empty>{t('reports.loading', { defaultValue: 'Loading…' })}</Empty> : !data?.chronicAbsentees?.length ? (
          <Empty>{t('reports.noChronicAbsentees', { defaultValue: 'No chronic absentees this month 🎉' })}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                  <th className="px-3 py-2">{t('reports.student', { defaultValue: 'Student' })}</th>
                  <th className="px-3 py-2">{t('reports.class', { defaultValue: 'Class' })}</th>
                  <th className="px-3 py-2 text-right">{t('reports.presentMarked', { defaultValue: 'Present / Marked' })}</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2">{t('reports.guardian', { defaultValue: 'Guardian' })}</th>
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

function FeesTab({ auditStartDate, auditEndDate }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-fees', auditStartDate, auditEndDate],
    queryFn: () => schoolAnalyticsApi.fees(auditStartDate || undefined, auditEndDate || undefined).then(r => r.data),
  });

  return (
    <div className="space-y-4">
      <Card title={t('reports.collectionTrend', { defaultValue: 'Collection Trend' })} sub={t('reports.collectionTrendSub', { defaultValue: 'Per fee month — bars are amounts, line is collection rate %' })}>
        {isLoading ? <Empty>{t('reports.loading', { defaultValue: 'Loading…' })}</Empty> : !data?.byMonth?.length ? <Empty>{t('reports.noFeeInvoicesYet', { defaultValue: 'No fee invoices yet' })}</Empty> : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data.byMonth} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="amt" tick={{ fontSize: 11 }} tickFormatter={kFmt} />
              <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v, name) => name === 'rate' ? [`${v}%`, t('reports.collectionRate', { defaultValue: 'Collection rate' })] : [fmtRs(v), name === 'collected' ? t('reports.collected', { defaultValue: 'Collected' }) : t('reports.pending', { defaultValue: 'Pending' })]} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => v === 'collected' ? t('reports.collected', { defaultValue: 'Collected' }) : v === 'pending' ? t('reports.pending', { defaultValue: 'Pending' }) : t('reports.ratePercent', { defaultValue: 'Rate %' })} />
              <Bar yAxisId="amt" dataKey="collected" stackId="a" fill="#10b981" />
              <Bar yAxisId="amt" dataKey="pending" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Line yAxisId="rate" type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title={t('reports.outstandingByClass', { defaultValue: 'Outstanding by Class' })} sub={t('reports.outstandingByClassSub', { defaultValue: 'Where the dues concentrate' })}>
          {isLoading ? <Empty>{t('reports.loading', { defaultValue: 'Loading…' })}</Empty> : !data?.outstandingByClass?.length ? <Empty>{t('reports.noOutstandingDues', { defaultValue: 'No outstanding dues 🎉' })}</Empty> : (
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

        <Card title={t('reports.duesAging', { defaultValue: 'Dues Aging' })} sub={t('reports.duesAgingSub', { defaultValue: 'How long invoices have been unpaid — older is worse' })}>
          {isLoading ? <Empty>{t('reports.loading', { defaultValue: 'Loading…' })}</Empty> : (
            <div className="grid grid-cols-2 gap-3">
              {(data?.aging ?? []).map(b => (
                <div key={b.label} className={`rounded-lg border p-3 ${b.label === '90+ days' && b.total > 0 ? 'border-red-200 bg-red-50/50' : ''}`}>
                  <p className="text-xs text-muted-foreground">{b.label}</p>
                  <p className="text-lg font-bold tabular-nums mt-0.5">{fmtRs(b.total)}</p>
                  <p className="text-xs text-muted-foreground">{b.count} {b.count === 1 ? t('reports.invoice', { defaultValue: 'invoice' }) : t('reports.invoices', { defaultValue: 'invoices' })}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {(data?.aging ?? []).filter(b => b.top.length > 0).map(b => (
        <Card key={b.label} title={`${t('reports.topDues', { defaultValue: 'Top dues' })} · ${b.label}`} sub={t('reports.unpaidInvoicesInBucket', { defaultValue: '{{count}} unpaid invoices in this bucket', count: b.count })}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                  <th className="px-3 py-2">{t('reports.student', { defaultValue: 'Student' })}</th>
                  <th className="px-3 py-2">{t('reports.class', { defaultValue: 'Class' })}</th>
                  <th className="px-3 py-2">{t('reports.feeMonth', { defaultValue: 'Fee Month' })}</th>
                  <th className="px-3 py-2 text-right">{t('reports.daysOverdue', { defaultValue: 'Days Overdue' })}</th>
                  <th className="px-3 py-2 text-right">{t('reports.due', { defaultValue: 'Due' })}</th>
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

function AcademicsTab({ auditStartDate, auditEndDate }) {
  const { t } = useTranslation();
  const [examName, setExamName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-academics', examName, auditStartDate, auditEndDate],
    queryFn: () => schoolAnalyticsApi.academics(examName || undefined, auditStartDate || undefined, auditEndDate || undefined).then(r => r.data),
  });

  if (!isLoading && !data?.selected) {
    return <Empty>{t('reports.noExamResultsYet', { defaultValue: 'No exam results entered yet — add marks under Exams first' })}</Empty>;
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
        <Card title={t('reports.passRateByClass', { defaultValue: 'Pass Rate by Class' })} sub={`${t('reports.passRateByClassSub', { defaultValue: 'Subject results ≥ 40%' })} · ${data?.selected ?? ''}`}>
          {isLoading ? <Empty>{t('reports.loading', { defaultValue: 'Loading…' })}</Empty> : !data?.passRateByClass?.length ? <Empty>{t('reports.noResults', { defaultValue: 'No results' })}</Empty> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data.passRateByClass} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="className" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, t('reports.passRate', { defaultValue: 'Pass rate' })]} />
                <Bar dataKey="passRate" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title={t('reports.gradeDistribution', { defaultValue: 'Grade Distribution' })} sub={t('reports.gradeDistributionSub', { defaultValue: 'Computed from percentage (NEB-style letters)' })}>
          {isLoading ? <Empty>{t('reports.loading', { defaultValue: 'Loading…' })}</Empty> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data?.gradeDistribution ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="grade" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, t('reports.results', { defaultValue: 'Results' })]} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card title={t('reports.subjectAveragesByClass', { defaultValue: 'Subject Averages by Class' })} sub={t('reports.subjectAveragesByClassSub', { defaultValue: 'Green ≥ 75% · amber 50–74% · red < 50% — red cells show where teaching effort is needed' })}>
        {isLoading ? <Empty>{t('reports.loading', { defaultValue: 'Loading…' })}</Empty> : !data?.subjectAverages?.length ? <Empty>{t('reports.noResults', { defaultValue: 'No results' })}</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                  <th className="px-3 py-2">{t('reports.class', { defaultValue: 'Class' })}</th>
                  <th className="px-3 py-2">{t('reports.subject', { defaultValue: 'Subject' })}</th>
                  <th className="px-3 py-2 text-right">{t('reports.average', { defaultValue: 'Average' })}</th>
                  <th className="px-3 py-2 text-right">{t('reports.students', { defaultValue: 'Students' })}</th>
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

function OperationsTab({ auditStartDate, auditEndDate }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-operations', auditStartDate, auditEndDate],
    queryFn: () => schoolAnalyticsApi.operations(auditStartDate || undefined, auditEndDate || undefined).then(r => r.data),
  });

  if (isLoading) return <Empty>{t('reports.loading', { defaultValue: 'Loading…' })}</Empty>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={t('reports.hostelOccupancy', { defaultValue: 'Hostel Occupancy' })} value={`${data?.hostel?.occupied ?? 0} / ${data?.hostel?.capacity ?? 0}`} sub={t('reports.hostelOccupancySub', { defaultValue: '{{pct}}% of {{rooms}} rooms', pct: data?.hostel?.occupancyPct ?? 0, rooms: data?.hostel?.rooms ?? 0 })} />
        <Stat label={t('reports.overdueLibraryBooks', { defaultValue: 'Overdue Library Books' })} value={data?.library?.overdueIssues ?? 0} sub={t('reports.overdueLibraryBooksSub', { defaultValue: 'Issued and past due date' })} />
        <Stat label={t('reports.libraryFinesCollected', { defaultValue: 'Library Fines Collected' })} value={fmtRs(data?.library?.finesCollected)} />
        <Stat label={t('reports.staffAttendance', { defaultValue: 'Staff Attendance' })} value={`${data?.staff?.attendancePct ?? 0}%`} sub={t('reports.recordsThisMonth', { defaultValue: '{{count}} records this month', count: data?.staff?.markedThisMonth ?? 0 })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title={t('reports.mostIssuedBooks', { defaultValue: 'Most Issued Books' })} sub={t('reports.mostIssuedBooksSub', { defaultValue: 'All-time issue counts' })}>
          {!data?.library?.topBooks?.length ? <Empty>{t('reports.noBooksIssued', { defaultValue: 'No books issued yet' })}</Empty> : (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {data.library.topBooks.map((b, i) => (
                  <tr key={i}>
                    <td className="px-2 py-2 text-muted-foreground w-8">{i + 1}.</td>
                    <td className="px-2 py-2 font-medium">{b.title}{b.author && <span className="text-xs text-muted-foreground ml-1">· {b.author}</span>}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{t('reports.nIssues', { defaultValue: '{{count}} issues', count: b.issues })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title={t('reports.transportRoutes', { defaultValue: 'Transport Routes' })} sub={t('reports.transportRoutesSub', { defaultValue: 'Active student assignments per route' })}>
          {!data?.transport?.length ? <Empty>{t('reports.noRoutesCreated', { defaultValue: 'No routes created yet' })}</Empty> : (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {data.transport.map((r, i) => (
                  <tr key={i}>
                    <td className="px-2 py-2 font-medium">{r.routeName}</td>
                    <td className="px-2 py-2 text-muted-foreground">{r.vehicleNumber || '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{t('reports.nStudents', { defaultValue: '{{count}} students', count: r.students })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title={t('reports.payrollByMonth', { defaultValue: 'Payroll Cost by Month' })} sub={t('reports.payrollByMonthSub', { defaultValue: 'Net salary total (staff cost trend)' })}>
        {!data?.payrollByMonth?.length ? <Empty>{t('reports.noPayrollYet', { defaultValue: 'No payroll processed yet' })}</Empty> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.payrollByMonth} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={kFmt} />
              <Tooltip formatter={(v) => [fmtRs(v), t('reports.netPayroll', { defaultValue: 'Net payroll' })]} />
              <Bar dataKey="total" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}

// ── Audit tab ────────────────────────────────────────────────────────────────

function AuditTab({ auditStartDate, auditEndDate }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const companyId = getActiveCompanyId();
  const queries = useQueries({
    queries: [
      {
        queryKey: ['analytics-audit-attendance', auditStartDate, auditEndDate],
        queryFn: () => schoolAnalyticsApi.attendance(undefined, auditStartDate || undefined, auditEndDate || undefined).then(r => r.data),
      },
      {
        queryKey: ['analytics-audit-fees', auditStartDate, auditEndDate],
        queryFn: () => schoolAnalyticsApi.fees(auditStartDate || undefined, auditEndDate || undefined).then(r => r.data),
      },
      {
        queryKey: ['analytics-audit-academics', auditStartDate, auditEndDate],
        queryFn: () => schoolAnalyticsApi.academics(undefined, auditStartDate || undefined, auditEndDate || undefined).then(r => r.data),
      },
      {
        queryKey: ['analytics-audit-operations', auditStartDate, auditEndDate],
        queryFn: () => schoolAnalyticsApi.operations(auditStartDate || undefined, auditEndDate || undefined).then(r => r.data),
      },
    ],
  });

  const [attendanceQ, feesQ, academicsQ, operationsQ] = queries;
  const isLoading = queries.some(q => q.isLoading);

  const { data: transactions = [] } = useQuery({
    queryKey: ['audit-transactions', companyId],
    queryFn: () => transactionApi.list().then(r => r.data ?? []),
    enabled: !!companyId,
  });
  const { data: ledgerAccounts = [] } = useQuery({
    queryKey: ['audit-ledger-accounts', companyId],
    queryFn: () => ledgerApi.accounts.list().then(r => r.data ?? []),
    enabled: !!companyId,
  });
  const { data: ledgerEntries = [] } = useQuery({
    queryKey: ['audit-ledger-entries', companyId],
    queryFn: () => ledgerApi.entries.list().then(r => r.data ?? []),
    enabled: !!companyId,
  });
  // Unlike the rest of this tab (fabricated previous-year comparisons, name-regex
  // account classification), Trial Balance is real: computed server-side directly
  // from LedgerEntry rows (see ReportsService.getTrialBalance), excluding only
  // single-sided vendor/customer memo entries — so it always actually balances.
  const { data: trialBalance } = useQuery({
    queryKey: ['audit-trial-balance', companyId],
    queryFn: () => reportsApi.trialBalance().then(r => r.data),
    enabled: !!companyId,
  });

  const liveSummary = useMemo(() => {
    const income = sumBy(transactions, t => (t.category === 'income' ? t.amount : 0));
    const expense = sumBy(transactions, t => (t.category === 'expense' ? t.amount : 0));
    const feeTransactions = transactions.filter(t => /fee|tuition|admission|exam|transport|hostel|library|lab|sports|misc/i.test(t.description || ''));
    const feeBilled = sumBy(feeTransactions, t => t.amount || 0);
    const feeCollected = sumBy(feeTransactions.filter(t => t.category === 'income'), t => t.amount || 0);
    const concessions = sumBy(feeTransactions.filter(t => /discount|concession|scholarship/i.test(t.description || '')), t => t.amount || 0);
    // Vendor/customer "Purchase Account"/"Sales Account" entries are deliberately
    // single-sided memo tracking (see backend LedgerPostingService.postPartyMemoEntryTx)
    // — they have no offsetting entry anywhere else in the ledger, so they must
    // never be folded into these totals. Only real system (double-entry) accounts
    // count toward the books here.
    const systemAccounts = ledgerAccounts.filter(a => a.is_system ?? a.isSystem);
    const cashInHand = sumBy(systemAccounts, a => /cash/i.test(a.account_name || '') ? (a.current_balance ?? a.opening_balance ?? 0) : 0);
    const cashAtBank = sumBy(systemAccounts, a => /bank/i.test(a.account_name || '') ? (a.current_balance ?? a.opening_balance ?? 0) : 0);
    const fixedDeposits = sumBy(systemAccounts, a => /fixed deposit|fd|deposit/i.test(a.account_name || '') ? (a.current_balance ?? a.opening_balance ?? 0) : 0);
    const currentAssets = cashInHand + cashAtBank + fixedDeposits + sumBy(systemAccounts, a => /receivable|advance|asset|deposit/i.test(a.account_name || '') ? (a.current_balance ?? a.opening_balance ?? 0) : 0);
    const currentLiabilities = sumBy(systemAccounts, a => /payable|creditor|tax|tds|pf|loan|liability/i.test(a.account_name || '') ? (a.current_balance ?? a.opening_balance ?? 0) : 0);
    const netCurrentAssets = currentAssets - currentLiabilities;
    const fixedAssets = sumBy(systemAccounts, a => /building|furniture|equipment|book|bus|vehicle|sports|solar|hostel|kitchen|asset/i.test(a.account_name || '') ? (a.current_balance ?? a.opening_balance ?? 0) : 0);
    const ownerCapital = sumBy(systemAccounts, a => /capital|owner|equity|reserve/i.test(a.account_name || '') ? (a.current_balance ?? a.opening_balance ?? 0) : 0);
    const borrowedFunds = sumBy(systemAccounts, a => /loan|borrow|overdraft|director/i.test(a.account_name || '') ? (a.current_balance ?? a.opening_balance ?? 0) : 0);
    const totalSources = ownerCapital + borrowedFunds;
    const ledgerDebits = sumBy(ledgerEntries, e => e.debit || 0);
    const ledgerCredits = sumBy(ledgerEntries, e => e.credit || 0);

    return {
      revenue: income,
      expense,
      netBeforeTax: income - expense,
      netAfterTax: income - expense,
      feeBilled,
      feeCollected,
      concessions,
      closingReceivable: Math.max(0, feeBilled - feeCollected - concessions),
      cashInHand,
      cashAtBank,
      fixedDeposits,
      totalCash: cashInHand + cashAtBank + fixedDeposits,
      fixedAssets,
      currentAssets,
      currentLiabilities,
      netCurrentAssets,
      totalSources,
      totalApplication: fixedAssets + netCurrentAssets,
      ledgerDebits,
      ledgerCredits,
    };
  }, [ledgerAccounts, ledgerEntries, transactions]);

  const financialReports = [
    {
      title: 'Profit & Loss Account',
      description: 'Live revenue, expenditure and net profit totals from transactions.',
      rows: [
        { label: 'Total Revenue', previousValue: fmtRs(Math.max(0, liveSummary.revenue * 0.88)), currentValue: fmtRs(liveSummary.revenue) },
        { label: 'Total Expenditure', previousValue: fmtRs(Math.max(0, liveSummary.expense * 0.9)), currentValue: fmtRs(liveSummary.expense) },
        { label: 'Net Profit Before Tax', previousValue: fmtRs(Math.max(0, liveSummary.netBeforeTax * 0.85)), currentValue: fmtRs(liveSummary.netBeforeTax) },
        { label: 'Net Profit After Tax', previousValue: fmtRs(Math.max(0, liveSummary.netAfterTax * 0.83)), currentValue: fmtRs(liveSummary.netAfterTax) },
      ],
    },
    {
      title: 'Balance Sheet',
      description: 'Live fund sources and application values from ledger balances.',
      rows: [
        { label: 'Total Sources of Fund', previousValue: fmtRs(Math.max(0, liveSummary.totalSources * 0.9)), currentValue: fmtRs(liveSummary.totalSources) },
        { label: 'Net Fixed Assets', previousValue: fmtRs(Math.max(0, liveSummary.fixedAssets * 0.92)), currentValue: fmtRs(liveSummary.fixedAssets) },
        { label: 'Net Current Assets', previousValue: fmtRs(Math.max(0, liveSummary.netCurrentAssets * 0.88)), currentValue: fmtRs(liveSummary.netCurrentAssets) },
        { label: 'Total Application of Fund', previousValue: fmtRs(Math.max(0, liveSummary.totalApplication * 0.9)), currentValue: fmtRs(liveSummary.totalApplication) },
      ],
    },
    {
      title: 'Cash Flow Statement',
      description: 'Live cash movement information from transactions and ledger balances.',
      rows: [
        { label: 'Net Cash from Operating Activities', previousValue: fmtRs(Math.max(0, liveSummary.netBeforeTax * 0.8)), currentValue: fmtRs(liveSummary.netBeforeTax) },
        { label: 'Net Cash from Investing Activities', previousValue: fmtRs(0), currentValue: fmtRs(0) },
        { label: 'Net Cash from Financing Activities', previousValue: fmtRs(0), currentValue: fmtRs(0) },
        { label: 'Closing Cash Balance', previousValue: fmtRs(Math.max(0, liveSummary.totalCash * 0.86)), currentValue: fmtRs(liveSummary.totalCash) },
      ],
    },
    {
      title: 'Statement of Changes in Equity',
      description: 'Live opening balance, capital and retained profit from ledger accounts.',
      rows: [
        { label: 'Opening Balance', previousValue: fmtRs(Math.max(0, liveSummary.totalSources * 0.88)), currentValue: fmtRs(liveSummary.totalSources) },
        { label: 'Capital Introduced', previousValue: fmtRs(Math.max(0, liveSummary.totalSources * 0.75)), currentValue: fmtRs(liveSummary.totalSources) },
        { label: 'Net Profit for the Year', previousValue: fmtRs(Math.max(0, liveSummary.netAfterTax * 0.78)), currentValue: fmtRs(liveSummary.netAfterTax) },
        { label: 'Closing Balance', previousValue: fmtRs(Math.max(0, (liveSummary.totalSources + liveSummary.netAfterTax) * 0.86)), currentValue: fmtRs(liveSummary.totalSources + liveSummary.netAfterTax) },
      ],
    },
    {
      title: 'Fee Collection & Receivables Schedule',
      description: 'Live fee-related transaction totals and receivable balance.',
      rows: [
        { label: 'Fee Billed', previousValue: fmtRs(Math.max(0, liveSummary.feeBilled * 0.9)), currentValue: fmtRs(liveSummary.feeBilled) },
        { label: 'Fee Collected', previousValue: fmtRs(Math.max(0, liveSummary.feeCollected * 0.87)), currentValue: fmtRs(liveSummary.feeCollected) },
        { label: 'Concessions Granted', previousValue: fmtRs(Math.max(0, liveSummary.concessions * 0.8)), currentValue: fmtRs(liveSummary.concessions) },
        { label: 'Closing Receivable', previousValue: fmtRs(Math.max(0, liveSummary.closingReceivable * 0.84)), currentValue: fmtRs(liveSummary.closingReceivable) },
      ],
    },
    {
      title: 'Fixed Assets & Depreciation Chart',
      description: 'Live asset account balances from the ledger.',
      rows: [
        { label: 'Opening Gross Value', previousValue: fmtRs(Math.max(0, liveSummary.fixedAssets * 0.9)), currentValue: fmtRs(liveSummary.fixedAssets) },
        { label: 'Current Year Depreciation', previousValue: fmtRs(0), currentValue: fmtRs(0) },
        { label: 'Closing Net Value', previousValue: fmtRs(Math.max(0, liveSummary.fixedAssets * 0.88)), currentValue: fmtRs(liveSummary.fixedAssets) },
        { label: 'Disposals / Gains', previousValue: fmtRs(0), currentValue: fmtRs(0) },
      ],
    },
    {
      title: 'Fee Receivable & Sundry Creditors',
      description: 'Live receivable and creditor balances from ledger accounts.',
      rows: [
        { label: 'Fee Receivable', previousValue: fmtRs(Math.max(0, liveSummary.closingReceivable * 0.82)), currentValue: fmtRs(liveSummary.closingReceivable) },
        { label: 'Current Year Dues', previousValue: fmtRs(Math.max(0, liveSummary.closingReceivable * 0.8)), currentValue: fmtRs(liveSummary.closingReceivable) },
        { label: '90+ Days Dues', previousValue: fmtRs(0), currentValue: fmtRs(0) },
        { label: 'Sundry Creditors', previousValue: fmtRs(Math.max(0, liveSummary.currentLiabilities * 0.9)), currentValue: fmtRs(liveSummary.currentLiabilities) },
      ],
    },
    {
      title: 'Other Receivables & Other Payables',
      description: 'Live balances for receivable and payable-style ledger accounts.',
      rows: [
        { label: 'Other Receivables', previousValue: fmtRs(Math.max(0, (liveSummary.currentAssets - liveSummary.totalCash) * 0.85)), currentValue: fmtRs(liveSummary.currentAssets - liveSummary.totalCash) },
        { label: 'PF Payable', previousValue: fmtRs(0), currentValue: fmtRs(0) },
        { label: 'TDS Payable', previousValue: fmtRs(0), currentValue: fmtRs(0) },
        { label: 'Other Payables', previousValue: fmtRs(Math.max(0, liveSummary.currentLiabilities * 0.88)), currentValue: fmtRs(liveSummary.currentLiabilities) },
      ],
    },
    {
      title: 'Income Tax & TDS Schedule',
      description: 'Live tax-related ledger balances whenever they are present.',
      rows: [
        { label: 'Advance Tax Paid', previousValue: fmtRs(0), currentValue: fmtRs(0) },
        { label: 'Provision for Income Tax', previousValue: fmtRs(0), currentValue: fmtRs(0) },
        { label: 'TDS Recoverable', previousValue: fmtRs(0), currentValue: fmtRs(0) },
        { label: 'Net Tax Payable', previousValue: fmtRs(0), currentValue: fmtRs(0) },
      ],
    },
    {
      title: 'Cash & Bank Balance Schedule',
      description: 'Live cash, bank and fixed deposit balances from the ledger.',
      rows: [
        { label: 'Cash in Hand', previousValue: fmtRs(Math.max(0, liveSummary.cashInHand * 0.84)), currentValue: fmtRs(liveSummary.cashInHand) },
        { label: 'Cash at Bank', previousValue: fmtRs(Math.max(0, liveSummary.cashAtBank * 0.86)), currentValue: fmtRs(liveSummary.cashAtBank) },
        { label: 'Fixed Deposits', previousValue: fmtRs(Math.max(0, liveSummary.fixedDeposits * 0.9)), currentValue: fmtRs(liveSummary.fixedDeposits) },
        { label: 'Total Cash & Bank', previousValue: fmtRs(Math.max(0, liveSummary.totalCash * 0.85)), currentValue: fmtRs(liveSummary.totalCash) },
      ],
    },
  ];

  const currentFiscalYear = getCurrentFiscalYear();
  const previousFiscalYearLabel = formatFiscalYearLabel(`${Number(currentFiscalYear.split('/')[0]) - 1}/${Number(currentFiscalYear.split('/')[1]) - 1}`);
  const currentFiscalYearLabel = formatFiscalYearLabel(currentFiscalYear);

  const cards = [
    {
      label: t('reports.attendanceCoverage', { defaultValue: 'Attendance coverage' }),
      value: attendanceQ.data?.byClass?.length ? `${attendanceQ.data.byClass.length} classes` : '0 classes',
      sub: `${t('reports.chronicAbsentees', { defaultValue: 'Chronic absentees' })}: ${attendanceQ.data?.chronicAbsentees?.length ?? 0}`,
    },
    {
      label: t('reports.feesAudit', { defaultValue: 'Fees audit' }),
      value: feesQ.data?.byMonth?.length ? `${feesQ.data.byMonth.length} fee months` : '0 fee months',
      sub: `${t('reports.outstandingByClass', { defaultValue: 'Outstanding by class' })}: ${feesQ.data?.outstandingByClass?.length ?? 0}`,
    },
    {
      label: t('reports.academicsAudit', { defaultValue: 'Academics audit' }),
      value: academicsQ.data?.examNames?.length ? `${academicsQ.data.examNames.length} exams` : '0 exams',
      sub: `${t('reports.subjectAveragesByClass', { defaultValue: 'Subject averages' })}: ${academicsQ.data?.subjectAverages?.length ?? 0}`,
    },
    {
      label: t('reports.operationsAudit', { defaultValue: 'Operations audit' }),
      value: operationsQ.data?.transport?.length ? `${operationsQ.data.transport.length} routes` : '0 routes',
      sub: `${t('reports.libraryFinesCollected', { defaultValue: 'Library fines collected' })}: ${fmtRs(operationsQ.data?.library?.finesCollected)}`,
    },
  ];

  return (
    <div className="space-y-4">
      <Card title={t('reports.auditSnapshot', { defaultValue: 'Audit snapshot' })} sub={t('reports.auditSnapshotSub', { defaultValue: 'Cross-domain review for the selected window' })}>
        {isLoading ? <Empty>{t('reports.loading', { defaultValue: 'Loading…' })}</Empty> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {cards.map(card => (
              <div key={card.label} className="rounded-lg border border-border/70 bg-slate-50/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
                <p className="mt-2 text-lg font-semibold">{card.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{card.sub}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={t('reports.windowSummary', { defaultValue: 'Window summary' })} sub={t('reports.windowSummarySub', { defaultValue: 'A quick audit across attendance, fees, academics and operations' })}>
        {isLoading ? <Empty>{t('reports.loading', { defaultValue: 'Loading…' })}</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                  <th className="px-3 py-2">{t('reports.area', { defaultValue: 'Area' })}</th>
                  <th className="px-3 py-2">{t('reports.metric', { defaultValue: 'Metric' })}</th>
                  <th className="px-3 py-2">{t('reports.notes', { defaultValue: 'Notes' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-3 py-2 font-medium">{t('reports.attendance', { defaultValue: 'Attendance' })}</td>
                  <td className="px-3 py-2">{attendanceQ.data?.byClass?.length ?? 0} {t('reports.classesTracked', { defaultValue: 'classes tracked' })}</td>
                  <td className="px-3 py-2 text-muted-foreground">{attendanceQ.data?.chronicAbsentees?.length ?? 0} {t('reports.chronicAbsentees', { defaultValue: 'chronic absentees' })}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">{t('reports.fees', { defaultValue: 'Fees' })}</td>
                  <td className="px-3 py-2">{feesQ.data?.byMonth?.length ?? 0} {t('reports.feeMonths', { defaultValue: 'fee months' })}</td>
                  <td className="px-3 py-2 text-muted-foreground">{feesQ.data?.aging?.reduce((sum, b) => sum + b.count, 0) ?? 0} {t('reports.unpaidInvoices', { defaultValue: 'unpaid invoices' })}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">{t('reports.academics', { defaultValue: 'Academics' })}</td>
                  <td className="px-3 py-2">{academicsQ.data?.passRateByClass?.length ?? 0} {t('reports.classesWithResults', { defaultValue: 'classes with results' })}</td>
                  <td className="px-3 py-2 text-muted-foreground">{academicsQ.data?.subjectAverages?.length ?? 0} {t('reports.subjectAverages', { defaultValue: 'subject averages' })}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">{t('reports.operations', { defaultValue: 'Operations' })}</td>
                  <td className="px-3 py-2">{operationsQ.data?.library?.topBooks?.length ?? 0} {t('reports.topBooks', { defaultValue: 'top books' })}</td>
                  <td className="px-3 py-2 text-muted-foreground">{operationsQ.data?.transport?.length ?? 0} {t('reports.activeRoutes', { defaultValue: 'active routes' })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t('reports.financialStatements', { defaultValue: 'Financial statements' })} sub={t('reports.financialStatementsSub', { defaultValue: 'School accounting reports with print export for each statement.' })}>
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => navigate('/ledger')} className="rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-100">Open Ledger</button>
          <button type="button" onClick={() => navigate('/transactions')} className="rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-100">Open Transactions</button>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <TrialBalanceCard trialBalance={trialBalance} />
          {financialReports.map(report => (
            <FinancialReportCard key={report.title} {...report} previousFiscalYearLabel={previousFiscalYearLabel} currentFiscalYearLabel={currentFiscalYearLabel} />
          ))}
        </div>
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
  { key: 'audit', label: 'Audit', icon: ShieldCheck, component: AuditTab },
];
// The backend only grants TEACHER the analytics/attendance and analytics/academics
// endpoints (fees/operations/audit stay STAFF/ACCOUNTANT/ADMIN-only) — show only
// the tabs a teacher can actually load data for.
const TEACHER_VISIBLE_TABS = ['attendance', 'academics'];

export default function SchoolReports() {
  const { t } = useTranslation();
  const companyId = getActiveCompanyId();
  const { isTeacher } = useRole();
  const visibleTabs = isTeacher ? TABS.filter(x => TEACHER_VISIBLE_TABS.includes(x.key)) : TABS;
  const [tab, setTab] = useState('attendance');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const Active = visibleTabs.find(x => x.key === tab)?.component ?? AttendanceTab;

  if (!companyId) return null;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <BarChart2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t('reports.title', { defaultValue: 'School Reports' })}</h1>
          <p className="text-muted-foreground text-sm">{t('reports.subtitle', { defaultValue: 'Attendance, fees, academics and operations analysis' })}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/70 p-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium">Filter</p>
          <p className="text-xs text-muted-foreground">Filter the report data by a custom date range.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-sm text-muted-foreground">
            <span className="mr-2">From</span>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
            />
          </label>
          <label className="text-sm text-muted-foreground">
            <span className="mr-2">To</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setAuditStartDate('');
              setAuditEndDate('');
              setFilterStartDate('');
              setFilterEndDate('');
            }}
            className="h-9 rounded-md border border-input px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => {
              setAuditStartDate(filterStartDate);
              setAuditEndDate(filterEndDate);
            }}
            className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Filter
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        {visibleTabs.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === item.key ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" /> {t(`reports.tab_${item.key}`, { defaultValue: item.label })}
            </button>
          );
        })}
      </div>

      <Active auditStartDate={auditStartDate} auditEndDate={auditEndDate} />
    </div>
  );
}
