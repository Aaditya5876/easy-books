import { useState, useEffect } from 'react';
import { api } from '@/api/adapter';
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
import {
  Banknote, CreditCard, QrCode, FileCheck, Plus, X, Building2,
  Eye, EyeOff, ExternalLink, FileText, User, Calendar, Hash,
  Landmark, Globe, Lock, ArrowLeftRight,
} from 'lucide-react';
import { useRole } from "@/lib/useRole";
import { motion } from 'framer-motion';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import FloatingBankBrowser from '../components/FloatingBankBrowser';

const CATEGORIES = [
  { v: 'income',     label: 'Income',     color: 'border-green-400 text-green-700',  active: 'bg-green-50 border-green-500' },
  { v: 'expense',    label: 'Expense',    color: 'border-red-400 text-red-700',      active: 'bg-red-50 border-red-500' },
  { v: 'transfer',   label: 'Transfer',   color: 'border-blue-400 text-blue-700',    active: 'bg-blue-50 border-blue-500' },
  { v: 'investment', label: 'Investment', color: 'border-violet-400 text-violet-700',active: 'bg-violet-50 border-violet-500' },
  { v: 'hand-outs',  label: 'Hand-outs',  color: 'border-amber-400 text-amber-700',  active: 'bg-amber-50 border-amber-500' },
];

const PAY_METHODS = [
  { id: 'cash',   label: 'Cash',          emoji: '💵' },
  { id: 'bank',   label: 'Bank Transfer', emoji: '🏦' },
  { id: 'cheque', label: 'Cheque',        emoji: '📋' },
  { id: 'qr',     label: 'QR / UPI',      emoji: '📱' },
];

