import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/adapter';
import {
  salesApi, purchaseApi, transactionApi, taskApi,
  inventoryApi, quotationApi, ledgerApi, bankAccountApi,
} from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import {
  TrendingUp, TrendingDown, ShoppingCart, Wallet, Building2,
  Package, CheckCircle2,
  ChevronDown, ChevronUp, BarChart2, ClipboardList,
  Activity, FileText, CreditCard, AlertCircle,
} from 'lucide-react';
import PageLoader from '../components/PageLoader';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ── Helpers ────────────────────────────────────────────────────────────────────
function unwrapArr(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

function fmt(n) {
  return Number(n || 0).toLocaleString();
}

function fmtNPR(n) {
  return `NPR ${fmt(n)}`;
}

// Nepali fiscal year: Shrawan 1 (≈ July 16) to Ashad End (≈ July 15)
function getFiscalYearRange() {
  const now = new Date();
  const yr = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  // If month is July(6) and day >= 16 onwards, or Aug-Dec, Jan-Jun: fiscal year starts current yr
  let fyStart, fyEnd;
  if (m > 6 || (m === 6 && now.getDate() >= 16)) {
    fyStart = new Date(yr, 6, 16);
    fyEnd   = new Date(yr + 1, 6, 15);
  } else {
    fyStart = new Date(yr - 1, 6, 16);
    fyEnd   = new Date(yr, 6, 15);
  }
  return { fyStart, fyEnd };
}

function inFiscalYear(dateStr) {
  if (!dateStr) return false;
  const { fyStart, fyEnd } = getFiscalYearRange();
  const d = new Date(dateStr);
  return d >= fyStart && d <= fyEnd;
}

// ── Collapsible Section ────────────────────────────────────────────────────────
function Section({ title, icon: Icon, iconClass = 'text-primary', open, onToggle, children }) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <span className={`flex items-center gap-2 font-semibold text-sm ${iconClass}`}>
          {Icon && <Icon className="w-4 h-4" />}
          {title}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────
function StatChip({ label, value, colorClass }) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-center ${colorClass}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[11px] font-medium mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { t } = useTranslation();
  const companyId = getActiveCompanyId();

  const [loading, setLoading]           = useState(true);
  const [sales, setSales]               = useState([]);
  const [purchases, setPurchases]       = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks]               = useState([]);
  const [inventory, setInventory]       = useState([]);
  const [quotations, setQuotations]     = useState([]);
  const [ledgerAccts, setLedgerAccts]   = useState([]);
  const [banks, setBanks]               = useState([]);

  // Section open/close
  const [finOpen, setFinOpen]   = useState(true);
  const [opsOpen, setOpsOpen]   = useState(true);
  const [actOpen, setActOpen]   = useState(true);

  // Cheque tab
  const [chequeTab, setChequeTab] = useState('receivable');

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }

    Promise.all([
      salesApi.list().catch(() => ({ data: [] })),
      purchaseApi.list().catch(() => ({ data: [] })),
      transactionApi.list().catch(() => ({ data: [] })),
      taskApi.list().catch(() => ({ data: [] })),
      inventoryApi.list().catch(() => ({ data: [] })),
      quotationApi.list().catch(() => ({ data: [] })),
      ledgerApi.accounts.list().catch(() => ({ data: [] })),
      bankAccountApi.list().catch(() => ({ data: [] })),
    ]).then(([s, p, t, tk, inv, q, la, b]) => {
      setSales(unwrapArr(s));
      setPurchases(unwrapArr(p));
      setTransactions(unwrapArr(t));
      setTasks(unwrapArr(tk));
      setInventory(unwrapArr(inv));
      setQuotations(unwrapArr(q));
      setLedgerAccts(unwrapArr(la));
      setBanks(unwrapArr(b));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [companyId]);

  if (!companyId) return <NoCompanyState />;
  if (loading)    return <PageLoader />;

  // ── Widget 1: KPI (fiscal year) ────────────────────────────────────────────
  const fyFilter = (arr, dateField = 'date') =>
    arr.filter(r => inFiscalYear(r[dateField] || r.date_ad || r.created_at));

  const fySales     = fyFilter(sales).reduce((s, r) => s + (r.total_amount || 0), 0);
  const fyPurchases = fyFilter(purchases).reduce((s, r) => s + (r.total_amount || 0), 0);
  const fyExpenses  = fyFilter(transactions)
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + (t.amount || 0), 0);

  // ── Widget 2: Cash In Hand ─────────────────────────────────────────────────
  const cashIn  = transactions.filter(t => t.payment_method === 'cash' && t.type === 'income')
                              .reduce((s, t) => s + (t.amount || 0), 0);
  const cashOut = transactions.filter(t => t.payment_method === 'cash' && t.type === 'expense')
                              .reduce((s, t) => s + (t.amount || 0), 0);
  const cashInHand = cashIn - cashOut;

  // ── Widget 3: Bank Balance ────────────────────────────────────────────────
  const totalBank = banks.reduce((s, b) => s + (b.current_balance || 0), 0);

  // ── Widget 4: Ledger Summary ──────────────────────────────────────────────
  const salesAccts    = ledgerAccts.filter(a => (a.account_type || a.accountType || '').toLowerCase().includes('sales') || (a.account_type || a.accountType || '').toLowerCase().includes('receivable'));
  const purchaseAccts = ledgerAccts.filter(a => (a.account_type || a.accountType || '').toLowerCase().includes('purchase') || (a.account_type || a.accountType || '').toLowerCase().includes('payable'));
  const expenseAccts  = ledgerAccts.filter(a => (a.account_type || a.accountType || '').toLowerCase().includes('expense'));

  const totalReceivable = salesAccts.reduce((s, a) => s + (a.balance || a.current_balance || 0), 0);
  const totalPayable    = purchaseAccts.reduce((s, a) => s + (a.balance || a.current_balance || 0), 0);

  const ledgerChartData = [
    { name: 'Sales/Receivable', amount: totalReceivable },
    { name: 'Purchase/Payable', amount: totalPayable },
    { name: 'Expenses',         amount: expenseAccts.reduce((s, a) => s + (a.balance || a.current_balance || 0), 0) },
  ];

  // ── Widget 5: Inventory ────────────────────────────────────────────────────
  const lowStock  = inventory.filter(i => i.quantity > 0 && i.quantity <= (i.reorder_level || i.reorderLevel || 5));
  const outOfStock = inventory.filter(i => (i.quantity || 0) === 0);
  const stockValue = inventory.reduce((s, i) => s + ((i.quantity || 0) * (i.selling_price || i.sellingPrice || 0)), 0);

  // Top selling items from sales items
  const itemSales = {};
  sales.forEach(sale => {
    const items = sale.items || sale.sales_items || [];
    items.forEach(item => {
      const key = item.item_name || item.description || item.name || 'Unknown';
      if (!itemSales[key]) itemSales[key] = { name: key, qty: 0, revenue: 0 };
      itemSales[key].qty     += (item.quantity || 0);
      itemSales[key].revenue += (item.total || item.amount || 0);
    });
  });
  const topItems = Object.values(itemSales).sort((a, b) => b.qty - a.qty).slice(0, 10);
  const top5     = topItems.slice(0, 5);

  // ── Widget 6: Quotations ───────────────────────────────────────────────────
  const quotStats = {
    pending:   quotations.filter(q => (q.status || '').toLowerCase() === 'pending'),
    accepted:  quotations.filter(q => (q.status || '').toLowerCase() === 'accepted'),
    cancelled: quotations.filter(q => (q.status || '').toLowerCase() === 'cancelled'),
    revised:   quotations.filter(q => (q.status || '').toLowerCase() === 'revised'),
    billed:    quotations.filter(q => ['billed', 'converted', 'invoiced'].includes((q.status || '').toLowerCase())),
  };
  const qTotal = (arr) => arr.reduce((s, q) => s + (q.total_amount || q.totalAmount || 0), 0);

  // ── Widget 7: Tasks ────────────────────────────────────────────────────────
  const taskCompleted  = tasks.filter(t => (t.status || '').toLowerCase() === 'completed');
  const taskInProgress = tasks.filter(t => (t.status || '').toLowerCase().includes('progress'));
  const taskPending    = tasks.filter(t => (t.status || '').toLowerCase() === 'pending' || (t.status || '').toLowerCase() === 'todo');
  const activeTasks    = [...taskInProgress, ...taskPending];
  const todayDate      = new Date();
  todayDate.setHours(0, 0, 0, 0);

  function isOverdue(task) {
    const d = task.due_date || task.dueDate;
    if (!d) return false;
    return new Date(d) < todayDate && (task.status || '').toLowerCase() !== 'completed';
  }

  // ── Widget 8: Transactions / Cheque Reminders ─────────────────────────────
  const fyTxns = fyFilter(transactions);
  const fyInflow  = fyTxns.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const fyOutflow = fyTxns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);

  // Monthly cash flow chart (last 6 months)
  const monthlyFlow = {};
  transactions.forEach(t => {
    const m = (t.date || t.date_ad || '').slice(0, 7);
    if (!m) return;
    if (!monthlyFlow[m]) monthlyFlow[m] = { month: m, inflow: 0, outflow: 0 };
    if (t.type === 'income')  monthlyFlow[m].inflow  += (t.amount || 0);
    if (t.type === 'expense') monthlyFlow[m].outflow += (t.amount || 0);
  });
  const flowChart = Object.values(monthlyFlow).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);

  // Cheque/Credit transactions are recorded as PENDING until they actually clear (see
  // TransactionServiceImpl) — surfaced here, sorted soonest-first, so they aren't
  // forgotten before their date arrives (or after it's overdue).
  const pendingReminders  = transactions.filter(t => t.status === 'PENDING' && (t.type === 'CHEQUE' || t.type === 'CREDIT'));
  const sortByDate        = (a, b) => new Date(a.dateAd) - new Date(b.dateAd);
  const remindersReceivable = pendingReminders.filter(t => t.category === 'INCOME').sort(sortByDate);
  const remindersPayable    = pendingReminders.filter(t => t.category !== 'INCOME').sort(sortByDate);

  async function markReminderCompleted(id) {
    await transactionApi.update(id, { status: 'COMPLETED' });
    const res = await transactionApi.list().catch(() => ({ data: [] }));
    setTransactions(unwrapArr(res));
  }

  // ── Widget 10: Financial Health ────────────────────────────────────────────
  const netPnL       = fySales - fyPurchases - fyExpenses;
  const grossMargin  = fySales > 0 ? ((fySales - fyPurchases) / fySales) * 100 : 0;
  const pnlPositive  = netPnL >= 0;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('bizDashboard.title', { defaultValue: 'Dashboard' })}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('bizDashboard.subtitle', { defaultValue: 'Business overview · Your Company' })}</p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — Financial Overview                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Section
        title={t('bizDashboard.financialOverview', { defaultValue: 'Financial Overview' })}
        icon={BarChart2}
        iconClass="text-blue-600"
        open={finOpen}
        onToggle={() => setFinOpen(p => !p)}
      >
        {/* Widget 1 — KPI Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{fmtNPR(fySales)}</p>
              <p className="text-xs text-green-600 mt-0.5">{t('bizDashboard.totalSalesFY', { defaultValue: 'Total Sales (FY)' })}</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">{fmtNPR(fyPurchases)}</p>
              <p className="text-xs text-blue-600 mt-0.5">{t('bizDashboard.totalPurchaseFY', { defaultValue: 'Total Purchase (FY)' })}</p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{fmtNPR(fyExpenses)}</p>
              <p className="text-xs text-red-600 mt-0.5">{t('bizDashboard.totalExpensesFY', { defaultValue: 'Total Expenses (FY)' })}</p>
            </div>
          </div>
        </div>

        {/* Widget 2 + Widget 3 side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {/* Widget 2 — Cash In Hand */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-foreground">{t('bizDashboard.cashInHand', { defaultValue: 'Cash In Hand' })}</h3>
            </div>
            <p className={`text-3xl font-bold ${cashInHand >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmtNPR(Math.abs(cashInHand))}
              {cashInHand < 0 && <span className="text-base ml-1">{t('bizDashboard.negativeParens', { defaultValue: '(negative)' })}</span>}
            </p>
            <p className="text-xs text-muted-foreground mt-2">{t('bizDashboard.excludesBankBalance', { defaultValue: 'Excludes bank balance' })}</p>
            <div className="flex gap-4 mt-3 text-xs">
              <span className="text-green-600">{t('bizDashboard.cashIn', { defaultValue: 'Cash in' })}: {fmtNPR(cashIn)}</span>
              <span className="text-red-500">{t('bizDashboard.cashOut', { defaultValue: 'Cash out' })}: {fmtNPR(cashOut)}</span>
            </div>
          </div>

          {/* Widget 3 — Bank Balance */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-foreground">{t('bizDashboard.bankBalance', { defaultValue: 'Bank Balance' })}</h3>
            </div>
            <p className="text-3xl font-bold text-blue-700">{fmtNPR(totalBank)}</p>
            <p className="text-xs text-muted-foreground mt-2 mb-3">{t('bizDashboard.combinedAcrossAccounts', { defaultValue: 'Combined across all accounts' })}</p>
            {banks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">{t('bizDashboard.noDataYet', { defaultValue: 'No data yet' })}</p>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {banks.map((bank, i) => {
                  const acct = bank.account_number || bank.accountNumber || '';
                  return (
                    <div key={bank.id || i} className="flex items-center justify-between text-xs">
                      <span className="text-foreground font-medium truncate max-w-[140px]">
                        {bank.bank_name || bank.bankName || bank.name || t('bizDashboard.account', { defaultValue: 'Account' })}
                        {acct && <span className="text-muted-foreground ml-1">···{acct.slice(-4)}</span>}
                      </span>
                      <span className="font-mono text-blue-600 shrink-0">{fmtNPR(bank.current_balance || 0)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Widget 10 — Financial Health (P&L) */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-semibold text-foreground">{t('bizDashboard.financialHealth', { defaultValue: 'Financial Health' })}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{t('bizDashboard.netPnLFY', { defaultValue: 'Net P&L (FY)' })}</p>
              <p className={`text-2xl font-bold ${pnlPositive ? 'text-green-600' : 'text-red-600'}`}>
                {fmtNPR(Math.abs(netPnL))}
              </p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pnlPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {pnlPositive ? t('bizDashboard.profit', { defaultValue: 'Profit' }) : t('bizDashboard.loss', { defaultValue: 'Loss' })}
              </span>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{t('bizDashboard.grossMargin', { defaultValue: 'Gross Margin' })}</p>
              <p className={`text-2xl font-bold ${grossMargin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {grossMargin.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">{t('bizDashboard.salesMinusPurchaseOverSales', { defaultValue: '(Sales − Purchase) / Sales' })}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{t('bizDashboard.expenseRatio', { defaultValue: 'Expense Ratio' })}</p>
              <p className="text-2xl font-bold text-orange-600">
                {fySales > 0 ? ((fyExpenses / fySales) * 100).toFixed(1) : '0.0'}%
              </p>
              <p className="text-xs text-muted-foreground">{t('bizDashboard.expensesOverSales', { defaultValue: 'Expenses / Sales' })}</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — Operations                                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Section
        title={t('bizDashboard.operations', { defaultValue: 'Operations' })}
        icon={ClipboardList}
        iconClass="text-emerald-600"
        open={opsOpen}
        onToggle={() => setOpsOpen(p => !p)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

          {/* Widget 5 — Inventory Overview */}
          <div className="bg-card border border-border rounded-xl p-5 xl:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-foreground">{t('bizDashboard.inventoryOverview', { defaultValue: 'Inventory Overview' })}</h3>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <StatChip label={t('bizDashboard.totalItems', { defaultValue: 'Total Items' })}   value={inventory.length}  colorClass="bg-blue-50 border-blue-200 text-blue-700" />
              <StatChip label={t('bizDashboard.lowStock', { defaultValue: 'Low Stock' })}     value={lowStock.length}   colorClass="bg-amber-50 border-amber-200 text-amber-700" />
              <StatChip label={t('bizDashboard.outOfStock', { defaultValue: 'Out of Stock' })}  value={outOfStock.length} colorClass="bg-red-50 border-red-200 text-red-700" />
            </div>

            {/* Stock value */}
            <p className="text-xs text-muted-foreground mb-3">
              {t('bizDashboard.totalStockValue', { defaultValue: 'Total Stock Value' })}: <span className="font-semibold text-foreground">{fmtNPR(stockValue)}</span>
            </p>

            {/* Top 5 selling items chart */}
            {top5.length > 0 ? (
              <>
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('bizDashboard.top5ItemsByQtySold', { defaultValue: 'Top 5 Items by Qty Sold' })}</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={top5} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={40} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip formatter={(v) => [`${v} ${t('bizDashboard.units', { defaultValue: 'units' })}`, t('bizDashboard.qtySold', { defaultValue: 'Qty Sold' })]} />
                    <Bar dataKey="qty" name={t('bizDashboard.qtySold', { defaultValue: 'Qty Sold' })} fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">{t('bizDashboard.noDataYet', { defaultValue: 'No data yet' })}</div>
            )}

            {/* Top 10 list */}
            {topItems.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('bizDashboard.top10SellingItems', { defaultValue: 'Top 10 Selling Items' })}</p>
                <div className="space-y-1">
                  {topItems.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-4 text-right">{i + 1}.</span>
                      <span className="flex-1 truncate text-foreground">{item.name}</span>
                      <span className="font-mono text-emerald-600 shrink-0">{item.qty} {t('bizDashboard.units', { defaultValue: 'units' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Widget 6 — Quotation Reports */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-violet-500" />
              <h3 className="text-sm font-semibold text-foreground">{t('bizDashboard.quotationReports', { defaultValue: 'Quotation Reports' })}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {t('bizDashboard.total', { defaultValue: 'Total' })}: <span className="font-semibold text-foreground">{quotations.length}</span> {t('bizDashboard.quotations', { defaultValue: 'quotations' })}
            </p>

            {quotations.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">{t('bizDashboard.noDataYet', { defaultValue: 'No data yet' })}</p>
            ) : (
              <div className="space-y-2">
                {[
                  { key: 'pending',   label: t('bizDashboard.quotPending', { defaultValue: 'Pending' }),   color: 'bg-amber-50 border-amber-200 text-amber-700' },
                  { key: 'accepted',  label: t('bizDashboard.quotAccepted', { defaultValue: 'Accepted' }),  color: 'bg-green-50 border-green-200 text-green-700' },
                  { key: 'cancelled', label: t('bizDashboard.quotCancelled', { defaultValue: 'Cancelled' }), color: 'bg-red-50 border-red-200 text-red-700' },
                  { key: 'revised',   label: t('bizDashboard.quotRevised', { defaultValue: 'Revised' }),   color: 'bg-purple-50 border-purple-200 text-purple-700' },
                  { key: 'billed',    label: t('bizDashboard.quotBilled', { defaultValue: 'Billed' }),    color: 'bg-blue-50 border-blue-200 text-blue-700' },
                ].map(({ key, label, color }) => {
                  const arr = quotStats[key];
                  return (
                    <div key={key} className={`rounded-lg border px-3 py-2 flex items-center justify-between ${color}`}>
                      <div>
                        <span className="text-xs font-semibold">{label}</span>
                        <span className="text-xs ml-2 opacity-70">({arr.length})</span>
                      </div>
                      <span className="text-xs font-mono font-semibold">{fmtNPR(qTotal(arr))}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Widget 4 — Ledger Summary (full width row) */}
        <div className="bg-card border border-border rounded-xl p-5 mt-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-foreground">{t('bizDashboard.ledgerSummary', { defaultValue: 'Ledger Summary' })}</h3>
          </div>

          {ledgerAccts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">{t('bizDashboard.noDataYet', { defaultValue: 'No data yet' })}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ledgerChartData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmtNPR(v)} />
                  <Bar dataKey="amount" name={t('bizDashboard.balance', { defaultValue: 'Balance' })} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="space-y-3">
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                  <p className="text-xs text-green-600 font-medium">{t('bizDashboard.totalReceivable', { defaultValue: 'Total Receivable' })}</p>
                  <p className="text-xl font-bold text-green-700 mt-1">{fmtNPR(totalReceivable)}</p>
                  <p className="text-[10px] text-green-500 mt-0.5">{t('bizDashboard.sumOfReceivableBalances', { defaultValue: 'Sum of sales/receivable account balances' })}</p>
                </div>
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-xs text-red-600 font-medium">{t('bizDashboard.totalPayable', { defaultValue: 'Total Payable' })}</p>
                  <p className="text-xl font-bold text-red-700 mt-1">{fmtNPR(totalPayable)}</p>
                  <p className="text-[10px] text-red-400 mt-0.5">{t('bizDashboard.sumOfPayableBalances', { defaultValue: 'Sum of purchase/payable account balances' })}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — Activity                                                  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Section
        title={t('bizDashboard.activity', { defaultValue: 'Activity' })}
        icon={Activity}
        iconClass="text-orange-600"
        open={actOpen}
        onToggle={() => setActOpen(p => !p)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

          {/* Widget 7 — Task Reports */}
          <div className="bg-card border border-border rounded-xl p-5 xl:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-teal-500" />
              <h3 className="text-sm font-semibold text-foreground">{t('bizDashboard.taskReports', { defaultValue: 'Task Reports' })}</h3>
            </div>

            {/* Task counts */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <StatChip label={t('bizDashboard.completed', { defaultValue: 'Completed' })}   value={taskCompleted.length}  colorClass="bg-green-50 border-green-200 text-green-700" />
              <StatChip label={t('bizDashboard.inProgress', { defaultValue: 'In Progress' })} value={taskInProgress.length} colorClass="bg-blue-50 border-blue-200 text-blue-700" />
              <StatChip label={t('bizDashboard.pending', { defaultValue: 'Pending' })}     value={taskPending.length}    colorClass="bg-amber-50 border-amber-200 text-amber-700" />
              <StatChip label={t('bizDashboard.total', { defaultValue: 'Total' })}       value={tasks.length}          colorClass="bg-gray-50 border-gray-200 text-gray-700" />
            </div>

            {/* Active tasks list */}
            <p className="text-xs font-medium text-muted-foreground mb-2">{t('bizDashboard.activeTasks', { defaultValue: 'Active Tasks' })}</p>
            {activeTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">{t('bizDashboard.noActiveTasks', { defaultValue: 'No active tasks' })}</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {activeTasks.map((task, i) => {
                  const overdue  = isOverdue(task);
                  const dueDate  = task.due_date || task.dueDate;
                  const assignee = task.assignee || task.assigned_to || task.assignedTo || '';
                  return (
                    <div
                      key={task.id || i}
                      className={`rounded-lg border px-3 py-2 ${overdue ? 'bg-red-50 border-red-200' : 'bg-muted/30 border-border'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-medium truncate flex-1 ${overdue ? 'text-red-700' : 'text-foreground'}`}>
                          {task.title || task.name || t('bizDashboard.untitled', { defaultValue: 'Untitled' })}
                        </p>
                        {overdue && (
                          <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full shrink-0">
                            {t('bizDashboard.overdue', { defaultValue: 'Overdue' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {assignee && <span className="text-[10px] text-muted-foreground truncate">{assignee}</span>}
                        {dueDate && (
                          <span className={`text-[10px] shrink-0 ml-auto ${overdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                            {t('bizDashboard.due', { defaultValue: 'Due' })}: {new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Widget 8 — Transactions & Cheque Reminders */}
          <div className="bg-card border border-border rounded-xl p-5 xl:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-semibold text-foreground">{t('bizDashboard.transactionsAndChequeReminders', { defaultValue: 'Transactions & Cheque Reminders' })}</h3>
            </div>

            {/* Cash flow KPIs */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <p className="text-xs text-green-600 font-medium">{t('bizDashboard.totalInflowFY', { defaultValue: 'Total Inflow (FY)' })}</p>
                <p className="text-xl font-bold text-green-700 mt-0.5">{fmtNPR(fyInflow)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-xs text-red-500 font-medium">{t('bizDashboard.totalOutflowFY', { defaultValue: 'Total Outflow (FY)' })}</p>
                <p className="text-xl font-bold text-red-600 mt-0.5">{fmtNPR(fyOutflow)}</p>
              </div>
            </div>

            {/* Area chart */}
            {flowChart.length > 0 ? (
              <>
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('bizDashboard.monthlyCashFlow', { defaultValue: 'Monthly Cash Flow' })}</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={flowChart} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => fmtNPR(v)} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="inflow"  name={t('bizDashboard.inflow', { defaultValue: 'Inflow' })}  stroke="#10b981" fill="url(#inflowGrad)"  strokeWidth={2} />
                    <Area type="monotone" dataKey="outflow" name={t('bizDashboard.outflow', { defaultValue: 'Outflow' })} stroke="#ef4444" fill="url(#outflowGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">{t('bizDashboard.noDataYet', { defaultValue: 'No data yet' })}</div>
            )}

            {/* Pending Reminders — Cheque & Credit transactions awaiting clearance */}
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-xs font-semibold text-foreground">{t('bizDashboard.pendingRemindersChequeCredit', { defaultValue: 'Pending Reminders (Cheque & Credit)' })}</p>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-3 bg-muted/30 rounded-lg p-1 w-fit">
                {[
                  { key: 'receivable', label: t('bizDashboard.receivableCount', { defaultValue: `Receivable (${remindersReceivable.length})`, count: remindersReceivable.length }) },
                  { key: 'payable',    label: t('bizDashboard.payableCount', { defaultValue: `Payable (${remindersPayable.length})`, count: remindersPayable.length }) },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setChequeTab(tab.key)}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                      chequeTab === tab.key
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Reminder list */}
              {(() => {
                const list = chequeTab === 'receivable' ? remindersReceivable : remindersPayable;
                const chequeTabLabel = chequeTab === 'receivable'
                  ? t('bizDashboard.receivable', { defaultValue: 'receivable' })
                  : t('bizDashboard.payable', { defaultValue: 'payable' });
                if (list.length === 0) {
                  return <p className="text-xs text-muted-foreground italic">{t('bizDashboard.noPendingReminders', { defaultValue: `No pending ${chequeTabLabel} reminders`, type: chequeTabLabel })}</p>;
                }
                return (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {list.map((txn, i) => {
                      const pastDue = txn.dateAd && new Date(txn.dateAd) < todayDate;
                      return (
                        <div
                          key={txn.id || i}
                          className={`rounded-lg border px-3 py-2 flex items-center gap-3 ${pastDue ? 'bg-red-50 border-red-200' : 'bg-amber-50/60 border-amber-200'}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{txn.type}</span>
                              <p className={`text-xs font-medium truncate ${pastDue ? 'text-red-700' : 'text-foreground'}`}>
                                {txn.partyName ? `${txn.partyName} — ` : ''}{txn.description || t('bizDashboard.untitled', { defaultValue: 'Untitled' })}
                              </p>
                            </div>
                            {txn.dateAd && (
                              <p className={`text-[10px] mt-0.5 ${pastDue ? 'text-red-500' : 'text-muted-foreground'}`}>
                                {pastDue ? t('bizDashboard.overdueDot', { defaultValue: 'Overdue · ' }) : t('bizDashboard.dueSpace', { defaultValue: 'Due ' })}
                                {new Date(txn.dateAd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0 flex items-center gap-2">
                            <p className={`text-xs font-mono font-semibold ${pastDue ? 'text-red-600' : 'text-foreground'}`}>
                              {fmtNPR(txn.amount)}
                            </p>
                            <button
                              onClick={() => markReminderCompleted(txn.id)}
                              className="text-[10px] font-medium px-2 py-1 rounded-md border border-border bg-card hover:bg-muted transition-colors"
                            >
                              {t('bizDashboard.markCompleted', { defaultValue: 'Mark Completed' })}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

        </div>
      </Section>
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
      <h2 className="text-xl font-bold text-foreground mb-2">{t('bizDashboard.welcomeToEasyBooks', { defaultValue: 'Welcome to EasyBooks' })}</h2>
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
