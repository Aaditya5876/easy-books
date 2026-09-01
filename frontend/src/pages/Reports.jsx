import { useState, useEffect, useMemo } from 'react';
import { api } from '@/api/adapter';
import { getActiveCompanyId } from '@/lib/companyContext';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ComposedChart,
} from 'recharts';

// ─── Color palette ────────────────────────────────────────────────────────────
const COLORS = {
  income:  'hsl(160, 60%, 45%)',
  expense: 'hsl(0, 84%, 60%)',
  profit:  'hsl(217, 71%, 53%)',
  primary: 'hsl(217, 71%, 53%)',
  amber:   'hsl(38, 92%, 50%)',
  violet:  'hsl(280, 65%, 60%)',
};
const PIE_COLORS = [
  'hsl(217,71%,53%)',
  'hsl(160,60%,45%)',
  'hsl(38,92%,50%)',
  'hsl(0,84%,60%)',
  'hsl(280,65%,60%)',
];
const AGING_COLORS = [
  'hsl(160,60%,45%)',
  'hsl(38,92%,50%)',
  'hsl(38,70%,50%)',
  'hsl(0,84%,60%)',
];
const STATUS_COLORS = {
  pending:  COLORS.primary,
  sent:     COLORS.amber,
  accepted: COLORS.income,
  rejected: COLORS.expense,
  expired:  'hsl(0,0%,60%)',
};

