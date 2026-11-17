import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { Link } from 'react-router-dom';
import { api } from '@/api/adapter';
import { dashboardApi, taskApi, transactionApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { useRole } from '@/lib/useRole';
import { statusLabel, workflowTypeLabel } from '@/lib/tasks';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, ShoppingCart, Wallet, Building2, Package, CheckCircle2, BarChart2,
  ClipboardList, Activity, FileText, AlertCircle, Receipt, Landmark, CalendarClock, User, Phone, RefreshCw,
} from 'lucide-react';
import PageLoader from '../components/PageLoader';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ── Formatting ────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtNPR = (n) => `NPR ${fmt(n)}`;
const shortNPR = (v) => (Math.abs(v) >= 1e5 ? `${(v / 1e5).toFixed(1)}L` : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : `${v}`);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const BS_MONTHS = ['Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
const bsMonthLabel = (ym) => {
  const [y, m] = String(ym).split('-').map(Number);
  return BS_MONTHS[m - 1] ? `${BS_MONTHS[m - 1]} ${String(y).slice(-2)}` : ym;
};

// Categorical slots 1–3 of the validated reference palette (blue, orange,
// aqua); dark mode uses the same hues stepped for the dark surface.
const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a'],
  dark: ['#3987e5', '#d95926', '#199e70'],
};
function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return {
    series: dark ? SERIES.dark : SERIES.light,
    grid: dark ? '#2e2e2c' : '#e7e6e2',
    axis: dark ? '#c3c2b7' : '#52514e',
    tooltipBg: dark ? '#1a1a19' : '#ffffff',
    tooltipBorder: dark ? '#3a3a38' : '#e2e1dc',
  };
}

