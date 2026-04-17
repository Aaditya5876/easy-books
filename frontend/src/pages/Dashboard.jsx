import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getActiveCompanyId } from '@/lib/companyContext';
import { 
  Package, ShoppingCart, Receipt, Wallet, AlertTriangle, 
  TrendingUp, FileText, Building2
} from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import QuickActions from '../components/dashboard/QuickActions';
import RecentActivity from '../components/dashboard/RecentActivity';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CHART_COLORS = ['hsl(217, 71%, 53%)', 'hsl(160, 60%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(280, 65%, 60%)'];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalInventory: 0,
    lowStock: 0,
    totalPurchases: 0,
    totalSales: 0,
    cashInHand: 0,
    bankBalance: 0,
    pendingQuotations: 0,
    activeClients: 0,
  });
  const [inventoryItems, setInventoryItems] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [quotationStats, setQuotationStats] = useState([]);
  const [topSellingItems, setTopSellingItems] = useState([]);
  const [inventorySoldValue, setInventorySoldValue] = useState(0);
  const [inventoryInHandValue, setInventoryInHandValue] = useState(0);
  const [agingItems, setAgingItems] = useState([]);
  const companyId = getActiveCompanyId();

  useEffect(() => {
    loadDashboardData();
  }, [companyId]);

  async function loadDashboardData() {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const [inventory, purchases, sales, transactions, quotations, banks, clients] = await Promise.all([
      base44.entities.InventoryItem.filter({ company_id: companyId }),
      base44.entities.PurchaseOrder.filter({ company_id: companyId }, '-created_date', 20),
      base44.entities.SalesOrder.filter({ company_id: companyId }, '-created_date', 200),
      base44.entities.Transaction.filter({ company_id: companyId }, '-created_date', 20),
      base44.entities.Quotation.filter({ company_id: companyId }),
      base44.entities.BankAccount.filter({ company_id: companyId }),
      base44.entities.Client.filter({ company_id: companyId }),
    ]);

    const lowStockItems = inventory.filter(i => i.quantity <= (i.low_stock_threshold || 5));
    const totalPurchaseAmt = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const totalSalesAmt = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    
    const cashTransactions = transactions.filter(t => t.type === 'cash');
    const cashIn = cashTransactions.filter(t => t.category === 'income').reduce((s, t) => s + (t.amount || 0), 0);
    const cashOut = cashTransactions.filter(t => t.category === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    
    const bankBalance = banks.reduce((sum, b) => sum + (b.current_balance || 0), 0);

    // Quotation stats by remark
    const quotationRemarks = ['Quoted', 'Work-done', 'Cancelled', 'Revised', 'Billed'];
    const qStats = quotationRemarks.map(remark => ({
      name: remark,
      value: quotations.filter(q => q.remark === remark).length
    })).filter(q => q.value > 0);

    setStats({
      totalInventory: inventory.length,
      lowStock: lowStockItems.length,
      totalPurchases: totalPurchaseAmt,
      totalSales: totalSalesAmt,
      cashInHand: cashIn - cashOut,
      bankBalance,
      pendingQuotations: quotations.filter(q => q.remark === 'Quoted').length,
      activeClients: clients.filter(c => c.crm_status === 'active').length,
    });

    setInventoryItems(inventory.sort((a, b) => (a.quantity || 0) - (b.quantity || 0)).slice(0, 5));
    setQuotationStats(qStats);

    // Top selling items
    const itemSalesMap = {};
    sales.forEach(order => {
      (order.items || []).forEach(item => {
        const key = item.description || item.inventory_item_id || 'Unknown';
        if (!itemSalesMap[key]) itemSalesMap[key] = { name: key, qty: 0, value: 0 };
        itemSalesMap[key].qty += item.quantity || 0;
        itemSalesMap[key].value += item.total || 0;
      });
    });
    const topSelling = Object.values(itemSalesMap).sort((a, b) => b.value - a.value).slice(0, 10);
    setTopSellingItems(topSelling);

    // Inventory sold value = total of all sales
    setInventorySoldValue(totalSalesAmt);

    // Inventory in hand value
    const inHandValue = inventory.reduce((sum, i) => sum + ((i.quantity || 0) * (i.unit_selling_price || 0)), 0);
    setInventoryInHandValue(inHandValue);

    // Aging inventory
    const today = new Date();
    const aging = inventory.filter(i => {
      if (!i.date_of_purchase) return false;
      const days = Math.floor((today - new Date(i.date_of_purchase)) / (1000 * 60 * 60 * 24));
      return days >= (i.aging_days || 90);
    });
    setAgingItems(aging);

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
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={Receipt} 
          label="Total Sales" 
          value={`NPR ${stats.totalSales.toLocaleString()}`}
          trend={stats.totalSales > 0 ? "Active" : undefined}
          trendUp={true}
        />
        <StatCard 
          icon={ShoppingCart} 
          label="Total Purchases" 
          value={`NPR ${stats.totalPurchases.toLocaleString()}`}
        />
        <StatCard 
          icon={Wallet} 
          label="Cash in Hand" 
          value={`NPR ${stats.cashInHand.toLocaleString()}`}
        />
        <StatCard 
          icon={Building2} 
          label="Bank Balance" 
          value={`NPR ${stats.bankBalance.toLocaleString()}`}
        />
      </div>

      {/* Second row stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package} label="Inventory Items" value={stats.totalInventory} />
        <StatCard 
          icon={AlertTriangle} 
          label="Low Stock Alerts" 
          value={stats.lowStock}
          trend={stats.lowStock > 0 ? `${stats.lowStock} items` : undefined}
          trendUp={false}
        />
        <StatCard icon={FileText} label="Pending Quotations" value={stats.pendingQuotations} />
        <StatCard icon={TrendingUp} label="Active Clients" value={stats.activeClients} />
      </div>



      {/* Inventory Summary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Selling Items */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-1">Top 10 Highest Selling Items</h3>
          <p className="text-xs text-muted-foreground mb-4">By sales value</p>
          {topSellingItems.length > 0 ? (
            <div className="space-y-2">
              {topSellingItems.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.qty} units sold</p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-primary">NPR {item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No sales data yet</div>
          )}
        </div>

        {/* Inventory Value & Aging */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-sm font-semibold text-foreground mb-3">Inventory Value Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-primary/5 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Sold (by value)</p>
                <p className="text-lg font-bold text-primary">NPR {inventorySoldValue.toLocaleString()}</p>
              </div>
              <div className="bg-success/5 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">In Hand (by value)</p>
                <p className="text-lg font-bold text-success">NPR {inventoryInHandValue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <h3 className="text-sm font-semibold text-foreground">Aging Inventory</h3>
              {agingItems.length > 0 && (
                <span className="ml-auto text-xs bg-warning/10 text-warning font-semibold px-2 py-0.5 rounded-full">{agingItems.length} items</span>
              )}
            </div>
            {agingItems.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {agingItems.map(item => {
                  const days = Math.floor((new Date() - new Date(item.date_of_purchase)) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={item.id} className="flex items-center justify-between">
                      <p className="text-xs font-medium truncate flex-1">{item.description}</p>
                      <span className="text-xs text-warning font-semibold ml-2">{days}d old</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No aging inventory alerts</p>
            )}
          </div>
        </div>
      </div>

      {/* Charts and Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock Items */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Inventory Status</h3>
          {inventoryItems.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={inventoryItems.slice(0, 5).map(i => ({
                name: i.description?.substring(0, 15) || 'Item',
                qty: i.quantity || 0,
                threshold: i.low_stock_threshold || 5
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="qty" fill="hsl(217, 71%, 53%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="threshold" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} opacity={0.4} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
              No inventory data yet
            </div>
          )}
        </div>

        {/* Quotation Status */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Quotation Status</h3>
          {quotationStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={quotationStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {quotationStats.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
              No quotations yet
            </div>
          )}
          {quotationStats.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {quotationStats.map((q, idx) => (
                <div key={q.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }} />
                  <span className="text-muted-foreground">{q.name}: {q.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <RecentActivity activities={recentActivities} />
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
    const company = await base44.entities.Company.create({ name: name.trim(), is_active: true });
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