// ─── Loading skeleton ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="grid grid-cols-2 gap-6">
          {[0, 1].map(j => (
            <div key={j} className="glass-card rounded-xl p-6 h-72 animate-pulse bg-muted/30" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 bg-primary rounded-full" />
      <h2 className="text-base font-semibold">{title}</h2>
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────
function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
      No data for this period
    </div>
  );
}

// ─── Shared tooltip formatter ──────────────────────────────────────────────────
const nprFormatter = (v) => `NPR ${Number(v).toLocaleString()}`;

// ─── Date range filter helper ──────────────────────────────────────────────────
function makeFilterByRange(range) {
  return function filterByRange(items, dateKey = 'date_ad') {
    const now = new Date();
    return items.filter(item => {
      if (!item[dateKey]) return range === 'all';
      const d = new Date(item[dateKey]);
      if (range === 'month')   return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (range === 'quarter') {
        const q = Math.floor(now.getMonth() / 3);
        return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear();
      }
      if (range === 'year') return d.getFullYear() === now.getFullYear();
      return true;
    });
  };
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Reports() {
  const [range, setRange]             = useState('month');
  const [loading, setLoading]         = useState(true);
  const [sales, setSales]             = useState([]);
  const [purchases, setPurchases]     = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [inventory, setInventory]     = useState([]);
  const [quotations, setQuotations]   = useState([]);

  const companyId = getActiveCompanyId();

  // ── Data loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      if (!companyId) { setLoading(false); return; }
      // Promise.allSettled, not Promise.all — Transaction is ACCOUNTANT/ADMIN-only
      // on the backend, so a STAFF viewer 403s on that one call alone. With
      // Promise.all that single rejection sinks the whole page (setLoading(false)
      // never runs, page hangs on the skeleton forever); settle each independently
      // so STAFF still sees every section they do have access to.
      const [s, p, t, inv, q] = await Promise.allSettled([
        api.SalesOrder.filter({ company_id: companyId }),
        api.PurchaseOrder.filter({ company_id: companyId }),
        api.Transaction.filter({ company_id: companyId }),
        api.InventoryItem.filter({ company_id: companyId }),
        api.Quotation.filter({ company_id: companyId }),
      ]);
      setSales(s.value || []);
      setPurchases(p.value || []);
      setTransactions(t.value || []);
      setInventory(inv.value || []);
      setQuotations(q.value || []);
      setLoading(false);
    }
    load();
  }, [companyId]);

  // ── Range-filtered slices ─────────────────────────────────────────────────────
  const filterByRange  = useMemo(() => makeFilterByRange(range), [range]);
  const filteredSales  = useMemo(() => filterByRange(sales),        [sales, filterByRange]);
  const filteredPurchases = useMemo(() => filterByRange(purchases),  [purchases, filterByRange]);
  const filteredTx     = useMemo(() => filterByRange(transactions),  [transactions, filterByRange]);

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 1 — Profit & Loss
  // ════════════════════════════════════════════════════════════════════════════

  // Chart 1: monthly P&L
  const monthlyPL = useMemo(() => {
    const map = {};
    filteredTx.forEach(t => {
      const m = (t.date_ad || '').slice(0, 7);
      if (!m) return;
      if (!map[m]) map[m] = { month: new Date(m + '-01').toLocaleDateString('en-US', { month: 'short' }), income: 0, expense: 0 };
      if (t.category === 'income') map[m].income += t.amount || 0;
      else                         map[m].expense += t.amount || 0;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ ...v, profit: v.income - v.expense }));
  }, [filteredTx]);

  // Chart 2: cumulative cash flow
  const cumulativeCF = useMemo(() => {
    let running = 0;
    return filteredTx
      .slice()
      .sort((a, b) => (a.date_ad || '').localeCompare(b.date_ad || ''))
      .map(t => {
        running += t.category === 'income' ? (t.amount || 0) : -(t.amount || 0);
        return { date: t.date_ad?.slice(5), balance: running };
      });
  }, [filteredTx]);

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 2 — Receivables & Payables
  // ════════════════════════════════════════════════════════════════════════════

  // Chart 3: receivable aging
  const receivableAging = useMemo(() => {
    const today = new Date();
    const buckets = { '0-30 days': 0, '31-60 days': 0, '61-90 days': 0, '90+ days': 0 };
    filteredSales.forEach(s => {
      if (!s.date_ad) return;
      const days   = Math.floor((today - new Date(s.date_ad)) / 86400000);
      const amount = s.total_amount || 0;
      if      (days <= 30) buckets['0-30 days']  += amount;
      else if (days <= 60) buckets['31-60 days'] += amount;
      else if (days <= 90) buckets['61-90 days'] += amount;
      else                 buckets['90+ days']   += amount;
    });
    return Object.entries(buckets)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .filter(b => b.value > 0);
  }, [filteredSales]);

  // Chart 4: payable aging (same logic, purchase orders)
  const payableAging = useMemo(() => {
    const today = new Date();
    const buckets = { '0-30 days': 0, '31-60 days': 0, '61-90 days': 0, '90+ days': 0 };
    filteredPurchases.forEach(p => {
      if (!p.date_ad) return;
      const days   = Math.floor((today - new Date(p.date_ad)) / 86400000);
      const amount = p.total_amount || 0;
      if      (days <= 30) buckets['0-30 days']  += amount;
      else if (days <= 60) buckets['31-60 days'] += amount;
      else if (days <= 90) buckets['61-90 days'] += amount;
      else                 buckets['90+ days']   += amount;
    });
    return Object.entries(buckets)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .filter(b => b.value > 0);
  }, [filteredPurchases]);

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 3 — Sales Intelligence
  // ════════════════════════════════════════════════════════════════════════════

  // Chart 5: top 10 clients
  const topClients = useMemo(() => {
    const map = {};
    filteredSales.forEach(s => {
      const k = s.client_name || 'Unknown';
      map[k] = (map[k] || 0) + (s.total_amount || 0);
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, value]) => ({
        name:  name.length > 14 ? name.slice(0, 14) + '…' : name,
        value: Math.round(value),
      }));
  }, [filteredSales]);

  // Chart 6: year-over-year sales (uses ALL sales, not filtered)
  const yoySales = useMemo(() => {
    const now      = new Date();
    const curYear  = now.getFullYear();
    const prevYear = curYear - 1;
    const months   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months.map((month, i) => {
      const cur  = sales.filter(s => { const d = new Date(s.date_ad || ''); return d.getFullYear() === curYear  && d.getMonth() === i; }).reduce((acc, x) => acc + (x.total_amount || 0), 0);
      const prev = sales.filter(s => { const d = new Date(s.date_ad || ''); return d.getFullYear() === prevYear && d.getMonth() === i; }).reduce((acc, x) => acc + (x.total_amount || 0), 0);
      return { month, [curYear]: Math.round(cur), [prevYear]: Math.round(prev) };
    });
  }, [sales]);

  const curYear  = new Date().getFullYear();
  const prevYear = curYear - 1;

  // Chart 7: quotation funnel (all quotations, not filtered)
  const quotationFunnel = useMemo(() => {
    const statuses = ['pending', 'sent', 'accepted', 'rejected', 'expired'];
    return statuses.map(s => ({
      status: s.charAt(0).toUpperCase() + s.slice(1),
      statusKey: s,
      count: quotations.filter(q => q.status === s).length,
      value: quotations.filter(q => q.status === s).reduce((sum, q) => sum + (q.total_amount || 0), 0),
    }));
  }, [quotations]);

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 4 — Purchase & Vendor
  // ════════════════════════════════════════════════════════════════════════════

  // Chart 8: top 10 vendors
  const topVendors = useMemo(() => {
    const map = {};
    filteredPurchases.forEach(p => {
      const k = p.vendor_name || 'Unknown';
      map[k] = (map[k] || 0) + (p.total_amount || 0);
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, value]) => ({
        name:  name.length > 14 ? name.slice(0, 14) + '…' : name,
        value: Math.round(value),
      }));
  }, [filteredPurchases]);

  // Chart 9: purchase vs sales ratio (all data)
  const purchaseSalesRatio = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      const m = (s.date_ad || '').slice(0, 7);
      if (!m) return;
      if (!map[m]) map[m] = { month: new Date(m + '-01').toLocaleDateString('en-US', { month: 'short' }), sales: 0, purchases: 0 };
      map[m].sales += s.total_amount || 0;
    });
    purchases.forEach(p => {
      const m = (p.date_ad || '').slice(0, 7);
      if (!m) return;
      if (!map[m]) map[m] = { month: new Date(m + '-01').toLocaleDateString('en-US', { month: 'short' }), sales: 0, purchases: 0 };
      map[m].purchases += p.total_amount || 0;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ ...v, sales: Math.round(v.sales), purchases: Math.round(v.purchases) }));
  }, [sales, purchases]);

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 5 — Inventory
  // ════════════════════════════════════════════════════════════════════════════

  // Chart 10: fast vs slow movers
  const itemMovers = useMemo(() => {
    const map = {};
    filteredSales.forEach(order => {
      (order.items || []).forEach(item => {
        const k = item.description || 'Unknown';
        map[k] = (map[k] || 0) + (item.quantity || 0);
      });
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, qty]) => ({
        name: name.length > 14 ? name.slice(0, 14) + '…' : name,
        qty,
      }));
  }, [filteredSales]);

  // Chart 11: stock at risk
  const stockAtRisk = useMemo(() => {
    const soldRecently = new Set();
    const cutoff = new Date(Date.now() - 90 * 86400000);
    sales
      .filter(s => new Date(s.date_ad || '') > cutoff)
      .forEach(order => { (order.items || []).forEach(item => soldRecently.add(item.description)); });
    return inventory
      .filter(i => !soldRecently.has(i.description) && (i.quantity || 0) * (i.unit_cost || i.unit_selling_price || 0) > 10000)
      .map(i => ({
        name:  i.description,
        qty:   i.quantity,
        value: Math.round((i.quantity || 0) * (i.unit_cost || i.unit_selling_price || 0)),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [inventory, sales]);

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 6 — Payment Behaviour
  // ════════════════════════════════════════════════════════════════════════════

  // Chart 12: payment method breakdown
  const paymentMethods = useMemo(() => {
    const map = {};
    filteredTx.forEach(t => {
      const m = t.payment_method || 'Cash';
      map[m] = (map[m] || 0) + (t.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({
      name:  name.charAt(0).toUpperCase() + name.slice(1),
      value: Math.round(value),
    }));
  }, [filteredTx]);

  // Chart 13: avg payment delay per client
  const paymentDelay = useMemo(() => {
    const clientDelays = {};
    sales.forEach(s => {
      if (!s.client_name || !s.date_ad) return;
      const saleDate = new Date(s.date_ad);
      const payment  = transactions.find(t =>
        t.category === 'income' &&
        t.party_name === s.client_name &&
        new Date(t.date_ad || '') >= saleDate
      );
      if (payment && payment.date_ad) {
        const delay = Math.floor((new Date(payment.date_ad) - saleDate) / 86400000);
        if (!clientDelays[s.client_name]) clientDelays[s.client_name] = [];
        clientDelays[s.client_name].push(delay);
      }
    });
    return Object.entries(clientDelays)
      .map(([name, delays]) => ({
        name:    name.length > 14 ? name.slice(0, 14) + '…' : name,
        avgDays: Math.round(delays.reduce((a, b) => a + b, 0) / delays.length),
      }))
      .sort((a, b) => b.avgDays - a.avgDays)
      .slice(0, 8);
  }, [sales, transactions]);

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-8 animate-fade-in">

      {/* ── Page header + date range tabs ────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">Deep insights into your business</p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {['month', 'quarter', 'year', 'all'].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                range === r
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r === 'month' ? 'This Month' : r === 'quarter' ? 'This Quarter' : r === 'year' ? 'This Year' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {loading ? <LoadingSkeleton /> : (
        <>

          {/* ════════════════════════════════════════════════════════════════
              SECTION 1 — Profit & Loss
          ════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeader title="Profit & Loss" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Chart 1 — Income vs Expense vs Net Profit */}
              <div className="glass-card rounded-xl p-6">
                <p className="text-sm font-medium mb-4">Income vs Expense vs Net Profit</p>
                {monthlyPL.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={monthlyPL} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={nprFormatter} />
                      <Legend />
                      <Bar dataKey="income"  name="Income"     fill={COLORS.income}  radius={[3,3,0,0]} />
                      <Bar dataKey="expense" name="Expense"    fill={COLORS.expense} radius={[3,3,0,0]} />
                      <Line dataKey="profit" name="Net Profit" stroke={COLORS.profit} strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Chart 2 — Cumulative Cash Flow */}
              <div className="glass-card rounded-xl p-6">
                <p className="text-sm font-medium mb-4">Cumulative Cash Flow</p>
                {cumulativeCF.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={cumulativeCF} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cfGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="hsl(217,71%,53%)" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="hsl(217,71%,53%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={nprFormatter} />
                      <Area
                        dataKey="balance"
                        name="Running Balance"
                        stroke="hsl(217,71%,53%)"
                        fill="url(#cfGradient)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              SECTION 2 — Receivables & Payables
          ════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeader title="Receivables & Payables" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Chart 3 — Receivable Aging */}
              <div className="glass-card rounded-xl p-6">
                <p className="text-sm font-medium mb-4">Receivable Aging</p>
                {receivableAging.length === 0 ? <EmptyChart /> : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={receivableAging}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          dataKey="value"
                          paddingAngle={3}
                        >
                          {receivableAging.map((_, i) => (
                            <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={nprFormatter} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3 space-y-1">
                      {receivableAging.map((entry, i) => (
                        <div key={entry.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: AGING_COLORS[i % AGING_COLORS.length] }} />
                            {entry.name}
                          </span>
                          <span className="font-medium">NPR {entry.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Chart 4 — Payable Aging */}
              <div className="glass-card rounded-xl p-6">
                <p className="text-sm font-medium mb-4">Payable Aging</p>
                {payableAging.length === 0 ? <EmptyChart /> : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={payableAging}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          dataKey="value"
                          paddingAngle={3}
                        >
                          {payableAging.map((_, i) => (
                            <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={nprFormatter} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3 space-y-1">
                      {payableAging.map((entry, i) => (
                        <div key={entry.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: AGING_COLORS[i % AGING_COLORS.length] }} />
                            {entry.name}
                          </span>
                          <span className="font-medium">NPR {entry.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              SECTION 3 — Sales Intelligence
          ════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeader title="Sales Intelligence" />

            {/* Charts 5 & 6 — top row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

              {/* Chart 5 — Top 10 Clients */}
              <div className="glass-card rounded-xl p-6 lg:col-span-1">
                <p className="text-sm font-medium mb-4">Top 10 Clients by Revenue</p>
                {topClients.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={topClients}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={nprFormatter} />
                      <Bar dataKey="value" name="Revenue" fill={COLORS.primary} radius={[0,3,3,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Chart 6 — Year-over-Year Sales */}
              <div className="glass-card rounded-xl p-6 lg:col-span-2">
                <p className="text-sm font-medium mb-4">Year-over-Year Sales</p>
                {yoySales.every(d => d[curYear] === 0 && d[prevYear] === 0) ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={yoySales} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={nprFormatter} />
                      <Legend />
                      <Bar dataKey={curYear}  name={String(curYear)}  fill={COLORS.primary}           radius={[3,3,0,0]} />
                      <Bar dataKey={prevYear} name={String(prevYear)} fill={COLORS.primary} fillOpacity={0.5} radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 7 — Quotation Funnel */}
            <div className="glass-card rounded-xl p-6">
              <p className="text-sm font-medium mb-4">Quotation Funnel</p>
              {quotationFunnel.every(d => d.count === 0) ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={quotationFunnel}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="opacity-30" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="status" width={70} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v, name) => {
                        if (name === 'count') return [v, 'Count'];
                        return [`NPR ${Number(v).toLocaleString()}`, 'Value'];
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="count"
                      name="count"
                      radius={[0, 3, 3, 0]}
                    >
                      {quotationFunnel.map((entry) => (
                        <Cell key={entry.statusKey} fill={STATUS_COLORS[entry.statusKey] || COLORS.primary} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              SECTION 4 — Purchase & Vendor
          ════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeader title="Purchase & Vendor" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Chart 8 — Top 10 Vendors */}
              <div className="glass-card rounded-xl p-6">
                <p className="text-sm font-medium mb-4">Top 10 Vendors by Spend</p>
                {topVendors.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={topVendors}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={nprFormatter} />
                      <Bar dataKey="value" name="Spend" fill={COLORS.amber} radius={[0,3,3,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Chart 9 — Purchase vs Sales Ratio */}
              <div className="glass-card rounded-xl p-6">
                <p className="text-sm font-medium mb-4">Purchase vs Sales Trend</p>
                {purchaseSalesRatio.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={purchaseSalesRatio} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={nprFormatter} />
                      <Legend />
                      <Line dataKey="sales"     name="Sales"     stroke={COLORS.income}  strokeWidth={2} dot={false} />
                      <Line dataKey="purchases" name="Purchases" stroke={COLORS.expense} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              SECTION 5 — Inventory
          ════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeader title="Inventory" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Chart 10 — Fast vs Slow Movers */}
              <div className="glass-card rounded-xl p-6">
                <p className="text-sm font-medium mb-4">Fast vs Slow Movers (Top 10 by Qty Sold)</p>
                {itemMovers.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={itemMovers}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="qty" name="Qty Sold" fill={COLORS.primary} radius={[0,3,3,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Chart 11 — Stock Value at Risk */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-sm font-medium">Stock Value at Risk</p>
                  <span className="text-xs text-destructive font-medium bg-destructive/10 px-2 py-0.5 rounded-full">
                    90+ days no sales
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  These items have not sold in 90+ days
                </p>
                {stockAtRisk.length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                    No at-risk stock found
                  </div>
                ) : (
                  <div className="space-y-2 overflow-auto max-h-[280px] pr-1">
                    <div className="grid grid-cols-12 text-xs text-muted-foreground font-medium pb-1 border-b">
                      <span className="col-span-1">#</span>
                      <span className="col-span-6">Item</span>
                      <span className="col-span-2 text-right">Qty</span>
                      <span className="col-span-3 text-right">Value</span>
                    </div>
                    {stockAtRisk.map((item, i) => (
                      <div key={item.name} className="grid grid-cols-12 text-xs items-center py-1 border-b border-muted/40 last:border-0">
                        <span className="col-span-1 text-muted-foreground">{i + 1}</span>
                        <span className="col-span-6 truncate pr-2 font-medium">{item.name}</span>
                        <span className="col-span-2 text-right text-muted-foreground">{item.qty}</span>
                        <span className="col-span-3 text-right font-medium text-destructive">
                          NPR {item.value.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              SECTION 6 — Payment Behaviour
          ════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeader title="Payment Behaviour" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Chart 12 — Payment Method Breakdown */}
              <div className="glass-card rounded-xl p-6">
                <p className="text-sm font-medium mb-4">Payment Method Breakdown</p>
                {paymentMethods.length === 0 ? <EmptyChart /> : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={paymentMethods}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          paddingAngle={3}
                        >
                          {paymentMethods.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={nprFormatter} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3 space-y-1">
                      {paymentMethods.map((entry, i) => (
                        <div key={entry.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            {entry.name}
                          </span>
                          <span className="font-medium">NPR {entry.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Chart 13 — Avg Payment Delay per Client */}
              <div className="glass-card rounded-xl p-6">
                <p className="text-sm font-medium mb-4">Avg Payment Delay per Client (days)</p>
                {paymentDelay.length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                    Not enough data to calculate payment delays
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={paymentDelay}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} unit=" d" />
                      <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={v => [`${v} days`, 'Avg Delay']} />
                      <Bar dataKey="avgDays" name="Avg Days" fill={COLORS.amber} radius={[0,3,3,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>

        </>
      )}
    </div>
  );
}
