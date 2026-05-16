import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/adapter';
import {
  purchaseApi, salesApi, transactionApi, bankAccountApi,
  taskApi, dashboardApi,
} from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import {
  Building2, Users, ArrowDownLeft, ArrowUpRight, ArrowRight,
  TrendingUp, TrendingDown, ChevronDown, ChevronUp, Clock,
  AlertCircle, CalendarCheck2, BarChart2,
} from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  ComposedChart, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// Chart color palette
const COLORS = {
  emerald: '#10b981',
  red: '#ef4444',
  blue: '#3b82f6',
  orange: '#f97316',
  purple: '#8b5cf6',
  yellow: '#eab308',
};

const PIE_COLORS = [
  COLORS.emerald, COLORS.blue, COLORS.orange, COLORS.purple,
  COLORS.yellow, '#ec4899', '#06b6d4', '#84cc16',
];

function fmt(n) {
  return Number(n || 0).toLocaleString();
}

function priorityColor(priority) {
  if (!priority) return 'bg-gray-100 text-gray-600';
  switch (priority.toLowerCase()) {
    case 'high':   return 'bg-red-100 text-red-700';
    case 'medium': return 'bg-amber-100 text-amber-700';
    case 'low':    return 'bg-green-100 text-green-700';
    default:       return 'bg-gray-100 text-gray-600';
  }
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function CollapsibleSection({ title, icon: Icon, iconClass = '', open, onToggle, headerRight, children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-semibold text-sm flex items-center gap-2 ${iconClass}`}>
          {Icon && <Icon className="w-4 h-4" />}
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {headerRight}
          <Button variant="ghost" size="sm" onClick={onToggle} className="h-7 w-7 p-0">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      {open && children}
    </div>
  );
}

// ─── Donut pie chart ──────────────────────────────────────────────────────────
function DonutChart({ data, title }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col h-[220px]">
        <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>
        <div className="flex items-center justify-center flex-1 text-xs text-muted-foreground">No data</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col h-[220px]">
      <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => `NPR ${fmt(v)}`} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [loading, setLoading] = useState(true);

  // KPI state
  const [bankBalance, setBankBalance] = useState(0);
  const [totalReceivable, setTotalReceivable] = useState(0);
  const [totalPayable, setTotalPayable] = useState(0);
  const [thisMonthIncome, setThisMonthIncome] = useState(0);
  const [thisMonthExpense, setThisMonthExpense] = useState(0);

  // Lists
  const [receivablesList, setReceivablesList] = useState([]);
  const [payablesList, setPayablesList] = useState([]);

  // Backend summaries
  const [alertsSummary, setAlertsSummary] = useState(null);
  const [hrSummary, setHrSummary] = useState(null);
  const [salesTrend, setSalesTrend] = useState([]);

  // Chart data derived from transactions
  const [incomeByCategory, setIncomeByCategory] = useState([]);
  const [expenseByCategory, setExpenseByCategory] = useState([]);
  const [monthlyTxCount, setMonthlyTxCount] = useState([]);
  const [salesPurchaseTrend, setSalesPurchaseTrend] = useState([]);

  // Collapsible state
  const [analyticsOpen, setAnalyticsOpen] = useState(true);
  const [hrOpen, setHrOpen] = useState(true);
  const [deskOpen, setDeskOpen] = useState(true);

  const companyId = getActiveCompanyId();

  useEffect(() => {
    if (companyId) loadDashboardData();
    else setLoading(false);
  }, [companyId]);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const [
        purchasesRes, salesRes, transactionsRes, banksRes,
        trendRes, alertsRes, hrRes,
      ] = await Promise.all([
        purchaseApi.list().catch(() => ({ data: [] })),
        salesApi.list().catch(() => ({ data: [] })),
        transactionApi.list().catch(() => ({ data: [] })),
        bankAccountApi.list().catch(() => ({ data: [] })),
        dashboardApi.salesTrend(companyId).catch(() => ({ data: [] })),
        dashboardApi.alerts(companyId).catch(() => ({ data: null })),
        dashboardApi.hrSummary(companyId).catch(() => ({ data: null })),
      ]);

      // Unwrap axios responses (NestJS returns { data: [...] } wrapped in axios { data })
      const unwrap = (res) => {
        const d = res?.data;
        if (Array.isArray(d)) return d;
        if (Array.isArray(d?.data)) return d.data;
        return [];
      };
      const unwrapObj = (res) => {
        const d = res?.data;
        if (d && typeof d === 'object' && !Array.isArray(d)) {
          if (d.data && typeof d.data === 'object' && !Array.isArray(d.data)) return d.data;
          return d;
        }
        return null;
      };

      const purchases     = unwrap(purchasesRes);
      const sales         = unwrap(salesRes);
      const transactions  = unwrap(transactionsRes);
      const banks         = unwrap(banksRes);

      // Bank balance
      const calcBankBalance = banks.reduce((s, b) => s + (b.current_balance || 0), 0);
      setBankBalance(calcBankBalance);

      // Backend summaries
      const trend = (() => {
        const d = trendRes?.data;
        if (Array.isArray(d)) return d;
        if (Array.isArray(d?.data)) return d.data;
        return [];
      })();
      setSalesTrend(trend);

      const alerts = unwrapObj(alertsRes);
      setAlertsSummary(alerts);

      const hr = unwrapObj(hrRes);
      setHrSummary(hr);

      // ── This month income/expense ──────────────────────────────────────────
      const thisMonth = new Date().toISOString().slice(0, 7);
      const thisMonthTx = transactions.filter(t => (t.date_ad || t.date || '').startsWith(thisMonth));
      const calcIncome  = thisMonthTx.filter(t => t.type === 'income' || t.category === 'income')
                                     .reduce((s, t) => s + (t.amount || 0), 0);
      const calcExpense = thisMonthTx.filter(t => t.type === 'expense' || t.category === 'expense')
                                     .reduce((s, t) => s + (t.amount || 0), 0);
      setThisMonthIncome(calcIncome);
      setThisMonthExpense(calcExpense);

      // ── Receivables per client (preserve existing logic exactly) ──────────
      const salesByClient = {};
      sales.forEach(s => {
        const key = s.client_name || 'Unknown';
        if (!salesByClient[key]) salesByClient[key] = { name: key, total: 0, paid: 0 };
        salesByClient[key].total += (s.total_amount || 0);
      });
      transactions.filter(t => (t.category === 'income' || t.type === 'income') && t.party_name).forEach(t => {
        const key = t.party_name;
        if (salesByClient[key]) salesByClient[key].paid += (t.amount || 0);
      });
      const calcReceivablesList = Object.values(salesByClient)
        .map(c => ({ name: c.name, amount: Math.max(0, c.total - c.paid) }))
        .filter(c => c.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8);
      const calcTotalReceivable = calcReceivablesList.reduce((s, c) => s + c.amount, 0);
      setReceivablesList(calcReceivablesList);
      setTotalReceivable(calcTotalReceivable);

      // ── Payables per vendor (preserve existing logic exactly) ─────────────
      const purchasesByVendor = {};
      purchases.forEach(p => {
        const key = p.vendor_name || 'Unknown';
        if (!purchasesByVendor[key]) purchasesByVendor[key] = { name: key, total: 0, paid: 0 };
        purchasesByVendor[key].total += (p.total_amount || 0);
      });
      transactions.filter(t => (t.category === 'expense' || t.type === 'expense') && t.party_name).forEach(t => {
        const key = t.party_name;
        if (purchasesByVendor[key]) purchasesByVendor[key].paid += (t.amount || 0);
      });
      const calcPayablesList = Object.values(purchasesByVendor)
        .map(v => ({ name: v.name, amount: Math.max(0, v.total - v.paid) }))
        .filter(v => v.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8);
      const calcTotalPayable = calcPayablesList.reduce((s, v) => s + v.amount, 0);
      setPayablesList(calcPayablesList);
      setTotalPayable(calcTotalPayable);

      // ── Income by category (donut) ─────────────────────────────────────────
      const incCat = {};
      transactions.filter(t => t.type === 'income' || t.category === 'income').forEach(t => {
        const cat = t.sub_category || t.category || 'Other';
        incCat[cat] = (incCat[cat] || 0) + (t.amount || 0);
      });
      setIncomeByCategory(Object.entries(incCat).map(([name, value]) => ({ name, value })));

      // ── Expense by category (donut) ────────────────────────────────────────
      const expCat = {};
      transactions.filter(t => t.type === 'expense' || t.category === 'expense').forEach(t => {
        const cat = t.sub_category || t.category || 'Other';
        expCat[cat] = (expCat[cat] || 0) + (t.amount || 0);
      });
      setExpenseByCategory(Object.entries(expCat).map(([name, value]) => ({ name, value })));

      // ── Monthly transaction count (bar) ────────────────────────────────────
      const txByMonth = {};
      transactions.forEach(t => {
        const m = (t.date_ad || t.date || '').slice(0, 7);
        if (!m) return;
        if (!txByMonth[m]) txByMonth[m] = { month: m, count: 0 };
        txByMonth[m].count += 1;
      });
      setMonthlyTxCount(
        Object.values(txByMonth).sort((a, b) => a.month.localeCompare(b.month)).slice(-6)
      );

      // ── Sales vs Purchase trend (bar) ──────────────────────────────────────
      const spMap = {};
      sales.forEach(s => {
        const m = (s.date_ad || s.date || '').slice(0, 7);
        if (!m) return;
        if (!spMap[m]) spMap[m] = { month: m, sales: 0, purchase: 0 };
        spMap[m].sales += (s.total_amount || 0);
      });
      purchases.forEach(p => {
        const m = (p.date_ad || p.date || '').slice(0, 7);
        if (!m) return;
        if (!spMap[m]) spMap[m] = { month: m, sales: 0, purchase: 0 };
        spMap[m].purchase += (p.total_amount || 0);
      });
      setSalesPurchaseTrend(
        Object.values(spMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-6)
      );
    } finally {
      setLoading(false);
    }
  }

  if (!companyId) return <NoCompanyState />;

  if (loading) return <LoadingSkeleton />;

  // ── Derive Today's Desk data ───────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueTasks = (alertsSummary?.overdueTasks || []).slice(0, 5);
  const chequesThisWeek = (alertsSummary?.chequesThisWeek || []).slice(0, 5);

  // ── P&L trend for ComposedChart ────────────────────────────────────────────
  const plTrend = salesTrend.map(row => ({
    month: row.month,
    income: row.income ?? row.revenue ?? 0,
    expense: row.expense ?? row.expenses ?? 0,
    profit: (row.income ?? row.revenue ?? 0) - (row.expense ?? row.expenses ?? 0),
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Business overview at a glance</p>
      </div>

      {/* ── Today's Desk ─────────────────────────────────────────────────── */}
      <CollapsibleSection
        title="Today's Desk"
        icon={Clock}
        iconClass="text-amber-600"
        open={deskOpen}
        onToggle={() => setDeskOpen(p => !p)}
      >
        <div className="grid grid-cols-2 gap-4">
          {/* Overdue / Urgent Tasks */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              <p className="text-xs font-semibold text-foreground">Overdue / Urgent Tasks</p>
            </div>
            {overdueTasks.length > 0 ? (
              <div className="space-y-2">
                {overdueTasks.map((task, i) => (
                  <div
                    key={task.id || i}
                    className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{task.title || task.name || 'Unnamed task'}</p>
                      {(task.due_date || task.dueDate) && (
                        <p className="text-[10px] text-amber-600 mt-0.5">
                          Due: {new Date(task.due_date || task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                    {task.priority && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${priorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-4 text-center">
                <p className="text-xs text-green-700 font-medium">All clear — no overdue tasks</p>
              </div>
            )}
          </div>

          {/* Cheques Due This Week */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <CalendarCheck2 className="w-3.5 h-3.5 text-amber-500" />
              <p className="text-xs font-semibold text-foreground">Cheques Due This Week</p>
            </div>
            {chequesThisWeek.length > 0 ? (
              <div className="space-y-2">
                {chequesThisWeek.map((cheque, i) => (
                  <div
                    key={cheque.id || i}
                    className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground truncate">
                        {cheque.party_name || cheque.partyName || cheque.name || 'Unknown'}
                      </p>
                      {(cheque.amount) && (
                        <span className="text-xs font-mono font-semibold text-amber-700 shrink-0">
                          NPR {fmt(cheque.amount)}
                        </span>
                      )}
                    </div>
                    {(cheque.due_date || cheque.dueDate) && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(cheque.due_date || cheque.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-4 text-center">
                <p className="text-xs text-green-700 font-medium">No cheques due this week</p>
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── KPI Cards (5) ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Receivable */}
        <div className="glass-card rounded-xl p-5 hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">NPR {fmt(totalReceivable)}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Receivable</p>
        </div>

        {/* Total Payable */}
        <div className="glass-card rounded-xl p-5 hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">NPR {fmt(totalPayable)}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Payable</p>
        </div>

        {/* Bank Balance */}
        <StatCard
          icon={Building2}
          label="Bank Balance"
          value={`NPR ${fmt(bankBalance)}`}
        />

        {/* This Month Income */}
        <div className="glass-card rounded-xl p-5 hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">NPR {fmt(thisMonthIncome)}</p>
          <p className="text-xs text-muted-foreground mt-1">This Month Income</p>
        </div>

        {/* This Month Expense */}
        <div className="glass-card rounded-xl p-5 hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">NPR {fmt(thisMonthExpense)}</p>
          <p className="text-xs text-muted-foreground mt-1">This Month Expense</p>
        </div>
      </div>

      {/* ── Receivables & Payables panels ────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-6">
        {/* Paisa Linu Parne — Receivables */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-green-600" />
              <h3 className="text-sm font-semibold text-foreground">Paisa Linu Parne</h3>
            </div>
            {totalReceivable > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-green-700">
                NPR {fmt(totalReceivable)}
              </span>
            )}
          </div>
          {receivablesList.length > 0 ? (
            <div className="space-y-2">
              {receivablesList.map((client, idx) => (
                <div key={client.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{idx + 1}</span>
                  <p className="text-xs font-medium truncate flex-1">{client.name}</p>
                  <span className="text-xs font-mono font-semibold text-green-600 shrink-0">
                    NPR {fmt(client.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-6 text-center">No outstanding receivables</p>
          )}
        </div>

        {/* Paisa Dinu Parne — Payables */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-semibold text-foreground">Paisa Dinu Parne</h3>
            </div>
            {totalPayable > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/10 text-red-700">
                NPR {fmt(totalPayable)}
              </span>
            )}
          </div>
          {payablesList.length > 0 ? (
            <div className="space-y-2">
              {payablesList.map((vendor, idx) => (
                <div key={vendor.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{idx + 1}</span>
                  <p className="text-xs font-medium truncate flex-1">{vendor.name}</p>
                  <span className="text-xs font-mono font-semibold text-red-600 shrink-0">
                    NPR {fmt(vendor.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-6 text-center">No outstanding payables</p>
          )}
        </div>
      </div>

      {/* ── Financial Analytics (collapsible) ────────────────────────────── */}
      <CollapsibleSection
        title="Financial Analytics"
        icon={BarChart2}
        open={analyticsOpen}
        onToggle={() => setAnalyticsOpen(p => !p)}
        headerRight={
          <Link to="/reports">
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
              View Full Analysis <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        }
      >
        {/* Row 1: P&L Trend + Sales vs Purchase */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* P&L Trend */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">P&L Trend (Monthly)</p>
            {plTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={plTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => `NPR ${fmt(v)}`} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="income" name="Income" fill={COLORS.emerald} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expense" name="Expense" fill={COLORS.red} radius={[3, 3, 0, 0]} opacity={0.8} />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Profit"
                    stroke={COLORS.blue}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">No trend data yet</div>
            )}
          </div>

          {/* Sales vs Purchase */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Sales vs Purchase (Monthly)</p>
            {salesPurchaseTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={salesPurchaseTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => `NPR ${fmt(v)}`} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="sales" name="Sales" fill={COLORS.blue} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="purchase" name="Purchase" fill={COLORS.orange} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">No data yet</div>
            )}
          </div>
        </div>

        {/* Row 2: Income by Category + Expense by Category */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <DonutChart data={incomeByCategory} title="Income by Category" />
          <DonutChart data={expenseByCategory} title="Expense by Category" />
        </div>

        {/* Row 3: Payable vs Receivable Trend + Monthly Transaction Count */}
        <div className="grid grid-cols-2 gap-4">
          {/* Payable vs Receivable Trend — use salesTrend if available, else empty */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Payable vs Receivable (Monthly)</p>
            {plTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={plTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => `NPR ${fmt(v)}`} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="income" name="Receivable" stroke={COLORS.emerald} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="expense" name="Payable" stroke={COLORS.red} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">No data yet</div>
            )}
          </div>

          {/* Monthly Transaction Count */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Monthly Transaction Count</p>
            {monthlyTxCount.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyTxCount}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Transactions" fill={COLORS.purple} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">No transactions yet</div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── HR & Operations (collapsible) ────────────────────────────────── */}
      <CollapsibleSection
        title="HR & Operations"
        icon={Users}
        open={hrOpen}
        onToggle={() => setHrOpen(p => !p)}
      >
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total Employees', value: hrSummary?.totalEmployees ?? '—', color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { label: 'Present Today',   value: hrSummary?.presentToday   ?? '—', color: 'bg-green-50 text-green-700 border-green-200' },
            { label: 'On Leave',        value: hrSummary?.onLeave        ?? '—', color: 'bg-amber-50 text-amber-700 border-amber-200' },
            { label: 'Absent Today',    value: hrSummary?.absentToday    ?? '—', color: 'bg-red-50 text-red-700 border-red-200' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-lg border px-4 py-3 text-center ${color}`}>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-[11px] font-medium mt-0.5 opacity-80">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Link to="/reports">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              Full HR Analysis <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ── Skeleton loading state ─────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-36 mb-2" />
        <Skeleton className="h-4 w-52" />
      </div>
      {/* Today's Desk skeleton */}
      <div className="bg-card border border-border rounded-xl p-4">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map(i => (
            <div key={i} className="space-y-2">
              {[...Array(3)].map((_, j) => <Skeleton key={j} className="h-12 w-full rounded-lg" />)}
            </div>
          ))}
        </div>
      </div>
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="glass-card rounded-xl p-5 space-y-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      {/* Panels skeleton */}
      <div className="grid grid-cols-2 gap-6">
        {[0, 1].map(i => (
          <div key={i} className="glass-card rounded-xl p-4 space-y-3">
            <Skeleton className="h-5 w-40" />
            {[...Array(5)].map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Analytics skeleton */}
      <div className="bg-card border border-border rounded-xl p-4">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ── No-company onboarding state ────────────────────────────────────────────────
function NoCompanyState() {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    const company = await api.Company.create({ name: name.trim(), is_active: true });
    const { setActiveCompanyId } = await import('@/lib/companyContext');
    setActiveCompanyId(company.id);
    window.location.reload();
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Building2 className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">Welcome to EasyBooks</h2>
      <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
        Get started by creating your first company. You can manage multiple companies from this app.
      </p>
      <div className="flex gap-2 w-full max-w-sm">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Company name"
          className="flex-1 px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  );
}
