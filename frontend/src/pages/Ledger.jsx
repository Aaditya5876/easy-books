import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/adapter';
import { ledgerApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { adToBs } from '@/lib/nepaliDate';
import { formatDate } from '@/lib/utils';
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
import { BookOpen, Plus, User, Phone, Hash, MapPin, FileText, Wallet, EyeOff, Eye, Lock, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import FloatingAccountDetail from '../components/ledger/FloatingAccountDetail';
import EmptyState from '../components/EmptyState';
import { useRole } from '@/lib/useRole';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

// Maps a tab key to the underlying LedgerAccount.accountType it holds — kept in
// sync with createAccount()'s accountTypeMap, which is what actually sets this
// field when a party account is created.
const TAB_ACCOUNT_TYPE = { purchase: 'LIABILITY', sales: 'INCOME', expense: 'EXPENSE' };

export default function Ledger() {
  const { t } = useTranslation();
  const companyId = getActiveCompanyId();
  const { isAdmin } = useRole();
  const { user } = useAuth();
  const isSchool = user?.defaultCompany?.businessType === 'SCHOOL';
  const { toast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('purchase');
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({ account_name: '', contact_name: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null); // single click — selection only
  const [showAccountDetail, setShowAccountDetail] = useState(null); // double click — opens detail
  const [showNewEntry, setShowNewEntry] = useState(false);

  // Context menu (right-click)
  const [contextMenu, setContextMenu] = useState(null); // { x, y, account }

  // Password dialog (hide/unhide + hidden search + hidden delete)
  const [pwDialog, setPwDialog] = useState(null); // { mode: 'hide'|'search', account? }
  const [pwInput, setPwInput] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Hidden account search
  const [hiddenSearchName, setHiddenSearchName] = useState('');

  // Space+Alt+Delete to delete hidden account (when detail is open)
  const keysHeld = useRef(new Set());
  const handleKeyDown = useCallback((e) => {
    keysHeld.current.add(e.code);
    if (
      keysHeld.current.has('Space') &&
      keysHeld.current.has('AltLeft') &&
      keysHeld.current.has('Delete') &&
      showAccountDetail?.isHidden
    ) {
      e.preventDefault();
      setPwDialog({ mode: 'deleteHidden', account: showAccountDetail });
      setPwInput('');
    }
  }, [showAccountDetail]);
  const handleKeyUp = useCallback((e) => { keysHeld.current.delete(e.code); }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);
  const [newAccount, setNewAccount] = useState({
    account_name: '', contact_name: '', contact_phone: '',
    address: '', pan_vat: '', account_type: 'purchase', notes: '',
  });
  const [newEntry, setNewEntry] = useState({ description: '', debit: 0, credit: 0, reference_id: '', contra_account_id: '', date_ad: new Date().toISOString().split('T')[0] });
  const [allAccounts, setAllAccounts] = useState([]);

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId, activeTab]);

  useEffect(() => {
    if (showNewAccount) {
      setNewAccount(prev => ({ ...prev, account_type: activeTab }));
    }
  }, [showNewAccount, activeTab]);

  async function loadData() {
    setLoading(true);
    // The backend's GET /ledger/accounts doesn't actually filter by account_type —
    // it just returns every non-hidden account for the company — so all tab
    // filtering happens here on the client. The "System Accounts" tab shows the
    // auto-created accounts (Cash in Hand, Bank Account, Sales Revenue, Purchase
    // Expenses, Accounts Receivable/Payable, etc.) that Transactions/Payroll/Cheques
    // post to automatically (is_system = true). The purchase/sales/expense tabs show
    // only the party-specific accounts a user created by hand, matched by their
    // underlying accountType (purchase=LIABILITY, sales=INCOME, expense=EXPENSE) —
    // see createAccount()'s accountTypeMap below.
    const [allAccs, ents] = await Promise.all([
      api.LedgerAccount.filter({ company_id: companyId }),
      api.LedgerEntry.filter({ company_id: companyId }, '-created_date', 50),
    ]);
    const visibleAccounts = activeTab === 'system'
      ? allAccs.filter(a => a.is_system)
      : allAccs.filter(a => !a.is_system && (a.account_type || '').toUpperCase() === TAB_ACCOUNT_TYPE[activeTab]);
    setAccounts(visibleAccounts);
    setEntries(ents);
    setAllAccounts(allAccs);
    setLoading(false);
  }

  async function handlePasswordSubmit() {
    if (!pwInput.trim() || !pwDialog) return;
    setPwLoading(true);
    try {
      if (pwDialog.mode === 'hide') {
        await ledgerApi.accounts.toggleHidden(pwDialog.account.id, pwInput);
        toast({ title: pwDialog.account.isHidden ? t('ledger.accountUnhidden', { defaultValue: 'Account unhidden' }) : t('ledger.accountHidden', { defaultValue: 'Account hidden' }), description: pwDialog.account.account_name });
        setShowAccountDetail(null);
        loadData();
      } else if (pwDialog.mode === 'search') {
        const res = await ledgerApi.accounts.searchHidden(hiddenSearchName, pwInput);
        setShowAccountDetail(res.data);
      } else if (pwDialog.mode === 'deleteHidden') {
        await ledgerApi.accounts.removeHidden(pwDialog.account.id, pwInput);
        toast({ title: t('ledger.hiddenAccountDeleted', { defaultValue: 'Hidden account deleted' }), description: pwDialog.account.account_name });
        setShowAccountDetail(null);
        loadData();
      }
      setPwDialog(null);
      setPwInput('');
    } catch (err) {
      toast({ title: t('ledger.error', { defaultValue: 'Error' }), description: err?.response?.data?.message || t('ledger.incorrectPasswordOrNotFound', { defaultValue: 'Incorrect password or account not found.' }), variant: 'destructive' });
    } finally {
      setPwLoading(false);
    }
  }

  async function createAccount() {
    const accountTypeMap = {
      purchase: 'LIABILITY',
      sales: 'INCOME',
      expense: 'EXPENSE',
    };
    await api.LedgerAccount.create({
      ...newAccount,
      company_id: companyId,
      account_type: accountTypeMap[newAccount.account_type || activeTab] || 'EXPENSE',
      opening_balance: 0,
      current_balance: 0,
      fiscal_year: '2081/2082',
      is_active: true,
    });
    setNewAccount({
      account_name: '', contact_name: '', contact_phone: '',
      address: '', pan_vat: '', account_type: activeTab, notes: '',
    });
    setShowNewAccount(false);
    loadData();
  }

  async function createEntry() {
    if (!showAccountDetail) return;

    const debitAmt = Number(newEntry.debit) || 0;
    const creditAmt = Number(newEntry.credit) || 0;

    if (!newEntry.contra_account_id) {
      toast({ title: t('ledger.selectContraAccount', { defaultValue: 'Select the contra account' }), description: t('ledger.contraAccountHint', { defaultValue: 'Every entry needs an offsetting account for double-entry bookkeeping.' }), variant: 'destructive' });
      return;
    }
    if ((debitAmt > 0) === (creditAmt > 0)) {
      toast({ title: t('ledger.enterDebitOrCredit', { defaultValue: 'Enter either a debit or a credit amount, not both' }), variant: 'destructive' });
      return;
    }

    const amount = debitAmt || creditAmt;
    const debitAccountId = debitAmt > 0 ? showAccountDetail.id : newEntry.contra_account_id;
    const creditAccountId = debitAmt > 0 ? newEntry.contra_account_id : showAccountDetail.id;
    const entryDate = newEntry.date_ad || new Date().toISOString().split('T')[0];
    const description = newEntry.reference_id
      ? `${newEntry.description} (Ref: ${newEntry.reference_id})`
      : newEntry.description;

    try {
      await ledgerApi.entries.createJournal({ debitAccountId, creditAccountId, amount, dateAd: entryDate, description });
      setNewEntry({ description: '', debit: 0, credit: 0, reference_id: '', contra_account_id: '', date_ad: new Date().toISOString().split('T')[0] });
      setShowNewEntry(false);
      loadData();
    } catch (e) {
      toast({ title: t('ledger.failedToSaveEntry', { defaultValue: 'Failed to save entry' }), description: e?.response?.data?.message || '', variant: 'destructive' });
    }
  }

  const filteredAccounts = accounts.filter(a =>
    (a.account_name?.toLowerCase().includes(search.toLowerCase()) ||
     a.contact_name?.toLowerCase().includes(search.toLowerCase())) &&
    (!colFilters.account_name || a.account_name?.toLowerCase().includes(colFilters.account_name.toLowerCase())) &&
    (!colFilters.contact_name || a.contact_name?.toLowerCase().includes(colFilters.contact_name.toLowerCase())) &&
    (!colFilters.status || (colFilters.status === 'active' ? a.is_active : !a.is_active))
  );

  // When ADMIN searches and gets no results, offer hidden account lookup
  const searchIsEmpty = search.trim().length > 0 && filteredAccounts.length === 0;

  const accountEntries = showAccountDetail
    ? [...entries.filter(e => e.account_id === showAccountDetail.id)].reverse()
    : [];

  const accountColumns = [
    { key: 'account_name', label: t('ledger.accountName', { defaultValue: 'Account Name' }), filterValue: colFilters.account_name, onFilterChange: v => setCol('account_name', v), render: (row) => (
      <span className="font-medium text-foreground">{row.account_name}</span>
    )},
    { key: 'contact_name', label: t('ledger.contact', { defaultValue: 'Contact' }), filterValue: colFilters.contact_name, onFilterChange: v => setCol('contact_name', v) },
    { key: 'contact_phone', label: t('ledger.phone', { defaultValue: 'Phone' }) },
    { key: 'current_balance', label: t('ledger.balance', { defaultValue: 'Balance' }), render: (row) => (
      <span className={row.current_balance >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
        NPR {(row.current_balance || 0).toLocaleString()}
      </span>
    )},
    { key: 'is_active', label: t('ledger.status', { defaultValue: 'Status' }), filterValue: colFilters.status, onFilterChange: v => setCol('status', v), filterPlaceholder: 'active/inactive', render: (row) => (
      <Badge variant={row.is_active ? 'default' : 'secondary'}>
        {row.is_active ? t('ledger.active', { defaultValue: 'Active' }) : t('ledger.inactive', { defaultValue: 'Inactive' })}
      </Badge>
    )},
  ];

  const entryColumns = [
    { key: 'date_ad', label: t('ledger.dateAD', { defaultValue: 'Date (AD)' }), render: (row) => row.date_ad ? formatDate(row.date_ad) : '-' },
    { key: 'date_bs', label: t('ledger.dateBS', { defaultValue: 'Date (BS)' }), render: (row) => row.date_bs || '-' },
    { key: 'description', label: t('ledger.description', { defaultValue: 'Description' }) },
    { key: 'reference_id', label: t('ledger.referenceNo', { defaultValue: 'Reference No.' }), render: (row) => (
      row.reference_id ? <span className="text-xs text-muted-foreground font-mono">{row.reference_id}</span> : null
    )},
    { key: 'debit', label: t('ledger.debit', { defaultValue: 'Debit' }), render: (row) => (
      row.debit ? <span className="text-red-600 font-mono">NPR {row.debit.toLocaleString()}</span> : null
    )},
    { key: 'credit', label: t('ledger.credit', { defaultValue: 'Credit' }), render: (row) => (
      row.credit ? <span className="text-green-600 font-mono">NPR {row.credit.toLocaleString()}</span> : null
    )},
    { key: 'balance', label: t('ledger.balance', { defaultValue: 'Balance' }), render: (row) => (
      <span className="font-mono font-medium">NPR {Math.abs(row.balance || 0).toLocaleString()}</span>
    )},
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('ledger.title', { defaultValue: 'Ledger' })}
        subtitle={isSchool ? t('ledger.subtitleSchool', { defaultValue: 'School income & expense accounts' }) : t('ledger.subtitleBusiness', { defaultValue: 'Purchase, Sales & Expense Accounts' })}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={activeTab === 'system' ? undefined : () => setShowNewAccount(true)}
        addLabel={t('ledger.newAccount', { defaultValue: 'New Account' })}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary">
          <TabsTrigger value="purchase">{t('ledger.purchaseAccount', { defaultValue: 'Purchase Account' })}</TabsTrigger>
          <TabsTrigger value="sales">{t('ledger.salesAccount', { defaultValue: 'Sales Account' })}</TabsTrigger>
          <TabsTrigger value="expense">{t('ledger.expensesAccount', { defaultValue: 'Expenses Account' })}</TabsTrigger>
          <TabsTrigger value="system">{t('ledger.systemAccounts', { defaultValue: 'System Accounts' })}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredAccounts.length === 0 && !searchIsEmpty ? (
            <EmptyState
              icon={BookOpen}
              title={activeTab === 'system'
                ? t('ledger.noSystemAccountsYet', { defaultValue: 'No system accounts yet' })
                : t('ledger.noAccountsYet', { defaultValue: 'No accounts yet' })}
              description={activeTab === 'system'
                ? t('ledger.noSystemAccountsYetHint', { defaultValue: 'These are created automatically the first time a Transaction, Payroll, or Cheque posts to the ledger.' })
                : t('ledger.noAccountsYetHint', { defaultValue: 'Add your first ledger account to start tracking balances.' })}
              action={activeTab === 'system' ? undefined : (
                <Button onClick={() => setShowNewAccount(true)}>
                  <Plus className="w-4 h-4 mr-2" />{t('ledger.addFirstRecord', { defaultValue: 'Add First Record' })}
                </Button>
              )}
            />
          ) : searchIsEmpty && isAdmin ? (
            <div className="bg-card rounded-xl border border-border p-10 text-center space-y-3">
              <EyeOff className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">{t('ledger.noVisibleAccountsMatch', { defaultValue: `No visible accounts match "${search}"`, search })}</p>
              <p className="text-xs text-muted-foreground">{t('ledger.mayBeHiddenHint', { defaultValue: 'This account may be hidden. Enter the exact name to search hidden accounts.' })}</p>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                setHiddenSearchName(search);
                setPwDialog({ mode: 'search' });
                setPwInput('');
              }}>
                <Lock className="w-3.5 h-3.5" /> {t('ledger.searchHiddenAccounts', { defaultValue: 'Search Hidden Accounts' })}
              </Button>
            </div>
          ) : (
            <DataTable
              columns={accountColumns}
              data={filteredAccounts}
              selectedId={selectedAccount?.id}
              onRowClick={(row) => setSelectedAccount(row)}
              onRowDoubleClick={(row) => setShowAccountDetail(row)}
              onRowContextMenu={isAdmin ? (row, e) => setContextMenu({ x: e.clientX, y: e.clientY, account: row }) : undefined}
              emptyMessage={t('ledger.noAccountsYetType', { defaultValue: `No ${activeTab} accounts yet. Click "New Account" to create one.`, type: activeTab })}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* New Account Dialog */}
      <Dialog open={showNewAccount} onOpenChange={setShowNewAccount}>
        <DialogContent className="glass-dialog max-w-3xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-slate-400 to-gray-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              {t('ledger.newTypeAccount', { defaultValue: `New ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Account`, type: activeTab.charAt(0).toUpperCase() + activeTab.slice(1) })}
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
                <BookOpen className="w-3.5 h-3.5" /> {t('ledger.accountInfo', { defaultValue: 'Account Info' })}
              </p>

              {/* Account Name */}
              <div>
                <Label className="text-xs font-medium">{t('ledger.accountNameRequired', { defaultValue: 'Account Name *' })}</Label>
                <div className="relative mt-1">
                  <BookOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder={t('ledger.partyOrAccountName', { defaultValue: 'Party or account name' })}
                    value={newAccount.account_name}
                    onChange={e => setNewAccount({ ...newAccount, account_name: e.target.value })}
                  />
                </div>
              </div>

              {/* Contact Person */}
              <div>
                <Label className="text-xs font-medium">{t('ledger.contactPerson', { defaultValue: 'Contact Person' })}</Label>
                <div className="relative mt-1">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder={t('ledger.contactNameOptional', { defaultValue: 'Contact name (optional)' })}
                    value={newAccount.contact_name}
                    onChange={e => setNewAccount({ ...newAccount, contact_name: e.target.value })}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <Label className="text-xs font-medium">{t('ledger.phone', { defaultValue: 'Phone' })}</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder={t('ledger.phoneNumberOptional', { defaultValue: 'Phone number (optional)' })}
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
                <Wallet className="w-3.5 h-3.5" /> {t('ledger.financialDetails', { defaultValue: 'Financial Details' })}
              </p>

              {/* PAN/VAT — business companies only; schools don't deal in VAT-registered parties */}
              {!isSchool && (
                <div>
                  <Label className="text-xs font-medium">{t('ledger.panVatNo', { defaultValue: 'PAN / VAT No.' })}</Label>
                  <div className="relative mt-1">
                    <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      className="pl-8 h-9 text-sm"
                      placeholder={t('ledger.panVatPlaceholder', { defaultValue: 'e.g. 123456789 (optional)' })}
                      value={newAccount.pan_vat}
                      onChange={e => setNewAccount({ ...newAccount, pan_vat: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Address */}
              <div>
                <Label className="text-xs font-medium">{t('ledger.address', { defaultValue: 'Address' })}</Label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder={t('ledger.addressOptional', { defaultValue: 'Address (optional)' })}
                    value={newAccount.address}
                    onChange={e => setNewAccount({ ...newAccount, address: e.target.value })}
                  />
                </div>
              </div>

              {/* Account Type */}
              <div>
                <Label className="text-xs font-medium">{t('ledger.accountType', { defaultValue: 'Account Type' })}</Label>
                <div className="mt-1">
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={newAccount.account_type}
                    onChange={e => setNewAccount({ ...newAccount, account_type: e.target.value })}
                  >
                    <option value="purchase">{t('ledger.purchaseAccount', { defaultValue: 'Purchase Account' })}</option>
                    <option value="sales">{t('ledger.salesAccount', { defaultValue: 'Sales Account' })}</option>
                    <option value="expense">{t('ledger.expensesAccount', { defaultValue: 'Expenses Account' })}</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> {t('ledger.notes', { defaultValue: 'Notes' })}
                </Label>
                <Textarea
                  className="mt-1 text-sm"
                  placeholder={t('ledger.optionalNotesEllipsis', { defaultValue: 'Optional notes...' })}
                  value={newAccount.notes}
                  onChange={e => setNewAccount({ ...newAccount, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </motion.div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNewAccount(false)}>{t('ledger.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={createAccount} disabled={!newAccount.account_name}>{t('ledger.createAccount', { defaultValue: 'Create Account' })}</Button>
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
          allAccounts={allAccounts}
          onToggleHidden={isAdmin ? () => {
            setPwDialog({ mode: 'hide', account: showAccountDetail });
            setPwInput('');
          } : undefined}
        />
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[180px] text-sm"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted transition-colors text-left"
            onClick={() => {
              setShowAccountDetail(contextMenu.account);
              setContextMenu(null);
            }}
          >
            <Eye className="w-3.5 h-3.5 text-muted-foreground" /> {t('ledger.openAccount', { defaultValue: 'Open Account' })}
          </button>
          <div className="border-t border-border my-1" />
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted transition-colors text-left text-amber-600"
            onClick={() => {
              setPwDialog({ mode: 'hide', account: contextMenu.account });
              setPwInput('');
              setContextMenu(null);
            }}
          >
            <EyeOff className="w-3.5 h-3.5" />
            {contextMenu.account?.isHidden ? t('ledger.unhideAccount', { defaultValue: 'Unhide Account' }) : t('ledger.hideAccount', { defaultValue: 'Hide Account' })}
          </button>
        </div>
      )}

      {/* Password dialog — hide/search/delete hidden */}
      <Dialog open={!!pwDialog} onOpenChange={open => { if (!open) { setPwDialog(null); setPwInput(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-500" />
              {pwDialog?.mode === 'hide' && (pwDialog?.account?.isHidden ? t('ledger.unhideAccount', { defaultValue: 'Unhide Account' }) : t('ledger.hideAccount', { defaultValue: 'Hide Account' }))}
              {pwDialog?.mode === 'search' && t('ledger.accessHiddenAccount', { defaultValue: 'Access Hidden Account' })}
              {pwDialog?.mode === 'deleteHidden' && t('ledger.deleteHiddenAccount', { defaultValue: 'Delete Hidden Account' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {pwDialog?.mode === 'search' && (
              <div className="space-y-1.5">
                <Label className="text-xs">{t('ledger.accountName', { defaultValue: 'Account Name' })}</Label>
                <Input
                  value={hiddenSearchName}
                  onChange={e => setHiddenSearchName(e.target.value)}
                  placeholder={t('ledger.exactAccountNameEllipsis', { defaultValue: 'Exact account name...' })}
                  className="h-9 text-sm"
                />
              </div>
            )}
            {pwDialog?.mode === 'deleteHidden' && (
              <p className="text-sm text-destructive font-medium">
                {t('ledger.permanentlyDeleteConfirm', { defaultValue: `This will permanently delete "${pwDialog?.account?.account_name}". This cannot be undone.`, name: pwDialog?.account?.account_name })}
              </p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('ledger.adminPassword', { defaultValue: 'Admin Password' })}</Label>
              <Input
                type="password"
                value={pwInput}
                onChange={e => setPwInput(e.target.value)}
                placeholder={t('ledger.enterYourPasswordEllipsis', { defaultValue: 'Enter your password...' })}
                className="h-9 text-sm"
                onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPwDialog(null); setPwInput(''); }}>{t('ledger.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button
              onClick={handlePasswordSubmit}
              disabled={!pwInput.trim() || pwLoading}
              variant={pwDialog?.mode === 'deleteHidden' ? 'destructive' : 'default'}
            >
              {pwLoading ? t('ledger.verifyingEllipsis', { defaultValue: 'Verifying…' }) : t('ledger.confirm', { defaultValue: 'Confirm' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
