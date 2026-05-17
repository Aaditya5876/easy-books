import { useState, useEffect } from 'react';
import { api } from '@/api/adapter';
import { getActiveCompanyId } from '@/lib/companyContext';
import {
  Package,
  ShoppingCart,
  Receipt,
  Wallet,
  AlertTriangle,
  Banknote,
  BarChart3,
  ClipboardList,
  CheckCircle2,
  ArrowLeftRight,
  Building2,
} from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalInventory: 0,
    lowStock: 0,
    outOfStock: 0,
    totalPurchases: 0,
    totalSales: 0,
    totalExpenses: 0,
    cashInHand: 0,
    bankBalance: 0,
    totalReceivable: 0,
    totalPayable: 0,
    salesCount: 0,
    purchaseCount: 0,
    expenseCount: 0,
  });
  const [bankAccounts, setBankAccounts] = useState([]);
  const [ledgerChartData, setLedgerChartData] = useState([]);
  const [quotationCategories, setQuotationCategories] = useState([]);
  const [inventoryMovementData, setInventoryMovementData] = useState([]);
  const [topSellingItems, setTopSellingItems] = useState([]);
  const [inventorySoldValue, setInventorySoldValue] = useState(0);
  const [inventoryInHandValue, setInventoryInHandValue] = useState(0);
  const [taskLists, setTaskLists] = useState({ inProgress: [], incomplete: [], completedCount: 0 });
  const [cashFlow, setCashFlow] = useState({ inflow: 0, outflow: 0 });
  const [chequePayableDue, setChequePayableDue] = useState([]);
  const [chequeReceivableDue, setChequeReceivableDue] = useState([]);
  const companyId = getActiveCompanyId();

  useEffect(() => {
    loadDashboardData();
  }, [companyId]);

  async function loadDashboardData() {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const [inventory, purchases, sales, transactions, quotations, banks, clients, tasks] = await Promise.all([
      api.InventoryItem.filter({ company_id: companyId }),
      api.PurchaseOrder.filter({ company_id: companyId }, '-created_date', 20),
      api.SalesOrder.filter({ company_id: companyId }, '-created_date', 200),
      api.Transaction.filter({ company_id: companyId }, '-created_date', 200),
      api.Quotation.filter({ company_id: companyId }),
      api.BankAccount.filter({ company_id: companyId }),
      api.Client.filter({ company_id: companyId }),
      api.Task.filter({ company_id: companyId }),
    ]);

    const lowStockItems = inventory.filter(i => (i.quantity || 0) <= (i.low_stock_threshold || 5));
    const outOfStockCount = inventory.filter(i => (i.quantity || 0) <= 0).length;
    const totalPurchaseAmt = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const totalSalesAmt = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalExpenses = transactions.filter(t => t.category === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalIncome = transactions.filter(t => t.category === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
    const receivableTotal = totalIncome;
    const payableTotal = totalExpenses;
    const cashTransactions = transactions.filter(t => t.type === 'cash');
    const cashInflow = cashTransactions.filter(t => t.category === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
    const cashOutflow = cashTransactions.filter(t => t.category === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
    const bankBalance = banks.reduce((sum, b) => sum + (b.current_balance || 0), 0);
    const expenseCount = transactions.filter(t => t.category === 'expense').length;

    const quotationLabels = ['Quoted', 'Work-done', 'Cancelled', 'Revised', 'Billed'];
    const quotationCategories = quotationLabels.map(label => {
      const items = quotations.filter(q => ((q.remark || '').toLowerCase() === label.toLowerCase()) || ((q.status || '').toLowerCase() === label.toLowerCase()));
      return {
        name: label,
        count: items.length,
        totalValue: items.reduce((sum, q) => sum + (q.total_amount || q.amount || 0), 0),
      };
    });

    const normalizeStatus = status => (status || '').toString().trim().toLowerCase();
    const completedTasks = tasks.filter(t => ['completed', 'complete'].includes(normalizeStatus(t.status)));
    const inProgressTasks = tasks.filter(t => ['in-progress', 'in progress', 'ongoing'].includes(normalizeStatus(t.status)));
    const incompleteTasks = tasks.filter(t => !['completed', 'complete', 'in-progress', 'in progress', 'ongoing'].includes(normalizeStatus(t.status)));

    const itemSalesMap = {};
    sales.forEach(order => {
      (order.items || []).forEach(item => {
        const key = item.description || item.product_name || item.inventory_item_id || 'Unknown Item';
        if (!itemSalesMap[key]) itemSalesMap[key] = { name: key, qty: 0, value: 0 };
        itemSalesMap[key].qty += item.quantity || 0;
        itemSalesMap[key].value += item.total || 0;
      });
    });
    const topSelling = Object.values(itemSalesMap).sort((a, b) => b.value - a.value).slice(0, 10);

    const movementMap = {};
    const addMovement = (date, purchasedQty, soldQty) => {
      const dt = date ? new Date(date) : null;
      if (!dt || Number.isNaN(dt.getTime())) return;
      const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const label = dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!movementMap[monthKey]) {
        movementMap[monthKey] = { monthKey, name: label, purchased: 0, sold: 0 };
      }
      movementMap[monthKey].purchased += purchasedQty;
      movementMap[monthKey].sold += soldQty;
    };

    purchases.forEach(order => {
      const purchasedQty = (order.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
      addMovement(order.date_ad || order.created_date, purchasedQty, 0);
    });
    sales.forEach(order => {
      const soldQty = (order.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
      addMovement(order.date_ad || order.created_date, 0, soldQty);
    });

    const inventoryMovementData = Object.values(movementMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    const bankAccounts = banks.map(account => ({
      id: account.id,
      name: account.account_name || account.bank_name || account.name || 'Bank Account',
      balance: account.current_balance || 0,
    }));

    const chequeDue = transactions.filter(t => t.type === 'cheque' && t.cheque_date && new Date(t.cheque_date) < new Date() && t.status !== 'completed');
    const chequePayableDueList = chequeDue.filter(t => t.category === 'expense');
    const chequeReceivableDueList = chequeDue.filter(t => t.category === 'income');

    setStats({
      totalInventory: inventory.length,
      lowStock: lowStockItems.length,
      outOfStock: outOfStockCount,
      totalPurchases: totalPurchaseAmt,
      totalSales: totalSalesAmt,
      totalExpenses,
      cashInHand: cashInflow - cashOutflow,
      bankBalance,
      totalReceivable: receivableTotal,
      totalPayable: payableTotal,
      salesCount: sales.length,
      purchaseCount: purchases.length,
      expenseCount,
    });
    setBankAccounts(bankAccounts);
    setLedgerChartData([
      { name: 'Sales', value: totalSalesAmt },
      { name: 'Purchases', value: totalPurchaseAmt },
      { name: 'Expenses', value: totalExpenses },
    ]);
    setQuotationCategories(quotationCategories);
    setInventoryMovementData(inventoryMovementData);
    setTopSellingItems(topSelling);
    setInventorySoldValue(totalSalesAmt);
    setInventoryInHandValue(inventory.reduce((sum, i) => sum + ((i.quantity || 0) * (i.unit_selling_price || 0)), 0));
    setTaskLists({ inProgress: inProgressTasks, incomplete: incompleteTasks, completedCount: completedTasks.length });
    setCashFlow({ inflow: cashInflow, outflow: cashOutflow });
    setChequePayableDue(chequePayableDueList);
    setChequeReceivableDue(chequeReceivableDueList);
    setLoading(false);
  }

  if (!companyId) {
    return <NoCompanyState />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Business overview at a glance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={Receipt}
          label="Total Sales"
          value={`NPR ${stats.totalSales.toLocaleString()}`}
          subtitle="Overall sales this fiscal year"
          trend={stats.totalSales > 0 ? 'Updated' : undefined}
          trendUp={true}
        />
        <StatCard
          icon={ShoppingCart}
          label="Total Purchase"
          value={`NPR ${stats.totalPurchases.toLocaleString()}`}
          subtitle="Overall purchases this fiscal year"
        />
        <StatCard
          icon={AlertTriangle}
          label="Total Expenses"
          value={`NPR ${stats.totalExpenses.toLocaleString()}`}
          subtitle="Overall expenses this fiscal year"
          trendUp={false}
        />
        <StatCard
          icon={Wallet}
          label="Cash In Hand"
          value={`NPR ${stats.cashInHand.toLocaleString()}`}
          subtitle="Cash excluding bank accounts"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Bank Balance</h3>
              <p className="text-xs text-muted-foreground">Combined accounts with individual balances</p>
            </div>
            <Banknote className="w-5 h-5 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground">NPR {stats.bankBalance.toLocaleString()}</p>
          <div className="mt-5 space-y-3">
            {bankAccounts.length > 0 ? bankAccounts.map(account => (
              <div key={account.id} className="rounded-2xl bg-muted/40 p-4">
                <p className="text-sm font-medium text-foreground truncate">{account.name}</p>
                <p className="text-sm text-muted-foreground">NPR {account.balance.toLocaleString()}</p>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">No bank accounts available.</p>
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Ledger Summary</h3>
              <p className="text-xs text-muted-foreground">Sales, purchases and expenses</p>
            </div>
            <BarChart3 className="w-5 h-5 text-emerald-600" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ledgerChartData} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`NPR ${value.toLocaleString()}`, 'Amount']} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {ledgerChartData.map(entry => (
                  <Cell key={entry.name} fill={entry.name === 'Expenses' ? 'hsl(0, 84%, 60%)' : entry.name === 'Purchases' ? 'hsl(38, 92%, 50%)' : 'hsl(217, 71%, 53%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-3 mt-5 text-xs text-muted-foreground">
            <div className="rounded-2xl bg-muted/40 p-3">
              <p className="uppercase tracking-[0.2em]">Sales Count</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{stats.salesCount}</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-3">
              <p className="uppercase tracking-[0.2em]">Purchase Count</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{stats.purchaseCount}</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-3">
              <p className="uppercase tracking-[0.2em]">Expense Count</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{stats.expenseCount}</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-3">
              <p className="uppercase tracking-[0.2em]">Payable / Receivable</p>
              <p className="mt-2 text-sm font-semibold text-foreground">NPR {stats.totalReceivable.toLocaleString()} / NPR {stats.totalPayable.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Quotation Reports</h3>
              <p className="text-xs text-muted-foreground">Count and value by category</p>
            </div>
            <ClipboardList className="w-5 h-5 text-sky-600" />
          </div>
          <div className="space-y-3">
            {quotationCategories.map(category => (
              <div key={category.name} className="rounded-2xl bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{category.name}</p>
                  <p className="text-xs text-muted-foreground">{category.count}</p>
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">NPR {category.totalValue.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Inventory Overview</h3>
              <p className="text-xs text-muted-foreground">Stock status, top sellers and movement</p>
            </div>
            <Package className="w-5 h-5 text-cyan-600" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Total Items</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{stats.totalInventory}</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Low Stock</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{stats.lowStock}</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Out of Stock</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{stats.outOfStock}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Stock Value by Selling Price</p>
              <p className="mt-2 text-lg font-semibold text-foreground">NPR {inventoryInHandValue.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Value Sold This Fiscal Year</p>
              <p className="mt-2 text-lg font-semibold text-foreground">NPR {inventorySoldValue.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-foreground mb-3">Top 10 Highest Selling Items</h4>
            {topSellingItems.length > 0 ? (
              <div className="space-y-3">
                {topSellingItems.map(item => (
                  <div key={item.name} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.qty} units</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground">NPR {item.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No sales item data available.</p>
            )}
          </div>
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-foreground mb-3">Stock Purchased vs Sold</h4>
            {inventoryMovementData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={inventoryMovementData} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [value.toLocaleString(), 'Units']} />
                  <Bar dataKey="purchased" name="Purchased" fill="hsl(160, 60%, 45%)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="sold" name="Sold" fill="hsl(217, 71%, 53%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">No stock movement data available.</div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Task Reports & Reminder</h3>
              <p className="text-xs text-muted-foreground">Status counts and pending assignments</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Completed</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{taskLists.completedCount}</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">In Progress</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{taskLists.inProgress.length}</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Incomplete</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{taskLists.incomplete.length}</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-foreground">In Progress</h4>
                <span className="text-xs text-muted-foreground">{taskLists.inProgress.length} tasks</span>
              </div>
              {taskLists.inProgress.length > 0 ? (
                <div className="space-y-3">
                  {taskLists.inProgress.map(task => (
                    <div key={task.id} className="rounded-2xl bg-muted/40 p-4">
                      <p className="text-sm font-medium text-foreground truncate">{task.title || 'Untitled task'}</p>
                      <p className="text-xs text-muted-foreground mt-1">Assigned to: {task.assigned_name || task.assigned_to || 'Unassigned'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No in-progress tasks.</p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-foreground">Incomplete</h4>
                <span className="text-xs text-muted-foreground">{taskLists.incomplete.length} tasks</span>
              </div>
              {taskLists.incomplete.length > 0 ? (
                <div className="space-y-3">
                  {taskLists.incomplete.map(task => (
                    <div key={task.id} className="rounded-2xl bg-muted/40 p-4">
                      <p className="text-sm font-medium text-foreground truncate">{task.title || 'Untitled task'}</p>
                      <p className="text-xs text-muted-foreground mt-1">Assigned to: {task.assigned_name || task.assigned_to || 'Unassigned'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No incomplete tasks.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Transactions</h3>
            <p className="text-xs text-muted-foreground">Cash inflow/outflow and cheque reminders</p>
          </div>
          <ArrowLeftRight className="w-5 h-5 text-slate-600" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-muted/40 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Cash Inflow</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">NPR {cashFlow.inflow.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl bg-muted/40 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Cash Outflow</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">NPR {cashFlow.outflow.toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-muted/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-foreground">Payable Cheque Reminders</h4>
              <span className="text-xs text-muted-foreground">{chequePayableDue.length}</span>
            </div>
            {chequePayableDue.length > 0 ? (
              <div className="space-y-3">
                {chequePayableDue.map(txn => (
                  <div key={txn.id} className="rounded-2xl bg-white p-3 border border-border">
                    <p className="text-sm font-medium text-foreground truncate">{txn.cheque_name || txn.party_name || txn.description || 'Cheque payable'}</p>
                    <p className="text-xs text-muted-foreground mt-1">Issued by: {txn.issued_by || txn.from || txn.party_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground mt-1">Issued date: {txn.issued_date || txn.date_ad || txn.created_date || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground mt-1">Cheque date: {txn.cheque_date || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground mt-1">Amount: NPR {(txn.amount || 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No payable cheque reminders.</p>
            )}
          </div>
          <div className="rounded-2xl bg-muted/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-foreground">Receivable Cheque Reminders</h4>
              <span className="text-xs text-muted-foreground">{chequeReceivableDue.length}</span>
            </div>
            {chequeReceivableDue.length > 0 ? (
              <div className="space-y-3">
                {chequeReceivableDue.map(txn => (
                  <div key={txn.id} className="rounded-2xl bg-white p-3 border border-border">
                    <p className="text-sm font-medium text-foreground truncate">{txn.cheque_name || txn.party_name || txn.description || 'Cheque receivable'}</p>
                    <p className="text-xs text-muted-foreground mt-1">Issued by: {txn.issued_by || txn.from || txn.party_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground mt-1">Issued date: {txn.issued_date || txn.date_ad || txn.created_date || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground mt-1">Cheque date: {txn.cheque_date || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground mt-1">Amount: NPR {(txn.amount || 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No receivable cheque reminders.</p>
            )}
          </div>
        </div>
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