// ── Building blocks ───────────────────────────────────────────────────────────
function Panel({ title, icon: Icon, children, className, action }) {
  return (
    <section className={cn('rounded-xl border border-border bg-card p-5 shadow-sm', className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}{title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub, tone }) {
  const tones = {
    good: 'text-emerald-700 dark:text-emerald-400',
    bad: 'text-red-600 dark:text-red-400',
    warn: 'text-amber-700 dark:text-amber-400',
  };
  return (
    <div className="rounded-lg border border-border bg-background/50 px-3 py-2.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-lg font-bold text-foreground', tones[tone])}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accent)}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

// Grouped monthly bars, one axis, legend for identity, hover tooltip.
function MonthlyBars({ data, bars, height = 220 }) {
  const c = useChartTheme();
  if (!data.length) return <p className="py-16 text-center text-xs text-muted-foreground">—</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={2} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={{ stroke: c.grid }} />
        <YAxis tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} tickFormatter={shortNPR} />
        <Tooltip
          cursor={{ fill: c.grid, opacity: 0.4 }}
          formatter={(v, name) => [fmtNPR(v), name]}
          contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} fill={c.series[i]} radius={[4, 4, 0, 0]} maxBarSize={22} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Two-part share bar (fixed vs variable) with labels — no colour-only identity.
function SplitBar({ parts }) {
  const c = useChartTheme();
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
        {total > 0 && parts.map((p, i) => (
          <div key={p.label} style={{ width: `${(Math.max(0, p.value) / total) * 100}%`, background: c.series[i] }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {parts.map((p, i) => (
          <div key={p.label} className="flex items-start gap-2">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.series[i] }} />
            <div>
              <p className="text-[11px] text-muted-foreground">{p.label}{total > 0 ? ` · ${Math.round((Math.max(0, p.value) / total) * 100)}%` : ''}</p>
              <p className="text-sm font-semibold text-foreground">{fmtNPR(p.value)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Task panel (also the whole dashboard for STAFF) ──────────────────────────
function TaskReport({ tasks }) {
  const { t } = useTranslation();
  return (
    <Panel title={t('bizDashboard.taskReports', { defaultValue: 'Task Reports & Reminders' })} icon={ClipboardList}
      action={<Link to="/workflow" className="text-xs text-primary hover:underline">{t('bizDashboard.openWorkflow', { defaultValue: 'Open Workflow' })}</Link>}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={t('bizDashboard.totalTasks', { defaultValue: 'Total' })} value={tasks.total} />
        <Stat label={statusLabel(t, 'COMPLETED')} value={tasks.completed} tone="good" />
        <Stat label={statusLabel(t, 'IN_PROGRESS')} value={tasks.inProgress} />
        <Stat label={t('bizDashboard.incomplete', { defaultValue: 'Incomplete' })} value={tasks.incomplete} sub={tasks.overdue ? t('bizDashboard.nOverdue', { defaultValue: '{{n}} overdue', n: tasks.overdue }) : undefined} tone={tasks.overdue ? 'bad' : undefined} />
      </div>

      {tasks.appointments?.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />{t('bizDashboard.upcomingAppointments', { defaultValue: 'Upcoming appointments' })}</p>
          <div className="space-y-1.5">
            {tasks.appointments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                <span className="truncate font-medium">#{a.taskNumber} {a.title}{a.partyName ? ` — ${a.partyName}` : ''}</span>
                <span className="shrink-0 text-muted-foreground">{fmtDate(a.dueDate)}{a.dueTime ? ` ${a.dueTime}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mb-2 mt-4 text-xs font-medium text-muted-foreground">{t('bizDashboard.activeTasks', { defaultValue: 'In-progress and incomplete tasks' })}</p>
      {tasks.active.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">{t('bizDashboard.noActiveTasks', { defaultValue: 'No active tasks' })}</p>
      ) : (
        <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {tasks.active.map((task) => (
            <div key={task.id} className={cn('rounded-lg border px-3 py-2', task.overdue ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30' : 'border-border')}>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-semibold">#{task.taskNumber} {task.title}</p>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px]">{statusLabel(t, task.status)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>{workflowTypeLabel(t, task.workflowType)}</span>
                <span className="flex items-center gap-1"><User className="h-3 w-3" />{task.assignedName || task.assignedTo || t('bizDashboard.unassigned', { defaultValue: 'Unassigned' })}</span>
                {task.assignedContact && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{task.assignedContact}</span>}
                {task.department && <span>{task.department}</span>}
                <span className={task.overdue ? 'font-semibold text-red-600' : ''}>
                  {t('bizDashboard.due', { defaultValue: 'Due' })} {fmtDate(task.dueDate)}{task.dueTime ? ` ${task.dueTime}` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// STAFF can't see company finances (the overview endpoint is ADMIN/ACCOUNTANT),
// so their home page is the task report built from the task list.
function StaffDashboard() {
  const [tasks, setTasks] = useState(null);
  useEffect(() => {
    taskApi.list().then((res) => {
      const all = res.data || [];
      const today = new Date(new Date().toDateString());
      const open = (x) => x.status === 'PENDING' || x.status === 'IN_PROGRESS';
      const overdue = (x) => open(x) && x.dueDate && new Date(x.dueDate) < today;
      setTasks({
        total: all.length,
        completed: all.filter((x) => x.status === 'COMPLETED').length,
        inProgress: all.filter((x) => x.status === 'IN_PROGRESS').length,
        incomplete: all.filter((x) => x.status === 'PENDING').length,
        overdue: all.filter(overdue).length,
        active: all.filter(open).map((x) => ({ ...x, overdue: overdue(x) })),
        appointments: all.filter((x) => x.workflowType === 'APPOINTMENT' && open(x) && x.dueDate && new Date(x.dueDate) >= today),
      });
    }).catch(() => setTasks({ total: 0, completed: 0, inProgress: 0, incomplete: 0, overdue: 0, active: [], appointments: [] }));
  }, []);
  if (!tasks) return <PageLoader />;
  return <div className="space-y-5"><TaskReport tasks={tasks} /></div>;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const companyId = getActiveCompanyId();
  const { isStaff } = useRole();
  if (!companyId) return <NoCompanyState />;
  if (isStaff) return <StaffDashboard />;
  return <Overview />;
}

function Overview() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [chequeTab, setChequeTab] = useState('receivable');

  const load = () => {
    setError(false);
    dashboardApi.overview().then((res) => setData(res.data)).catch(() => setError(true));
  };
  useEffect(load, []);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-sm text-muted-foreground">
        <AlertCircle className="h-6 w-6" />
        {t('bizDashboard.loadFailed', { defaultValue: 'Could not load the dashboard.' })}
        <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="h-3.5 w-3.5" />{t('bizDashboard.retry', { defaultValue: 'Retry' })}</Button>
      </div>
    );
  }
  if (!data) return <PageLoader />;

  const { kpis, profitLoss, expenseSplit, bank, ledgerSummary, inventory, quotations, tasks, cashFlow, cheques } = data;
  const monthly = data.monthly.map((m) => ({ ...m, label: bsMonthLabel(m.month) }));
  const profit = profitLoss.netProfit >= 0;

  async function markCleared(id) {
    await transactionApi.update(id, { status: 'COMPLETED' });
    load();
  }

  const remarkRows = [
    ['QUOTED', t('bizDashboard.quotQuoted', { defaultValue: 'Quoted' })],
    ['WORK_DONE', t('bizDashboard.quotWorkDone', { defaultValue: 'Work done' })],
    ['REVISED', t('bizDashboard.quotRevised', { defaultValue: 'Revised' })],
    ['BILLED', t('bizDashboard.quotBilled', { defaultValue: 'Billed' })],
    ['CANCELLED', t('bizDashboard.quotCancelled', { defaultValue: 'Cancelled' })],
  ];
  const chequeList = chequeTab === 'receivable' ? cheques.receivable : cheques.payable;

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">{t('bizDashboard.fiscalYear', { defaultValue: 'Fiscal year {{fy}}', fy: data.fiscalYear })}</p>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data.isSchool
          ? <Kpi label={t('bizDashboard.feeCollectionFY', { defaultValue: 'Fee Collection (FY)' })} value={fmtNPR(kpis.feeCollection)} icon={Receipt} accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" />
          : <Kpi label={t('bizDashboard.totalSalesFY', { defaultValue: 'Total Sales (FY)' })} value={fmtNPR(kpis.totalSales)} icon={TrendingUp} accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" />}
        <Kpi label={t('bizDashboard.totalPurchaseFY', { defaultValue: 'Total Purchase (FY)' })} value={fmtNPR(kpis.totalPurchase)} icon={ShoppingCart} accent="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" />
        <Kpi label={t('bizDashboard.totalExpensesFY', { defaultValue: 'Total Expenses (FY)' })} value={fmtNPR(kpis.totalExpenses)} icon={TrendingDown} accent="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400" />
        <Kpi
          label={profit ? t('bizDashboard.netProfitFY', { defaultValue: 'Net Profit (FY)' }) : t('bizDashboard.netLossFY', { defaultValue: 'Net Loss (FY)' })}
          value={fmtNPR(Math.abs(profitLoss.netProfit))}
          icon={profit ? TrendingUp : TrendingDown}
          accent={profit ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}
        />
      </div>

      {/* Cash in hand + bank */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title={t('bizDashboard.cashInHand', { defaultValue: 'Cash In Hand' })} icon={Wallet}>
          <p className={cn('text-3xl font-bold', data.cashInHand < 0 ? 'text-red-600' : 'text-foreground')}>{fmtNPR(data.cashInHand)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{t('bizDashboard.excludesBankBalance', { defaultValue: 'Cash only — bank balances not included' })}</p>
        </Panel>
        <Panel title={t('bizDashboard.bankBalance', { defaultValue: 'Bank Balance' })} icon={Landmark} className="lg:col-span-2">
          <p className="text-3xl font-bold text-foreground">{fmtNPR(bank.total)}</p>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">{t('bizDashboard.allAccountsCombined', { defaultValue: 'All accounts combined' })}</p>
          {bank.accounts.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">{t('bizDashboard.noBankAccounts', { defaultValue: 'No bank accounts added yet' })}</p>
          ) : (
            <div className="max-h-44 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {bank.accounts.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="truncate"><span className="font-medium">{b.bankName}</span> <span className="text-muted-foreground">· {b.accountNumber}</span></span>
                  <span className="font-mono font-semibold">{fmtNPR(b.currentBalance)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Ledger summary */}
      <Panel title={t('bizDashboard.ledgerSummary', { defaultValue: 'Ledger Summary' })} icon={BarChart2}>
        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <MonthlyBars
            data={monthly}
            bars={[
              { key: 'sales', name: t('bizDashboard.sales', { defaultValue: 'Sales' }) },
              { key: 'purchase', name: t('bizDashboard.purchase', { defaultValue: 'Purchase' }) },
              { key: 'expenses', name: t('bizDashboard.expenses', { defaultValue: 'Expenses' }) },
            ]}
          />
          <div className="grid grid-cols-2 content-start gap-2">
            <Stat label={t('bizDashboard.salesBills', { defaultValue: 'Sales bills' })} value={ledgerSummary.salesCount} />
            <Stat label={t('bizDashboard.purchaseBills', { defaultValue: 'Purchase bills' })} value={ledgerSummary.purchaseCount} />
            <Stat label={t('bizDashboard.expenseEntries', { defaultValue: 'Expense entries' })} value={ledgerSummary.expenseCount} />
            <Stat label={t('bizDashboard.ledgerAccounts', { defaultValue: 'Income / expense accounts' })} value={`${ledgerSummary.incomeAccounts} / ${ledgerSummary.expenseAccounts}`} />
            <Stat label={t('bizDashboard.totalReceivable', { defaultValue: 'Total Receivable' })} value={fmtNPR(ledgerSummary.receivable)} tone="good" />
            <Stat label={t('bizDashboard.totalPayable', { defaultValue: 'Total Payable' })} value={fmtNPR(ledgerSummary.payable)} tone="warn" />
          </div>
        </div>
      </Panel>

      {/* Profit & expenses */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t('bizDashboard.profitLoss', { defaultValue: 'Profit or Loss (FY)' })} icon={Activity}>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t('bizDashboard.income', { defaultValue: 'Income' })} value={fmtNPR(profitLoss.income)} />
            <Stat label={t('bizDashboard.allCosts', { defaultValue: 'Purchases + expenses' })} value={fmtNPR(profitLoss.expenses)} />
            <Stat label={profit ? t('bizDashboard.profit', { defaultValue: 'Profit' }) : t('bizDashboard.loss', { defaultValue: 'Loss' })} value={fmtNPR(Math.abs(profitLoss.netProfit))} tone={profit ? 'good' : 'bad'} />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">{t('bizDashboard.profitFromLedger', { defaultValue: 'From the ledger: income accounts minus purchase and expense accounts.' })}</p>
        </Panel>
        <Panel title={t('bizDashboard.fixedVsVariable', { defaultValue: 'Fixed vs Variable Expenses' })} icon={TrendingDown}>
          <SplitBar parts={[
            { label: t('bizDashboard.fixed', { defaultValue: 'Fixed' }), value: expenseSplit.fixed },
            { label: t('bizDashboard.variable', { defaultValue: 'Variable' }), value: expenseSplit.variable },
          ]} />
          {expenseSplit.byAccount.length > 0 && (
            <div className="mt-4 space-y-1">
              {expenseSplit.byAccount.slice(0, 5).map((a) => (
                <div key={a.name} className="flex justify-between text-xs"><span className="truncate text-muted-foreground">{a.name}</span><span className="font-mono">{fmtNPR(a.amount)}</span></div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">{t('bizDashboard.fixedVariableHint', { defaultValue: 'Set Fixed or Variable on each expense account in Ledger.' })}</p>
        </Panel>
      </div>

      {/* Inventory */}
      <Panel title={t('bizDashboard.inventoryOverview', { defaultValue: 'Inventory Overview' })} icon={Package}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label={t('bizDashboard.totalItems', { defaultValue: 'Total items' })} value={inventory.totalItems} />
          <Stat label={t('bizDashboard.lowStock', { defaultValue: 'Low stock' })} value={inventory.lowStockCount} tone={inventory.lowStockCount ? 'warn' : undefined} />
          <Stat label={t('bizDashboard.outOfStock', { defaultValue: 'Out of stock' })} value={inventory.outOfStockCount} tone={inventory.outOfStockCount ? 'bad' : undefined} />
          <Stat label={t('bizDashboard.stockValueSelling', { defaultValue: 'Stock value (selling price)' })} value={fmtNPR(inventory.stockValue)} />
          <Stat label={t('bizDashboard.stockSoldFY', { defaultValue: 'Stock sold (FY)' })} value={fmtNPR(inventory.soldValueFY)} />
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('bizDashboard.stockPurchasedVsSold', { defaultValue: 'Stock purchased vs sold (value)' })}</p>
            <MonthlyBars
              data={monthly}
              height={200}
              bars={[
                { key: 'stockPurchased', name: t('bizDashboard.purchased', { defaultValue: 'Purchased' }) },
                { key: 'stockSold', name: t('bizDashboard.sold', { defaultValue: 'Sold' }) },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('bizDashboard.top10SellingItems', { defaultValue: 'Top 10 selling items' })}</p>
            {inventory.topSelling.length === 0 ? <p className="text-xs italic text-muted-foreground">{t('bizDashboard.noSalesYet', { defaultValue: 'No sales yet' })}</p> : (
              <ol className="space-y-1">
                {inventory.topSelling.map((r, i) => (
                  <li key={r.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate"><span className="text-muted-foreground">{i + 1}.</span> {r.name}</span>
                    <span className="shrink-0 font-mono">{fmt(r.quantity)} · {fmtNPR(r.amount)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
        {inventory.expiring?.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />{t('bizDashboard.expiringItems', { defaultValue: 'Expired or expiring soon' })}
            </p>
            <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {inventory.expiring.map((e) => (
                <div key={e.id} className={cn('flex items-center justify-between gap-2 px-3 py-2 text-xs', e.expired && 'bg-red-50 dark:bg-red-950/30')}>
                  <span className="truncate"><span className="font-medium">{e.name}</span>{e.batchNo ? <span className="text-muted-foreground"> · {e.batchNo}</span> : null}<span className="text-muted-foreground"> · {fmt(e.quantity)} {e.unit}</span></span>
                  <span className={cn('shrink-0 font-medium', e.expired ? 'text-red-600' : 'text-amber-700 dark:text-amber-400')}>
                    {e.expired
                      ? t('bizDashboard.expiredDaysAgo', { defaultValue: 'Expired {{n}}d ago', n: Math.abs(e.daysLeft) })
                      : t('bizDashboard.expiresInDays', { defaultValue: 'Expires in {{n}}d', n: e.daysLeft })}
                    <span className="ml-2 font-normal text-muted-foreground">{fmtDate(e.expiryDate)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('bizDashboard.inventoryAging', { defaultValue: 'Inventory aging (days since last purchase)' })}</p>
            <div className="grid grid-cols-4 gap-2">
              {inventory.aging.map((a) => (
                <div key={a.label} className="rounded-lg border border-border px-2 py-2 text-center">
                  <p className="text-[11px] text-muted-foreground">{a.label}</p>
                  <p className="text-base font-bold">{a.count}</p>
                  <p className="text-[10px] text-muted-foreground">{shortNPR(a.value)}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('bizDashboard.lowStockList', { defaultValue: 'Low stock alert' })}</p>
            {inventory.lowStockItems.length === 0 ? <p className="text-xs italic text-muted-foreground">—</p> : inventory.lowStockItems.map((i) => (
              <div key={i.id} className="flex justify-between text-xs"><span className="truncate">{i.name}</span><span className="font-mono text-amber-700 dark:text-amber-400">{fmt(i.quantity)} {i.unit}</span></div>
            ))}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('bizDashboard.outOfStockList', { defaultValue: 'Out of stock' })}</p>
            {inventory.outOfStockItems.length === 0 ? <p className="text-xs italic text-muted-foreground">—</p> : inventory.outOfStockItems.map((i) => (
              <p key={i.id} className="truncate text-xs text-red-600 dark:text-red-400">{i.name}</p>
            ))}
          </div>
        </div>
      </Panel>

      {/* Quotations + tasks */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t('bizDashboard.quotationReports', { defaultValue: 'Quotation Reports' })} icon={FileText}>
          <p className="mb-3 text-xs text-muted-foreground">
            {t('bizDashboard.quotationsThisFY', { defaultValue: '{{n}} quotations this year · {{amount}}', n: quotations.total, amount: fmtNPR(quotations.totalAmount) })}
          </p>
          <div className="divide-y divide-border rounded-lg border border-border">
            {remarkRows.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between px-3 py-2 text-xs">
                <span>{label}</span>
                <span><span className="font-semibold">{quotations.byRemark[key]?.count ?? 0}</span> <span className="ml-2 font-mono text-muted-foreground">{fmtNPR(quotations.byRemark[key]?.amount)}</span></span>
              </div>
            ))}
          </div>
        </Panel>
        <TaskReport tasks={tasks} />
      </div>

      {/* Transactions + cheques */}
      <Panel title={t('bizDashboard.transactionsAndChequeReminders', { defaultValue: 'Transactions & Cheque Reminders' })} icon={CheckCircle2}>
        <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
          <div className="space-y-2">
            <Stat label={t('bizDashboard.totalInflowFY', { defaultValue: 'Cash inflow (FY)' })} value={fmtNPR(cashFlow.inflow)} tone="good" />
            <Stat label={t('bizDashboard.totalOutflowFY', { defaultValue: 'Cash outflow (FY)' })} value={fmtNPR(cashFlow.outflow)} tone="bad" />
            <Stat label={t('bizDashboard.netCashFlow', { defaultValue: 'Net' })} value={fmtNPR(cashFlow.inflow - cashFlow.outflow)} />
          </div>
          <MonthlyBars
            data={monthly}
            height={200}
            bars={[
              { key: 'inflow', name: t('bizDashboard.inflow', { defaultValue: 'Inflow' }) },
              { key: 'outflow', name: t('bizDashboard.outflow', { defaultValue: 'Outflow' }) },
            ]}
          />
        </div>

        <div className="mt-5">
          <div className="mb-3 flex w-fit gap-1 rounded-lg bg-muted/40 p-1">
            {[
              ['receivable', t('bizDashboard.receivable', { defaultValue: 'Receivable' }), cheques.receivable.length],
              ['payable', t('bizDashboard.payable', { defaultValue: 'Payable' }), cheques.payable.length],
            ].map(([key, label, n]) => (
              <button key={key} type="button" onClick={() => setChequeTab(key)}
                className={cn('rounded-md px-3 py-1.5 text-xs font-medium', chequeTab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
                {label} ({n})
              </button>
            ))}
          </div>
          {chequeList.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">{t('bizDashboard.noPendingCheques', { defaultValue: 'No pending cheques' })}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="bg-muted/40 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('bizDashboard.nameOnCheque', { defaultValue: 'Name on cheque' })}</th>
                    <th className="px-3 py-2 font-medium">{t('bizDashboard.issuedBy', { defaultValue: 'Issued by' })}</th>
                    <th className="px-3 py-2 font-medium">{t('bizDashboard.chequeNo', { defaultValue: 'Cheque no.' })}</th>
                    <th className="px-3 py-2 font-medium">{t('bizDashboard.issuedDate', { defaultValue: 'Issued date' })}</th>
                    <th className="px-3 py-2 font-medium">{t('bizDashboard.chequeDate', { defaultValue: 'Cheque date' })}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('bizDashboard.amount', { defaultValue: 'Amount' })}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {chequeList.map((c) => (
                    <tr key={`${c.source}-${c.id}`} className={c.isDue ? 'bg-red-50 dark:bg-red-950/30' : ''}>
                      <td className="px-3 py-2 font-medium">{c.partyName || '—'}{c.kind !== 'CHEQUE' ? <span className="ml-1 text-[10px] text-muted-foreground">({c.kind})</span> : null}</td>
                      <td className="px-3 py-2">{c.issuedBy || '—'}</td>
                      <td className="px-3 py-2 font-mono">{c.chequeNumber || '—'}</td>
                      <td className="px-3 py-2">{fmtDate(c.issuedDate)}</td>
                      <td className="px-3 py-2">
                        <span className={c.isDue ? 'font-semibold text-red-600' : ''}>{fmtDate(c.chequeDate)}</span>
                        {c.isPostDated && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">{t('bizDashboard.postDated', { defaultValue: 'Post-dated' })}</span>}
                        {c.isDue && <span className="ml-1 text-[10px] text-red-600">{t('bizDashboard.dueNow', { defaultValue: 'Due' })}</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{fmtNPR(c.amount)}</td>
                      <td className="px-3 py-2 text-right">
                        {c.source === 'transaction' && (
                          <button type="button" onClick={() => markCleared(c.id)} className="rounded-md border border-border px-2 py-1 text-[10px] font-medium hover:bg-muted">
                            {t('bizDashboard.markCleared', { defaultValue: 'Mark cleared' })}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

// ── No Company State ───────────────────────────────────────────────────────────
function NoCompanyState() {
  const { t } = useTranslation();
  const [name, setName]       = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const company = await api.Company.create({ name: name.trim(), is_active: true });
      const { setActiveCompanyId } = await import('@/lib/companyContext');
      setActiveCompanyId(company.id);
      window.location.reload();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Building2 className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">{t('bizDashboard.welcomeToEasyBooks', { defaultValue: 'Welcome to OneBook' })}</h2>
      <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
        {t('bizDashboard.getStartedHint', { defaultValue: 'Get started by creating your first company. You can manage multiple companies from this app.' })}
      </p>
      <div className="flex gap-2 w-full max-w-sm">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('bizDashboard.companyNamePlaceholder', { defaultValue: 'Company name' })}
          className="flex-1 px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {creating ? t('bizDashboard.creatingEllipsis', { defaultValue: 'Creating...' }) : t('bizDashboard.create', { defaultValue: 'Create' })}
        </button>
      </div>
    </div>
  );
}
