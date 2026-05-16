import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/adapter';
import { dashboardApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import {
  Building2, Users, ReceiptText, Bell, Package, AlertTriangle,
  ArrowDownLeft, ArrowUpRight, ArrowRight, TrendingUp, TrendingDown,
} from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import RecentActivity from '../components/dashboard/RecentActivity';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    bankBalance: 0,
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [salesTrend, setSalesTrend] = useState([]);
  const [alertsSummary, setAlertsSummary] = useState(null);
  const [hrSummary, setHrSummary] = useState(null);
  const [vatSummary, setVatSummary] = useState(null);

  const [receivablesList, setReceivablesList] = useState([]);
  const [payablesList, setPayablesList] = useState([]);
  const [totalReceivable, setTotalReceivable] = useState(0);
  const [totalPayable, setTotalPayable] = useState(0);
  const [thisMonthIncome, setThisMonthIncome] = useState(0);
  const [thisMonthExpense, setThisMonthExpense] = useState(0);

  const companyId = getActiveCompanyId();

  useEffect(() => {
    loadDashboardData();
  }, [companyId]);

  async function loadDashboardData() {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const [purchases, sales, transactions, banks,
           trendRes, alertsRes, hrRes, vatRes] = await Promise.all([
      api.PurchaseOrder.filter({ company_id: companyId }),
      api.SalesOrder.filter({ company_id: companyId }),
      api.Transaction.filter({ company_id: companyId }),
      api.BankAccount.filter({ company_id: companyId }),
      dashboardApi.salesTrend(companyId).catch(() => ({ data: [] })),
      dashboardApi.alerts(companyId).catch(() => ({ data: null })),
      dashboardApi.hrSummary(companyId).catch(() => ({ data: null })),
      dashboardApi.vatSummary(companyId).catch(() => ({ data: null })),
    ]);

    const bankBalance = banks.reduce((sum, b) => sum + (b.current_balance || 0), 0);
    setStats({ bankBalance });

    // Backend-powered sections
    const trend = trendRes?.data?.data ?? trendRes?.data ?? [];
    setSalesTrend(Array.isArray(trend) ? trend : []);
    setAlertsSummary(alertsRes?.data?.data ?? alertsRes?.data ?? null);
    setHrSummary(hrRes?.data?.data ?? hrRes?.data ?? null);
    setVatSummary(vatRes?.data?.data ?? vatRes?.data ?? null);

    // This month income/expense
    const thisMonth = new Date().toISOString().slice(0, 7);
    const thisMonthTx = transactions.filter(t => (t.date_ad || '').startsWith(thisMonth));
    const calcThisMonthIncome = thisMonthTx.filter(t => t.category === 'income').reduce((s, t) => s + (t.amount || 0), 0);
    const calcThisMonthExpense = thisMonthTx.filter(t => t.category === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    setThisMonthIncome(calcThisMonthIncome);
    setThisMonthExpense(calcThisMonthExpense);

    // Receivables per client
    const salesByClient = {};
    sales.forEach(s => {
      const key = s.client_name || 'Unknown';
      if (!salesByClient[key]) salesByClient[key] = { name: key, total: 0, paid: 0 };
      salesByClient[key].total += (s.total_amount || 0);
    });
    transactions.filter(t => t.category === 'income' && t.party_name).forEach(t => {
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

    // Payables per vendor
    const purchasesByVendor = {};
    purchases.forEach(p => {
      const key = p.vendor_name || 'Unknown';
      if (!purchasesByVendor[key]) purchasesByVendor[key] = { name: key, total: 0, paid: 0 };
      purchasesByVendor[key].total += (p.total_amount || 0);
    });
    transactions.filter(t => t.category === 'expense' && t.party_name).forEach(t => {
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

    // Build recent activities
    const activities = [
      ...purchases.slice(0, 5).map(p => ({
        type: 'purchase',
        title: `Purchase from ${p.vendor_name}`,
        subtitle: `NPR ${(p.total_amount || 0).toLocaleString()}`,
        time: p.date_ad ? new Date(p.date_ad).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      })),
      ...sales.slice(0, 5).map(s => ({
        type: 'sales',
        title: `Sale to ${s.client_name}`,
        subtitle: `NPR ${(s.total_amount || 0).toLocaleString()}`,
        time: s.date_ad ? new Date(s.date_ad).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      })),
      ...transactions.slice(0, 5).map(t => ({
        type: 'transaction',
        title: `${t.category} - ${t.type}`,
        subtitle: `NPR ${(t.amount || 0).toLocaleString()}`,
        time: t.date_ad ? new Date(t.date_ad).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      })),
    ];
    setRecentActivities(activities);
    setLoading(false);
  }

  if (!companyId) {
    return <NoCompanyState />;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-36 mb-2" />
          <Skeleton className="h-4 w-52" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <Skeleton className="h-10 w-10 rounded-lg" />
              </div>
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
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
        <div className="glass-card rounded-xl p-4 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass-card rounded-xl p-4 space-y-3">
            <Skeleton className="h-5 w-32" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
          <div className="glass-card rounded-xl p-4 space-y-3">
            <Skeleton className="h-5 w-28" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
          <div className="glass-card rounded-xl p-4 space-y-3">
            <Skeleton className="h-5 w-28" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Business overview at a glance</p>
      </div>

      {/* Row 1 — 5 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Receivable */}
        <div className="glass-card rounded-xl p-5 hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">NPR {totalReceivable.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Receivable</p>
        </div>

        {/* Total Payable */}
        <div className="glass-card rounded-xl p-5 hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">NPR {totalPayable.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Payable</p>
        </div>

        {/* Bank Balance — uses StatCard */}
        <StatCard
          icon={Building2}
          label="Bank Balance"
          value={`NPR ${stats.bankBalance.toLocaleString()}`}
        />

        {/* This Month Income */}
        <div className="glass-card rounded-xl p-5 hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">NPR {thisMonthIncome.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">This Month Income</p>
        </div>

        {/* This Month Expense */}
        <div className="glass-card rounded-xl p-5 hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">NPR {thisMonthExpense.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">This Month Expense</p>
        </div>
      </div>

      {/* Row 2 — Receivables & Payables panels */}
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
                NPR {totalReceivable.toLocaleString()}
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
                    NPR {client.amount.toLocaleString()}
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
                NPR {totalPayable.toLocaleString()}
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
                    NPR {vendor.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-6 text-center">No outstanding payables</p>
          )}
        </div>
      </div>

      {/* Row 3 — Income vs Expense chart */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Income vs Expense</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Last 6 months</p>
          </div>
          <Link to="/reports">
            <Button variant="outline" size="sm" className="gap-1.5">
              View Full Analysis <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
        {salesTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={salesTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => `NPR ${Number(v).toLocaleString()}`} />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} opacity={0.75} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            No trend data yet
          </div>
        )}
      </div>

      {/* Row 4 — Operational Alerts */}
      {alertsSummary && (alertsSummary.lowStockCount > 0 || alertsSummary.bgExpiringSoon > 0 || alertsSummary.staleChequesCount > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">Operational Alerts</p>
          </div>
          <div className="flex flex-wrap gap-4">
            {alertsSummary.lowStockCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <Package className="w-4 h-4" />
                <span><strong>{alertsSummary.lowStockCount}</strong> items below low stock threshold</span>
              </div>
            )}
            {alertsSummary.bgExpiringSoon > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <AlertTriangle className="w-4 h-4" />
                <span><strong>{alertsSummary.bgExpiringSoon}</strong> bank guarantees expiring within 30 days</span>
              </div>
            )}
            {alertsSummary.staleChequesCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <ReceiptText className="w-4 h-4" />
                <span><strong>{alertsSummary.staleChequesCount}</strong> cheques deposited but not cleared ({'>'} 7 days)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Row 5 — Recent Activity + HR Summary + VAT Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <RecentActivity activities={recentActivities} />

        {/* HR Summary */}
        {hrSummary && (
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">HR Summary</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Present Today</span>
                <span className="font-semibold">{hrSummary.presentToday ?? '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending Leaves</span>
                <span className="font-semibold">{hrSummary.pendingLeaves ?? '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payroll Processed</span>
                <span className="font-semibold">{hrSummary.payrollProcessed ? 'Yes' : 'Pending'}</span>
              </div>
            </div>
          </div>
        )}

        {/* VAT Summary */}
        {vatSummary && (
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ReceiptText className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">VAT Summary</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VAT Collected</span>
                <span className="font-semibold text-green-600">NPR {(vatSummary.collected || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VAT Paid</span>
                <span className="font-semibold text-red-600">NPR {(vatSummary.paid || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-medium border-t pt-2">
                <span>Net Payable</span>
                <span className={(vatSummary.collected - vatSummary.paid) >= 0 ? 'text-red-600' : 'text-green-600'}>
                  NPR {Math.abs((vatSummary.collected || 0) - (vatSummary.paid || 0)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