export default function Transactions() {
  const { canDelete } = useRole();
  const companyId = getActiveCompanyId();
  const [transactions, setTransactions] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({ description: '', party_name: '', category: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showNew, setShowNew] = useState(false);
  const [payMethod, setPayMethod] = useState('cash');
  const [activeBankId, setActiveBankId] = useState(null);
  const [showAddBank, setShowAddBank] = useState(false);
  const [browserAccount, setBrowserAccount] = useState(null);
  const [bankForm, setBankForm] = useState({
    bank_name: '', account_number: '', account_type: 'current',
    branch: '', current_balance: 0,
    portal_url: '', portal_username: '', portal_password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    category: 'income', amount: 0, description: '',
    bank_name: '', bank_account_number: '', cheque_number: '', cheque_date: '',
    cheque_issue_date: '', party_name: '', status: 'completed',
    date_ad: new Date().toISOString().split('T')[0], reference_number: '',
  });

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);
    const [txns, banks] = await Promise.all([
      api.Transaction.filter({ company_id: companyId }, '-created_date', 100),
      api.BankAccount.filter({ company_id: companyId }),
    ]);
    setTransactions(txns);
    setBankAccounts(banks);
    if (banks.length > 0 && !activeBankId) setActiveBankId(banks[0].id);
    setLoading(false);
  }

  async function createBankAccount() {
    const acct = await api.BankAccount.create({ ...bankForm, company_id: companyId, is_active: true });
    setBankForm({
      bank_name: '', account_number: '', account_type: 'current',
      branch: '', current_balance: 0,
      portal_url: '', portal_username: '', portal_password: '',
    });
    setShowAddBank(false);
    setActiveBankId(acct.id);
    loadData();
  }

  async function deleteBankAccount(id) {
    await api.BankAccount.delete(id);
    setActiveBankId(null);
    loadData();
  }

  async function createTransaction() {
    const entryDate = form.date_ad || new Date().toISOString().split('T')[0];
    const bsDate = adToBs(new Date(entryDate));
    const type = activeTab === 'all' ? 'cash' : activeTab;
    await api.Transaction.create({
      ...form,
      type,
      company_id: companyId,
      date_ad: entryDate,
      date_bs: bsDate.formatted,
    });
    setForm({
      category: 'income', amount: 0, description: '',
      bank_name: '', bank_account_number: '', cheque_number: '', cheque_date: '',
      cheque_issue_date: '', party_name: '', status: 'completed',
      date_ad: new Date().toISOString().split('T')[0], reference_number: '',
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
          await api.Transaction.update(row.id, { status: e.target.value });
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

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Transactions"
        subtitle="Cash, Bank, QR & Cheque records"
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => {
          setPayMethod(
            activeTab === 'bank' ? 'bank' :
            activeTab === 'cheque' ? 'cheque' :
            activeTab === 'qr' ? 'qr' : 'cash'
          );
          setShowNew(true);
        }}
        addLabel="New Transaction"
      />

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
                  {canDelete && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteBankAccount(acct.id); }}
                      className="ml-1 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                    ><X className="w-3 h-3" /></button>
                  )}
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
              <DialogContent className="glass-dialog max-w-2xl overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500 -mx-6 -mt-6 mb-4" />
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-primary" /> Add Bank Account
                  </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-6 mt-2">
                  {/* LEFT — Bank Details */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="space-y-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5" /> Bank Details
                    </p>

                    {/* Bank Name */}
                    <div>
                      <Label className="text-xs font-medium">Bank Name *</Label>
                      <div className="relative mt-1">
                        <Landmark className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          className="pl-8 h-9 text-sm"
                          placeholder="e.g. Nepal Investment Bank"
                          value={bankForm.bank_name}
                          onChange={e => setBankForm({ ...bankForm, bank_name: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Account Type chips */}
                    <div>
                      <Label className="text-xs font-medium">Account Type</Label>
                      <div className="flex gap-2 mt-1">
                        {['current', 'savings', 'fixed'].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setBankForm({ ...bankForm, account_type: t })}
                            className={`sel-chip capitalize text-xs px-3 py-1.5 rounded-md ${
                              bankForm.account_type === t
                                ? 'border-primary bg-primary/10 text-primary border-2'
                                : 'border-border text-muted-foreground border'
                            }`}
                          >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Branch */}
                    <div>
                      <Label className="text-xs font-medium">Branch</Label>
                      <div className="relative mt-1">
                        <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          className="pl-8 h-9 text-sm"
                          placeholder="Branch name (optional)"
                          value={bankForm.branch}
                          onChange={e => setBankForm({ ...bankForm, branch: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Opening Balance */}
                    <div>
                      <Label className="text-xs font-medium">Opening Balance</Label>
                      <div className="flex items-stretch mt-1">
                        <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                        <Input
                          type="number"
                          className="rounded-l-none h-9 text-sm flex-1"
                          placeholder="0.00"
                          value={bankForm.current_balance}
                          onChange={e => setBankForm({ ...bankForm, current_balance: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </motion.div>

                  {/* RIGHT — Portal Login */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut', delay: 0.06 }}
                    className="space-y-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Portal Login
                    </p>

                    {/* Account Number */}
                    <div>
                      <Label className="text-xs font-medium">Account Number *</Label>
                      <div className="relative mt-1">
                        <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          className="pl-8 h-9 text-sm"
                          placeholder="Account number"
                          value={bankForm.account_number}
                          onChange={e => setBankForm({ ...bankForm, account_number: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Portal URL */}
                    <div>
                      <Label className="text-xs font-medium">Portal URL</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="relative flex-1">
                          <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                          <Input
                            className="pl-8 h-9 text-sm"
                            placeholder="https://netbanking.example.com"
                            value={bankForm.portal_url}
                            onChange={e => setBankForm({ ...bankForm, portal_url: e.target.value })}
                          />
                        </div>
                        {bankForm.portal_url && (
                          <a href={bankForm.portal_url} target="_blank" rel="noreferrer" className="text-primary shrink-0">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Username */}
                    <div>
                      <Label className="text-xs font-medium">Username / Customer ID</Label>
                      <div className="relative mt-1">
                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          className="pl-8 h-9 text-sm"
                          placeholder="Username"
                          value={bankForm.portal_username}
                          onChange={e => setBankForm({ ...bankForm, portal_username: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <Label className="text-xs font-medium">Password</Label>
                      <div className="relative mt-1">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          className="h-9 text-sm pr-9"
                          value={bankForm.portal_password}
                          onChange={e => setBankForm({ ...bankForm, portal_password: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>

                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setShowAddBank(false)}>Cancel</Button>
                  <Button onClick={createBankAccount} disabled={!bankForm.bank_name || !bankForm.account_number}>Add Account</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <TabsContent value={activeTab} className="mt-4">
            {filtered.length === 0 ? (
              <EmptyState
                icon={ArrowLeftRight}
                title="No transactions yet"
                description="Record your first income or expense transaction."
                action={
                  <Button onClick={() => setShowNew(true)}>
                    <Plus className="w-4 h-4 mr-2" />Add First Record
                  </Button>
                }
              />
            ) : (
              <DataTable columns={columns} data={filtered} emptyMessage="No transactions yet" />
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* New Transaction Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="glass-dialog max-w-4xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-primary" /> New Transaction
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 mt-2">
            {/* LEFT — Transaction Details */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="space-y-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5" /> Transaction Details
              </p>

              {/* Large NPR Amount */}
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount *</Label>
                <div className="flex items-stretch mt-1">
                  <span className="flex items-center px-3 text-sm font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md shrink-0">NPR</span>
                  <Input
                    type="number"
                    className="rounded-l-none h-11 text-lg font-semibold flex-1"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Category chips */}
              <div>
                <Label className="text-xs font-medium">Category</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.v}
                      type="button"
                      onClick={() => setForm({ ...form, category: c.v })}
                      className={`sel-chip text-xs px-3 py-1.5 rounded-md ${
                        form.category === c.v
                          ? c.active + ' border-2'
                          : c.color + ' border opacity-70'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="text-xs font-medium">Description *</Label>
                <div className="relative mt-1">
                  <FileText className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder="What is this transaction for?"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Party Name */}
              <div>
                <Label className="text-xs font-medium">Party Name</Label>
                <div className="relative mt-1">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder="Vendor, customer, or party (optional)"
                    value={form.party_name}
                    onChange={e => setForm({ ...form, party_name: e.target.value })}
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <Label className="text-xs font-medium">Date *</Label>
                <div className="relative mt-1">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="date"
                    className="pl-8 h-9 text-sm"
                    value={form.date_ad}
                    onChange={e => setForm({ ...form, date_ad: e.target.value })}
                  />
                </div>
              </div>

              {/* Reference No. */}
              <div>
                <Label className="text-xs font-medium">Reference No.</Label>
                <div className="relative mt-1">
                  <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder="e.g. Bill/Voucher # (optional)"
                    value={form.reference_number}
                    onChange={e => setForm({ ...form, reference_number: e.target.value })}
                  />
                </div>
              </div>
            </motion.div>

            {/* RIGHT — Payment Method */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut', delay: 0.06 }}
              className="space-y-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Payment Method
              </p>

              {/* 2×2 Payment method tiles */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                {PAY_METHODS.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPayMethod(m.id)}
                    className={`pay-card flex flex-col items-center gap-1 py-3 rounded-lg border transition-all ${
                      payMethod === m.id
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="text-2xl">{m.emoji}</span>
                    <span className="text-xs font-medium">{m.label}</span>
                  </button>
                ))}
              </div>

              {/* Conditional fields */}
              {(payMethod === 'bank' || payMethod === 'qr') && (
                <div className="space-y-3 pt-1">
                  {bankAccounts.length > 0 && (
                    <div>
                      <Label className="text-xs font-medium">Select Bank Account</Label>
                      <Select
                        value={form.bank_account_number}
                        onValueChange={v => {
                          const acct = bankAccounts.find(b => b.account_number === v);
                          setForm({ ...form, bank_name: acct?.bank_name || '', bank_account_number: v });
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Choose account..." /></SelectTrigger>
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
                  <div>
                    <Label className="text-xs font-medium">Bank Name</Label>
                    <Input className="h-9 text-sm mt-1" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Account No.</Label>
                    <Input className="h-9 text-sm mt-1" value={form.bank_account_number} onChange={e => setForm({ ...form, bank_account_number: e.target.value })} />
                  </div>
                  {bankAccounts.length === 0 && (
                    <p className="text-xs text-muted-foreground">No bank accounts saved. Go to <a href="/settings" className="underline text-primary">Settings</a> to add bank accounts.</p>
                  )}
                </div>
              )}

              {payMethod === 'cheque' && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium">Cheque Number</Label>
                      <Input className="h-9 text-sm mt-1" value={form.cheque_number} onChange={e => setForm({ ...form, cheque_number: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Cheque Date</Label>
                      <Input type="date" className="h-9 text-sm mt-1" value={form.cheque_date} onChange={e => setForm({ ...form, cheque_date: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Issue Date</Label>
                    <Input type="date" className="h-9 text-sm mt-1" value={form.cheque_issue_date} onChange={e => setForm({ ...form, cheque_issue_date: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Bank Name</Label>
                    <Input className="h-9 text-sm mt-1" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} />
                  </div>
                </div>
              )}

              {/* cash: nothing extra */}
            </motion.div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={createTransaction} disabled={!form.amount || !form.description}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {browserAccount && <FloatingBankBrowser account={browserAccount} onClose={() => setBrowserAccount(null)} />}
    </div>
  );
}
