import { useState, useEffect } from 'react';
import { api } from '@/api/adapter';
import { getActiveCompanyId } from '@/lib/companyContext';
import { adToBs } from '@/lib/nepaliDate';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import PageLoader from '../components/PageLoader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { BookOpen, Plus, Printer, Share2, Save, Eye, User, Phone, Hash, MapPin, FileText, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import FloatingAccountDetail from '../components/ledger/FloatingAccountDetail';

export default function Ledger() {
  const companyId = getActiveCompanyId();
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('purchase');
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({ account_name: '', contact_name: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [showAccountDetail, setShowAccountDetail] = useState(null);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newAccount, setNewAccount] = useState({
    account_name: '', contact_name: '', contact_phone: '',
    address: '', pan_vat: '', opening_balance: '', notes: '', ob_type: 'debit',
  });
  const [newEntry, setNewEntry] = useState({ description: '', debit: 0, credit: 0, reference_id: '', date_ad: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId, activeTab]);

  async function loadData() {
    setLoading(true);
    const [accs, ents] = await Promise.all([
      api.LedgerAccount.filter({ company_id: companyId, account_type: activeTab }),
      api.LedgerEntry.filter({ company_id: companyId }, '-created_date', 50),
    ]);
    setAccounts(accs);
    setEntries(ents);
    setLoading(false);
  }

  async function createAccount() {
    const today = new Date().toISOString().split('T')[0];
    const bsDate = adToBs(new Date());
    await api.LedgerAccount.create({
      ...newAccount,
      company_id: companyId,
      account_type: activeTab,
      opening_balance: newAccount.opening_balance ? parseFloat(newAccount.opening_balance) : 0,
      current_balance: newAccount.opening_balance ? parseFloat(newAccount.opening_balance) : 0,
      fiscal_year: '2081/2082',
      is_active: true,
    });
    setNewAccount({
      account_name: '', contact_name: '', contact_phone: '',
      address: '', pan_vat: '', opening_balance: '', notes: '', ob_type: 'debit',
    });
    setShowNewAccount(false);
    loadData();
  }

  async function createEntry() {
    if (!showAccountDetail) return;
    const today = new Date().toISOString().split('T')[0];
    const bsDate = adToBs(new Date());

    const accountEntries = entries.filter(e => e.account_id === showAccountDetail.id);
    const lastBalance = accountEntries.length > 0 ? accountEntries[0].balance || 0 : (showAccountDetail.opening_balance || 0);
    const newBalance = lastBalance + (newEntry.debit || 0) - (newEntry.credit || 0);

    const entryDate = newEntry.date_ad || today;
    const entryBs = adToBs(new Date(entryDate));
    await api.LedgerEntry.create({
      company_id: companyId,
      account_id: showAccountDetail.id,
      date_ad: entryDate,
      date_bs: entryBs.formatted,
      description: newEntry.description,
      debit: newEntry.debit || 0,
      credit: newEntry.credit || 0,
      balance: newBalance,
      reference_type: activeTab,
      reference_id: newEntry.reference_id || '',
      is_locked: true,
    });

    await api.LedgerAccount.update(showAccountDetail.id, { current_balance: newBalance });
    setNewEntry({ description: '', debit: 0, credit: 0, reference_id: '', date_ad: new Date().toISOString().split('T')[0] });
    setShowNewEntry(false);
    loadData();
  }

  const filteredAccounts = accounts.filter(a =>
    (a.account_name?.toLowerCase().includes(search.toLowerCase()) ||
     a.contact_name?.toLowerCase().includes(search.toLowerCase())) &&
    (!colFilters.account_name || a.account_name?.toLowerCase().includes(colFilters.account_name.toLowerCase())) &&
    (!colFilters.contact_name || a.contact_name?.toLowerCase().includes(colFilters.contact_name.toLowerCase())) &&
    (!colFilters.status || (colFilters.status === 'active' ? a.is_active : !a.is_active))
  );

  const accountEntries = showAccountDetail
    ? [...entries.filter(e => e.account_id === showAccountDetail.id)].reverse()
    : [];

  const accountColumns = [
    { key: 'account_name', label: 'Account Name', filterValue: colFilters.account_name, onFilterChange: v => setCol('account_name', v), render: (row) => (
      <span className="font-medium text-foreground">{row.account_name}</span>
    )},
    { key: 'contact_name', label: 'Contact', filterValue: colFilters.contact_name, onFilterChange: v => setCol('contact_name', v) },
    { key: 'contact_phone', label: 'Phone' },
    { key: 'current_balance', label: 'Balance', render: (row) => (
      <span className={row.current_balance >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
        NPR {(row.current_balance || 0).toLocaleString()}
      </span>
    )},
    { key: 'is_active', label: 'Status', filterValue: colFilters.status, onFilterChange: v => setCol('status', v), filterPlaceholder: 'active/inactive', render: (row) => (
      <Badge variant={row.is_active ? 'default' : 'secondary'}>
        {row.is_active ? 'Active' : 'Inactive'}
      </Badge>
    )},
  ];

  const entryColumns = [
    { key: 'date_ad', label: 'Date (AD)', render: (row) => row.date_ad || '-' },
    { key: 'date_bs', label: 'Date (BS)', render: (row) => row.date_bs || '-' },
    { key: 'description', label: 'Description' },
    { key: 'reference_id', label: 'Reference No.', render: (row) => (
      row.reference_id ? <span className="text-xs text-muted-foreground font-mono">{row.reference_id}</span> : null
    )},
    { key: 'debit', label: 'Debit', render: (row) => (
      row.debit ? <span className="text-red-600 font-mono">NPR {row.debit.toLocaleString()}</span> : null
    )},
    { key: 'credit', label: 'Credit', render: (row) => (
      row.credit ? <span className="text-green-600 font-mono">NPR {row.credit.toLocaleString()}</span> : null
    )},
    { key: 'balance', label: 'Balance', render: (row) => (
      <span className="font-mono font-medium">NPR {Math.abs(row.balance || 0).toLocaleString()}</span>
    )},
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Ledger"
        subtitle="Purchase, Sales & Expense Accounts"
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setShowNewAccount(true)}
        addLabel="New Account"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary">
          <TabsTrigger value="purchase">Purchase Account</TabsTrigger>
          <TabsTrigger value="sales">Sales Account</TabsTrigger>
          <TabsTrigger value="expense">Expenses Account</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <DataTable
            columns={accountColumns}
            data={filteredAccounts}
            onRowClick={(row) => setShowAccountDetail(row)}
            emptyMessage={`No ${activeTab} accounts yet. Click "New Account" to create one.`}
          />
        </TabsContent>
      </Tabs>

      {/* New Account Dialog */}
      <Dialog open={showNewAccount} onOpenChange={setShowNewAccount}>
        <DialogContent className="glass-dialog max-w-3xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-slate-400 to-gray-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              New {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Account
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 mt-2">
            {/* LEFT column — Account Info */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="space-y-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Account Info
              </p>

              {/* Account Name */}
              <div>
                <Label className="text-xs font-medium">Account Name *</Label>
                <div className="relative mt-1">
                  <BookOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder="Party or account name"
                    value={newAccount.account_name}
                    onChange={e => setNewAccount({ ...newAccount, account_name: e.target.value })}
                  />
                </div>
              </div>

              {/* Contact Person */}
              <div>
                <Label className="text-xs font-medium">Contact Person</Label>
                <div className="relative mt-1">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder="Contact name (optional)"
                    value={newAccount.contact_name}
                    onChange={e => setNewAccount({ ...newAccount, contact_name: e.target.value })}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <Label className="text-xs font-medium">Phone</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder="Phone number (optional)"
                    value={newAccount.contact_phone}
                    onChange={e => setNewAccount({ ...newAccount, contact_phone: e.target.value })}
                  />
                </div>
              </div>
            </motion.div>

            {/* RIGHT column — Financial Details */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut', delay: 0.06 }}
              className="space-y-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> Financial Details
              </p>

              {/* PAN/VAT */}
              <div>
                <Label className="text-xs font-medium">PAN / VAT No.</Label>
                <div className="relative mt-1">
                  <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder="e.g. 123456789 (optional)"
                    value={newAccount.pan_vat}
                    onChange={e => setNewAccount({ ...newAccount, pan_vat: e.target.value })}
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <Label className="text-xs font-medium">Address</Label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder="Address (optional)"
                    value={newAccount.address}
                    onChange={e => setNewAccount({ ...newAccount, address: e.target.value })}
                  />
                </div>
              </div>

              {/* Opening Balance */}
              <div>
                <Label className="text-xs font-medium">Opening Balance</Label>
                <div className="flex gap-2 mt-1 mb-2">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="ob_type"
                      value="debit"
                      checked={newAccount.ob_type !== 'credit'}
                      onChange={() => setNewAccount({ ...newAccount, ob_type: 'debit' })}
                      className="accent-primary"
                    />
                    <span>Debit (you owe them)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="ob_type"
                      value="credit"
                      checked={newAccount.ob_type === 'credit'}
                      onChange={() => setNewAccount({ ...newAccount, ob_type: 'credit' })}
                      className="accent-primary"
                    />
                    <span>Credit (they owe you)</span>
                  </label>
                </div>
                <div className="flex items-stretch">
                  <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                  <Input
                    type="number"
                    className="rounded-l-none h-9 text-sm flex-1"
                    placeholder="0.00"
                    value={newAccount.opening_balance}
                    onChange={e => setNewAccount({ ...newAccount, opening_balance: e.target.value })}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Notes
                </Label>
                <Textarea
                  className="mt-1 text-sm"
                  placeholder="Optional notes..."
                  value={newAccount.notes}
                  onChange={e => setNewAccount({ ...newAccount, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </motion.div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNewAccount(false)}>Cancel</Button>
            <Button onClick={createAccount} disabled={!newAccount.account_name}>Create Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Detail Floating Window */}
      {showAccountDetail && (
        <FloatingAccountDetail
          account={showAccountDetail}
          entries={accountEntries}
          onClose={() => { setShowAccountDetail(null); setShowNewEntry(false); }}
          showNewEntry={showNewEntry}
          setShowNewEntry={setShowNewEntry}
          newEntry={newEntry}
          setNewEntry={setNewEntry}
          createEntry={createEntry}
        />
      )}
    </div>
  );
}
