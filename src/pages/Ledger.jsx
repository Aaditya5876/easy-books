import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getActiveCompanyId } from '@/lib/companyContext';
import { adToBs } from '@/lib/nepaliDate';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { BookOpen, Plus, Printer, Share2, Save, Eye } from 'lucide-react';
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
  const [newAccount, setNewAccount] = useState({ account_name: '', contact_name: '', contact_phone: '', address: '', notes: '' });
  const [newEntry, setNewEntry] = useState({ description: '', debit: 0, credit: 0, reference_id: '', date_ad: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId, activeTab]);

  async function loadData() {
    setLoading(true);
    const [accs, ents] = await Promise.all([
      base44.entities.LedgerAccount.filter({ company_id: companyId, account_type: activeTab }),
      base44.entities.LedgerEntry.filter({ company_id: companyId }, '-created_date', 50),
    ]);
    setAccounts(accs);
    setEntries(ents);
    setLoading(false);
  }

  async function createAccount() {
    const today = new Date().toISOString().split('T')[0];
    const bsDate = adToBs(new Date());
    await base44.entities.LedgerAccount.create({
      ...newAccount,
      company_id: companyId,
      account_type: activeTab,
      fiscal_year: '2081/2082',
      is_active: true,
    });
    setNewAccount({ account_name: '', contact_name: '', contact_phone: '', address: '', notes: '' });
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
    await base44.entities.LedgerEntry.create({
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

    await base44.entities.LedgerAccount.update(showAccountDetail.id, { current_balance: newBalance });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Account Name *</Label>
              <Input value={newAccount.account_name} onChange={e => setNewAccount({ ...newAccount, account_name: e.target.value })} placeholder="Party name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contact Person</Label>
                <Input value={newAccount.contact_name} onChange={e => setNewAccount({ ...newAccount, contact_name: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={newAccount.contact_phone} onChange={e => setNewAccount({ ...newAccount, contact_phone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input value={newAccount.address} onChange={e => setNewAccount({ ...newAccount, address: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={newAccount.notes} onChange={e => setNewAccount({ ...newAccount, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
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