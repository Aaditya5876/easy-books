import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getActiveCompanyId } from '@/lib/companyContext';
import { adToBs } from '@/lib/nepaliDate';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Banknote, CreditCard, QrCode, FileCheck, Plus, X, Building2, Eye, EyeOff, ExternalLink } from 'lucide-react';
import FloatingBankBrowser from '../components/FloatingBankBrowser';

export default function Transactions() {
  const companyId = getActiveCompanyId();
  const [transactions, setTransactions] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({ description: '', party_name: '', category: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showNew, setShowNew] = useState(false);
  const [activeBankId, setActiveBankId] = useState(null);
  const [showAddBank, setShowAddBank] = useState(false);
  const [browserAccount, setBrowserAccount] = useState(null);
  const [bankForm, setBankForm] = useState({ bank_name: '', account_number: '', account_type: 'current', branch: '', current_balance: 0, portal_url: '', portal_username: '', portal_password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    category: 'income', amount: 0, description: '',
    bank_name: '', bank_account_number: '', cheque_number: '', cheque_date: '',
    cheque_issue_date: '', party_name: '', status: 'completed'
  });

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);
    const [txns, banks] = await Promise.all([
      base44.entities.Transaction.filter({ company_id: companyId }, '-created_date', 100),
      base44.entities.BankAccount.filter({ company_id: companyId }),
    ]);
    setTransactions(txns);
    setBankAccounts(banks);
    if (banks.length > 0 && !activeBankId) setActiveBankId(banks[0].id);
    setLoading(false);
  }

  async function createBankAccount() {
    const acct = await base44.entities.BankAccount.create({ ...bankForm, company_id: companyId, is_active: true });
    setBankForm({ bank_name: '', account_number: '', account_type: 'current', branch: '', current_balance: 0, portal_url: '', portal_username: '', portal_password: '' });
    setShowAddBank(false);
    setActiveBankId(acct.id);
    loadData();
  }

  async function deleteBankAccount(id) {
    await base44.entities.BankAccount.delete(id);
    setActiveBankId(null);
    loadData();
  }

  async function createTransaction() {
    const today = new Date().toISOString().split('T')[0];
    const bsDate = adToBs(new Date());
    const type = activeTab === 'all' ? 'cash' : activeTab;
    await base44.entities.Transaction.create({
      ...form,
      type,
      company_id: companyId,
      date_ad: today,
      date_bs: bsDate.formatted,
    });
    setForm({
      category: 'income', amount: 0, description: '',
      bank_name: '', bank_account_number: '', cheque_number: '', cheque_date: '',
      cheque_issue_date: '', party_name: '', status: 'completed'
    });
    setShowNew(false);
    loadData();
  }

  const filtered = transactions.filter(t => {
    if (activeTab !== 'all' && t.type !== activeTab) return false;
    if (!(t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.party_name?.toLowerCase().includes(search.toLowerCase()))) return false;
    if (colFilters.description && !t.description?.toLowerCase().includes(colFilters.description.toLowerCase())) return false;
    if (colFilters.party_name && !t.party_name?.toLowerCase().includes(colFilters.party_name.toLowerCase())) return false;
    if (colFilters.category && !(t.category || '').toLowerCase().includes(colFilters.category.toLowerCase())) return false;
    if (colFilters.status && !(t.status || '').toLowerCase().includes(colFilters.status.toLowerCase())) return false;
    return true;
  });

  // Summaries
  const cashBalance = transactions.filter(t => t.type === 'cash')
    .reduce((sum, t) => sum + (t.category === 'income' ? (t.amount || 0) : -(t.amount || 0)), 0);
  const bankTotal = bankAccounts.reduce((sum, b) => sum + (b.current_balance || 0), 0);

  const typeIcons = { cash: Banknote, bank: CreditCard, qr: QrCode, cheque: FileCheck };
  const categoryColors = { income: 'text-green-600', expense: 'text-red-600', transfer: 'text-blue-600' };

  const columns = [
    { key: 'date_ad', label: 'Date', render: (row) => (
      <div className="text-xs"><div>{row.date_ad}</div><div className="text-muted-foreground">{row.date_bs}</div></div>
    )},
    { key: 'type', label: 'Type', render: (row) => {
      const Icon = typeIcons[row.type] || Banknote;
      return <div className="flex items-center gap-1.5"><Icon className="w-4 h-4" /><span className="capitalize text-sm">{row.type}</span></div>;
    }},
    { key: 'category', label: 'Category', filterValue: colFilters.category, onFilterChange: v => setCol('category', v), filterPlaceholder: 'e.g. income', render: (row) => (
      <Badge variant="outline" className="capitalize">{row.category}</Badge>
    )},
    { key: 'description', label: 'Description', filterValue: colFilters.description, onFilterChange: v => setCol('description', v) },
    { key: 'party_name', label: 'Party', filterValue: colFilters.party_name, onFilterChange: v => setCol('party_name', v) },
    { key: 'cheque_date', label: 'Cheque Due Date', render: (row) => row.type === 'cheque' && row.cheque_date ? (
      <span className="text-xs font-mono">{row.cheque_date}</span>
    ) : <span className="text-muted-foreground text-xs">-</span> },
    { key: 'amount', label: 'Amount', render: (row) => (
      <span className={`font-semibold font-mono ${categoryColors[row.category] || ''}`}>
        {row.category === 'expense' ? '-' : '+'}NPR {(row.amount || 0).toLocaleString()}
      </span>
    )},
    { key: 'status', label: 'Status', filterValue: colFilters.status, onFilterChange: v => setCol('status', v), filterPlaceholder: 'e.g. pending', render: (row) => (
      <select
        value={row.status}
        onClick={e => e.stopPropagation()}
        onChange={async e => {
          await base44.entities.Transaction.update(row.id, { status: e.target.value });
          loadData();
        }}
        className="text-xs border border-input rounded-md px-2 py-1 bg-background cursor-pointer"
      >
        <option value="completed">Completed</option>
        <option value="pending">Pending</option>
        <option value="cancelled">Cancelled</option>
      </select>
    )},
  ];

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Transactions" subtitle="Cash, Bank, QR & Cheque records" searchValue={search} onSearchChange={setSearch} onAdd={() => setShowNew(true)} addLabel="New Transaction" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Cash in Hand</p>
          <p className="text-xl font-bold mt-1">NPR {cashBalance.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Bank Balance</p>
          <p className="text-xl font-bold mt-1">NPR {bankTotal.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Bank Accounts</p>
          <p className="text-xl font-bold mt-1">{bankAccounts.length}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Total Transactions</p>
          <p className="text-xl font-bold mt-1">{transactions.length}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); if (v === 'bank' && bankAccounts.length > 0) setActiveBankId(bankAccounts[0].id); }}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="cash">Cash</TabsTrigger>
          <TabsTrigger value="bank">Bank</TabsTrigger>
          <TabsTrigger value="qr">QR</TabsTrigger>
          <TabsTrigger value="cheque">Cheque</TabsTrigger>
        </TabsList>

        {activeTab === 'bank' ? (
          <div className="mt-4 space-y-4">
            {/* Browser-style bank account tabs */}
            <div className="flex items-center gap-1 bg-muted/50 border border-border rounded-lg p-1 overflow-x-auto">
              {bankAccounts.map(acct => (
                <div
                  key={acct.id}
                  onClick={() => setActiveBankId(acct.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-sm whitespace-nowrap transition-all group ${
                    activeBankId === acct.id
                      ? 'bg-card shadow border border-border font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{acct.bank_name}</span>
                  <span className="text-xs opacity-60">···{acct.account_number?.slice(-4)}</span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteBankAccount(acct.id); }}
                    className="ml-1 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                  ><X className="w-3 h-3" /></button>
                </div>
              ))}
              <button
                onClick={() => setShowAddBank(true)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted transition-all whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" /> Add Account
              </button>
            </div>

            {/* Active bank account details */}
            {(() => {
              const acct = bankAccounts.find(b => b.id === activeBankId);
              if (!acct) return (
                <div className="bg-card border rounded-xl p-12 text-center">
                  <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No bank accounts yet. Click "Add Account" to create one.</p>
                </div>
              );
              const bankTxns = filtered.filter(t => t.bank_account_number === acct.account_number || t.bank_name === acct.bank_name);
              return (
                <div className="space-y-4">
                  <div className="bg-card border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div><p className="text-xs text-muted-foreground">Bank</p><p className="font-semibold">{acct.bank_name}</p></div>
                    <div><p className="text-xs text-muted-foreground">Account No.</p><p className="font-mono text-sm">{acct.account_number}</p></div>
                    <div><p className="text-xs text-muted-foreground">Type</p><p className="capitalize">{acct.account_type}</p></div>
                    <div><p className="text-xs text-muted-foreground">Balance</p><p className="font-bold text-green-600">NPR {(acct.current_balance || 0).toLocaleString()}</p></div>
                    {acct.portal_url && (
                    <div className="col-span-2 sm:col-span-4 flex items-center gap-3 pt-1 border-t">
                    <button onClick={() => setBrowserAccount(acct)} className="flex items-center gap-1 text-sm text-primary hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" /> Open Bank Portal
                    </button>
                        {acct.portal_username && <span className="text-xs text-muted-foreground">User: <span className="font-mono">{acct.portal_username}</span></span>}
                      </div>
                    )}
                  </div>
                  <DataTable columns={columns} data={bankTxns} emptyMessage="No transactions for this account" />
                </div>
              );
            })()}

            {/* Add Bank Account Dialog */}
            <Dialog open={showAddBank} onOpenChange={setShowAddBank}>
              <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add Bank Account</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Bank Name *</Label><Input value={bankForm.bank_name} onChange={e => setBankForm({ ...bankForm, bank_name: e.target.value })} /></div>
                  <div><Label>Account Number *</Label><Input value={bankForm.account_number} onChange={e => setBankForm({ ...bankForm, account_number: e.target.value })} /></div>
                  <div>
                    <Label>Account Type</Label>
                    <Select value={bankForm.account_type} onValueChange={v => setBankForm({ ...bankForm, account_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="current">Current</SelectItem>
                        <SelectItem value="savings">Savings</SelectItem>
                        <SelectItem value="fixed">Fixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Branch</Label><Input value={bankForm.branch} onChange={e => setBankForm({ ...bankForm, branch: e.target.value })} /></div>
                  <div><Label>Opening Balance (NPR)</Label><Input type="number" value={bankForm.current_balance} onChange={e => setBankForm({ ...bankForm, current_balance: parseFloat(e.target.value) || 0 })} /></div>
                  <div className="border-t pt-3 mt-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Saved Login (like Chrome)</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1"><Label>Bank Portal URL</Label><Input placeholder="https://netbanking.example.com" value={bankForm.portal_url} onChange={e => setBankForm({ ...bankForm, portal_url: e.target.value })} /></div>
                        {bankForm.portal_url && <a href={bankForm.portal_url} target="_blank" rel="noreferrer" className="mt-5 text-primary"><ExternalLink className="w-4 h-4" /></a>}
                      </div>
                      <div><Label>Username / Customer ID</Label><Input value={bankForm.portal_username} onChange={e => setBankForm({ ...bankForm, portal_username: e.target.value })} /></div>
                      <div>
                        <Label>Password</Label>
                        <div className="relative">
                          <Input type={showPassword ? 'text' : 'password'} value={bankForm.portal_password} onChange={e => setBankForm({ ...bankForm, portal_password: e.target.value })} className="pr-9" />
                          <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddBank(false)}>Cancel</Button>
                  <Button onClick={createBankAccount} disabled={!bankForm.bank_name || !bankForm.account_number}>Add Account</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <TabsContent value={activeTab} className="mt-4">
            <DataTable columns={columns} data={filtered} emptyMessage="No transactions yet" />
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                  <SelectItem value="hand-outs">Hand-outs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Amount (NPR) *</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Description *</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Party Name</Label><Input value={form.party_name} onChange={e => setForm({ ...form, party_name: e.target.value })} /></div>
            {(activeTab === 'bank' || activeTab === 'qr') && (
              <div className="space-y-3">
                {bankAccounts.length > 0 && (
                  <div>
                    <Label>Select Bank Account</Label>
                    <Select
                      value={form.bank_account_number}
                      onValueChange={v => {
                        const acct = bankAccounts.find(b => b.account_number === v);
                        setForm({ ...form, bank_name: acct?.bank_name || '', bank_account_number: v });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Choose account..." /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(b => (
                          <SelectItem key={b.id} value={b.account_number}>
                            {b.bank_name} — {b.account_number} ({b.account_type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Or enter manually below</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Bank Name</Label><Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></div>
                  <div><Label>Account No.</Label><Input value={form.bank_account_number} onChange={e => setForm({ ...form, bank_account_number: e.target.value })} /></div>
                </div>
                {bankAccounts.length === 0 && (
                  <p className="text-xs text-muted-foreground">No bank accounts saved. Go to <a href="/settings" className="underline text-primary">Settings</a> to add bank accounts.</p>
                )}
              </div>
            )}
            {activeTab === 'cheque' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cheque Number</Label><Input value={form.cheque_number} onChange={e => setForm({ ...form, cheque_number: e.target.value })} /></div>
                  <div><Label>Cheque Date</Label><Input type="date" value={form.cheque_date} onChange={e => setForm({ ...form, cheque_date: e.target.value })} /></div>
                </div>
                <div><Label>Cheque Issue Date</Label><Input type="date" value={form.cheque_issue_date} onChange={e => setForm({ ...form, cheque_issue_date: e.target.value })} /></div>
                <div><Label>Bank Name</Label><Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={createTransaction} disabled={!form.amount || !form.description}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {browserAccount && <FloatingBankBrowser account={browserAccount} onClose={() => setBrowserAccount(null)} />}
    </div>
  );
}