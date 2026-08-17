import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/adapter';
import { getActiveCompanyId } from '@/lib/companyContext';
import { adToBs } from '@/lib/nepaliDate';
import { formatDate } from '@/lib/utils';
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
  Landmark, Globe, Lock, ArrowLeftRight, Receipt,
} from 'lucide-react';
import { useRole } from "@/lib/useRole";
import { motion } from 'framer-motion';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import FloatingBankBrowser from '../components/FloatingBankBrowser';

const ACCOUNT_TYPES = [
  { v: 'purchase', color: 'border-blue-400 text-blue-700', active: 'bg-blue-50 border-blue-500' },
  { v: 'sales',    color: 'border-green-400 text-green-700', active: 'bg-green-50 border-green-500' },
  { v: 'expense',  color: 'border-red-400 text-red-700',  active: 'bg-red-50 border-red-500' },
];

const PAY_METHODS = [
  { id: 'cash',   emoji: '💵' },
  { id: 'bank',   emoji: '🏦' },
  { id: 'cheque', emoji: '📋' },
  { id: 'qr',     emoji: '📱' },
  { id: 'credit', emoji: '🧾' },
];

// The backend's Prisma/Zod enums are SCREAMING_SNAKE_CASE (CASH, INCOME, HAND_OUTS…)
// while the UI's internal state stays lowercase/hyphenated for the existing chip/tab
// logic below — these two helpers are the only place the wire format is converted.
const toApiEnum = (v) => (v || '').toUpperCase().replace(/-/g, '_');
const fromApiEnum = (v) => (v || '').toLowerCase().replace(/_/g, '-');

// The "other side" of every manual transaction's double entry is resolved automatically
// from the payment method instead of asking the user to pick a ledger account for it —
// these are the same system account names LedgerPostingService auto-creates for Sales/
// Purchase postings, so a Transactions-page entry lands on the exact same accounts.
const SYSTEM_ACCOUNT_DEFS = {
  cash:            { name: 'Cash in Hand',        type: 'ASSET' },
  bank:            { name: 'Bank Account',        type: 'ASSET' },
  payable:         { name: 'Accounts Payable',    type: 'LIABILITY' },
  receivable:      { name: 'Accounts Receivable', type: 'ASSET' },
  salesRevenue:    { name: 'Sales Revenue',       type: 'INCOME' },
  purchaseExpense: { name: 'Purchase Expenses',   type: 'EXPENSE' },
};

function findSystemAccount(accounts, key) {
  const name = SYSTEM_ACCOUNT_DEFS[key].name.toLowerCase();
  return accounts.find(a => (a.account_name || a.accountName || '').toLowerCase() === name);
}

// cash/bank/qr/cheque settle through Cash or Bank; credit settles later through the
// income/expense category itself (Sales Revenue / Purchase Expenses), since the debt
// side is what the user picks in the Ledger Account field for a credit entry.
function counterAccountKey(payMethod, category) {
  if (payMethod === 'cash') return 'cash';
  if (payMethod === 'credit') return category === 'income' ? 'salesRevenue' : 'purchaseExpense';
  return 'bank'; // bank, qr, cheque
}

// Cheques and credit entries aren't settled yet when recorded — default them to
// Pending so they don't move Cash/Bank balances until marked Completed later.
function defaultStatusForMethod(payMethod) {
  return (payMethod === 'cheque' || payMethod === 'credit') ? 'pending' : 'completed';
}

export default function Transactions() {
  const { t } = useTranslation();
  const { canDelete } = useRole();
  const companyId = getActiveCompanyId();
  const [transactions, setTransactions] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [ledgerAccounts, setLedgerAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [colFilters, setColFilters] = useState({ description: '', party_name: '', category: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showNew, setShowNew] = useState(false);
  const [showPartySuggestions, setShowPartySuggestions] = useState(false);
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
    account_type: 'purchase', category: 'expense', status: defaultStatusForMethod('cash'), amount: 0, description: '',
    bank_name: '', bank_account_number: '', cheque_number: '', cheque_date: '',
    cheque_issue_date: '', party_name: '',
    date_ad: new Date().toISOString().split('T')[0], reference_number: '', cash_bank_note: '',
  });

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);
    const [rawTxns, banks, ledgerAccountsData] = await Promise.all([
      api.Transaction.filter({ company_id: companyId }, '-created_date', 100),
      api.BankAccount.filter({ company_id: companyId }),
      api.LedgerAccount.filter({ company_id: companyId }),
    ]);
    // Backend stores/returns type|category|status as uppercase enums — normalize to
    // the lowercase/hyphenated form the rest of this page's filtering/display expects.
    const txns = rawTxns.map(t => ({
      ...t,
      type: fromApiEnum(t.type),
      category: fromApiEnum(t.category),
      status: fromApiEnum(t.status),
    }));
    setTransactions(txns);
    setBankAccounts(banks);
    setLedgerAccounts(ledgerAccountsData);
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

  // Lazily creates whichever system ledger accounts (Cash in Hand, Bank Account,
  // Accounts Payable/Receivable, Sales Revenue, Purchase Expenses) don't exist yet for
  // this company, so the auto-resolved "other side" of an entry always has somewhere to post.
  async function ensureSystemAccounts(accounts) {
    const missing = Object.values(SYSTEM_ACCOUNT_DEFS).filter(
      def => !accounts.some(a => (a.account_name || a.accountName || '').toLowerCase() === def.name.toLowerCase())
    );
    if (missing.length === 0) return accounts;
    await Promise.all(missing.map(def => api.LedgerAccount.create({
      company_id: companyId, account_name: def.name, account_type: def.type, opening_balance: 0,
    })));
    const refreshed = await api.LedgerAccount.filter({ company_id: companyId });
    setLedgerAccounts(refreshed);
    return refreshed;
  }

  function findLedgerAccountByType(accounts, type) {
    return accounts.find(a => (a.account_type || a.accountType || '').toLowerCase() === type);
  }

  async function selectPayMethod(id) {
    setPayMethod(id);
    setForm(f => ({ ...f, status: defaultStatusForMethod(id) }));
  }

  function selectAccountType(v) {
    const category = v === 'sales' ? 'income' : 'expense';
    setForm(f => ({ ...f, account_type: v, category }));
  }

  async function createTransaction() {
    const entryDate = form.date_ad || new Date().toISOString().split('T')[0];
    const bsDate = adToBs(new Date(entryDate));
    const amount = Number(form.amount || 0);

    const description = form.cash_bank_note ? `${form.description} — ${form.cash_bank_note}` : form.description;

    // Resolve the party's own Ledger account — auto-creating it if this is the
    // first time this exact name is used — so purchases/sales always land
    // somewhere findable instead of silently falling back to the hidden generic
    // system bucket (Purchase Expenses / Sales Revenue).
    let partyAccount = matchedLedgerAccount;
    if (!partyAccount && form.party_name.trim()) {
      const accountTypeMap = { purchase: 'LIABILITY', sales: 'INCOME', expense: 'EXPENSE' };
      partyAccount = await api.LedgerAccount.create({
        company_id: companyId,
        account_name: form.party_name.trim(),
        account_type: accountTypeMap[form.account_type] || 'EXPENSE',
        opening_balance: 0,
      });
      setLedgerAccounts(accts => [...accts, partyAccount]);
    }

    const partyType = (partyAccount?.account_type || partyAccount?.accountType || '').toUpperCase();
    // An EXPENSE-type party account (Expenses Account tab = a cost category, e.g.
    // "Electricity Bill") replaces the real debit leg — it's still one balanced
    // GL account, just a more specific one than generic "Purchase Expenses".
    // A LIABILITY (vendor) or INCOME (customer) account never replaces the real
    // Cash/Bank/Payable/Receivable leg — by design those track total spend/income
    // per party (regardless of payment method) via a separate memo entry instead
    // (partyAccountId), which only actually posts once the transaction becomes
    // COMPLETED — see backend TransactionServiceImpl / LedgerPostingService.postPartyMemoEntryTx.
    const debitAccountId = partyType === 'EXPENSE' ? partyAccount.id : undefined;
    const partyAccountId = (partyType === 'LIABILITY' || partyType === 'INCOME') ? partyAccount.id : undefined;

    const payload = {
      ...form,
      description,
      type: toApiEnum(payMethod),
      category: toApiEnum(form.category),
      status: toApiEnum(form.status),
      company_id: companyId,
      date_ad: entryDate,
      date_bs: bsDate.formatted,
      amount,
      reference: form.reference_number || undefined,
      debit_account_id: debitAccountId,
      party_account_id: partyAccountId,
    };
    delete payload.cash_bank_note;
    delete payload.reference_number;

    await api.Transaction.create(payload);

    setForm({
      account_type: 'purchase',
      category: 'expense',
      status: defaultStatusForMethod('cash'),
      amount: 0,
      description: '',
      bank_name: '', bank_account_number: '', cheque_number: '', cheque_date: '',
      cheque_issue_date: '', party_name: '',
      date_ad: new Date().toISOString().split('T')[0], reference_number: '', cash_bank_note: '',
    });
    setPayMethod('cash');
    setShowNew(false);
    loadData();
  }

  // Updates local state immediately instead of calling loadData() (which flips the
  // page-wide `loading` flag and swaps the whole table out for a spinner mid-click —
  // that's what made the status dropdown feel like it needed two clicks to register).
  async function updateTransactionStatus(id, newStatusLower) {
    const previous = transactions;
    setTransactions(txns => txns.map(t => t.id === id ? { ...t, status: newStatusLower } : t));
    try {
      await api.Transaction.update(id, { status: toApiEnum(newStatusLower) });
    } catch (err) {
      setTransactions(previous);
      alert(err?.response?.data?.message || t('transactions.failedToUpdateStatus', { defaultValue: 'Failed to update status.' }));
    }
  }

  const filtered = transactions.filter(t => {
    if (activeTab !== 'all' && t.type !== activeTab) return false;
    if (!(t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.party_name?.toLowerCase().includes(search.toLowerCase()))) return false;
    if (dateFrom && (t.date_ad || '') < dateFrom) return false;
    if (dateTo && (t.date_ad || '') > dateTo) return false;
    if (colFilters.description && !t.description?.toLowerCase().includes(colFilters.description.toLowerCase())) return false;
    if (colFilters.party_name && !t.party_name?.toLowerCase().includes(colFilters.party_name.toLowerCase())) return false;
    if (colFilters.category && !(t.category || '').toLowerCase().includes(colFilters.category.toLowerCase())) return false;
    if (colFilters.status && !(t.status || '').toLowerCase().includes(colFilters.status.toLowerCase())) return false;
    return true;
  });

  // Summaries
  // Only Completed transactions have actually moved real cash — a Pending cash
  // transaction now posts to Accounts Receivable/Payable instead (see backend),
  // so it must not count here or this number won't match the real Ledger.
  const cashBalance = transactions.filter(t => t.type === 'cash' && t.status === 'completed')
    .reduce((sum, t) => sum + (t.category === 'income' ? (t.amount || 0) : -(t.amount || 0)), 0);
  const bankTotal = bankAccounts.reduce((sum, b) => sum + (b.current_balance || 0), 0);

  const typeIcons = { cash: Banknote, bank: CreditCard, qr: QrCode, cheque: FileCheck, credit: Receipt };

  // Display-label lookups for values that come from the wire-format enums (see
  // toApiEnum/fromApiEnum above) — the enums themselves stay untranslated since
  // they're API contract values, but the text shown to the user for them isn't.
  const tabLabels = {
    cash: t('transactions.tabCash', { defaultValue: 'Cash' }),
    bank: t('transactions.tabBank', { defaultValue: 'Bank' }),
    qr: t('transactions.tabQr', { defaultValue: 'QR' }),
    cheque: t('transactions.tabCheque', { defaultValue: 'Cheque' }),
    credit: t('transactions.tabCredit', { defaultValue: 'Credit' }),
  };
  const payMethodLabels = {
    cash: t('transactions.payMethodCash', { defaultValue: 'Cash' }),
    bank: t('transactions.payMethodBank', { defaultValue: 'Bank Transfer' }),
    cheque: t('transactions.payMethodCheque', { defaultValue: 'Cheque' }),
    qr: t('transactions.payMethodQr', { defaultValue: 'QR / UPI' }),
    credit: t('transactions.payMethodCredit', { defaultValue: 'Credit' }),
  };
  const accountTypeChipLabels = {
    purchase: t('transactions.purchaseAccount', { defaultValue: 'Purchase Account' }),
    sales: t('transactions.salesAccount', { defaultValue: 'Sales Account' }),
    expense: t('transactions.expensesAccount', { defaultValue: 'Expenses Account' }),
  };
  const categoryLabels = {
    income: t('transactions.categoryIncome', { defaultValue: 'Income' }),
    expense: t('transactions.categoryExpense', { defaultValue: 'Expense' }),
  };
  const bankAccountTypeLabels = {
    current: t('transactions.bankTypeCurrent', { defaultValue: 'Current' }),
    savings: t('transactions.bankTypeSavings', { defaultValue: 'Savings' }),
    fixed: t('transactions.bankTypeFixed', { defaultValue: 'Fixed' }),
  };
  const ledgerAccountTypeLabels = {
    ASSET: t('transactions.acctTypeAsset', { defaultValue: 'Asset' }),
    LIABILITY: t('transactions.acctTypeLiability', { defaultValue: 'Liability' }),
    INCOME: categoryLabels.income,
    EXPENSE: categoryLabels.expense,
    EQUITY: t('transactions.acctTypeEquity', { defaultValue: 'Equity' }),
  };
  const statusLabels = {
    completed: t('transactions.statusCompleted', { defaultValue: 'Completed' }),
    pending: t('transactions.statusPending', { defaultValue: 'Pending' }),
    cancelled: t('transactions.statusCancelled', { defaultValue: 'Cancelled' }),
  };

  // The Ledger Account field now filters by the selected account type (purchase/sales/expense).
  // The payment method still resolves the counterparty side automatically.
  const matchedLedgerAccount = form.party_name.trim()
    ? ledgerAccounts.find(a => (a.account_name || a.accountName || '').toLowerCase() === form.party_name.trim().toLowerCase())
    : null;

  // Suggestions for the Party Name autocomplete — accounts whose name starts
  // with what's typed so far, so "ABC" surfaces an existing "ABC Stationary"
  // instead of silently creating a duplicate "ABC" account on save.
  const partyNameQuery = form.party_name.trim().toLowerCase();
  const partySuggestions = partyNameQuery && !matchedLedgerAccount
    ? ledgerAccounts
        .filter(a => (a.account_name || a.accountName || '').toLowerCase().startsWith(partyNameQuery))
        .slice(0, 6)
    : [];

  const salesRevenueLabel = t('transactions.salesRevenueLabel', { defaultValue: 'Sales Revenue' });
  const accountsPayableLabel = t('transactions.accountsPayableLabel', { defaultValue: 'Accounts Payable' });
  const cashBankAccountLabel = t('transactions.cashBankAccountLabel', { defaultValue: 'Cash/Bank Account' });
  const purchaseExpensesLabel = t('transactions.purchaseExpensesLabel', { defaultValue: 'Purchase Expenses' });

  const counterLabel = payMethod === 'credit'
    ? (form.account_type === 'sales' ? salesRevenueLabel : accountsPayableLabel)
    : cashBankAccountLabel;

  // Mirrors createTransaction()'s real posting logic, for the on-screen preview.
  const partyLabel = form.party_name.trim() || null;
  let debitCreditSummary;
  let partyTrackingNote = null;
  if (form.account_type === 'expense') {
    const debitSide = partyLabel || purchaseExpensesLabel;
    debitCreditSummary = payMethod === 'credit'
      ? t('transactions.summaryDebitPayable', { debitSide, defaultValue: `${debitSide} is debited, Accounts Payable is credited.` })
      : t('transactions.summaryDebitCashBank', { debitSide, defaultValue: `${debitSide} is debited, Cash/Bank Account is credited.` });
  } else if (form.account_type === 'sales') {
    debitCreditSummary = payMethod === 'credit'
      ? t('transactions.summaryReceivableSales', { defaultValue: 'Accounts Receivable is debited, Sales Revenue is credited.' })
      : t('transactions.summaryCashBankSales', { defaultValue: 'Cash/Bank Account is debited, Sales Revenue is credited.' });
    if (partyLabel) partyTrackingNote = t('transactions.partyTrackingSaleNote', { partyLabel, defaultValue: `"${partyLabel}" account will also track this sale once it's Completed, regardless of payment method.` });
  } else {
    debitCreditSummary = payMethod === 'credit'
      ? t('transactions.summaryPurchasePayable', { defaultValue: 'Purchase Expenses is debited, Accounts Payable is credited.' })
      : t('transactions.summaryPurchaseCashBank', { defaultValue: 'Purchase Expenses is debited, Cash/Bank Account is credited.' });
    if (partyLabel) partyTrackingNote = t('transactions.partyTrackingPurchaseNote', { partyLabel, defaultValue: `"${partyLabel}" account will also track this purchase once it's Completed, regardless of payment method.` });
  }

  const columns = [
    { key: 'date_ad', label: t('transactions.colDate', { defaultValue: 'Date' }), render: (row) => (
      <div className="text-xs"><div>{formatDate(row.date_ad)}</div><div className="text-muted-foreground">{row.date_bs}</div></div>
    )},
    { key: 'type', label: t('transactions.colType', { defaultValue: 'Type' }), render: (row) => {
      const Icon = typeIcons[row.type] || Banknote;
      return <div className="flex items-center gap-1.5"><Icon className="w-4 h-4" /><span className="text-sm">{tabLabels[row.type] || row.type}</span></div>;
    }},
    { key: 'category', label: t('transactions.colCategory', { defaultValue: 'Category' }), filterValue: colFilters.category, onFilterChange: v => setCol('category', v), filterPlaceholder: t('transactions.colCategoryFilterPlaceholder', { defaultValue: 'e.g. income' }), render: (row) => (
      <Badge variant="outline">{categoryLabels[row.category] || row.category}</Badge>
    )},
    { key: 'description', label: t('transactions.colDescription', { defaultValue: 'Description' }), filterValue: colFilters.description, onFilterChange: v => setCol('description', v) },
    { key: 'party_name', label: t('transactions.colParty', { defaultValue: 'Party' }), filterValue: colFilters.party_name, onFilterChange: v => setCol('party_name', v) },
    { key: 'cheque_date', label: t('transactions.colChequeDueDate', { defaultValue: 'Cheque Due Date' }), render: (row) => row.type === 'cheque' && row.cheque_date ? (
      <span className="text-xs font-mono">{formatDate(row.cheque_date)}</span>
    ) : <span className="text-muted-foreground text-xs">-</span> },
    // Same inflow/outflow rule the old single Amount column used (only 'expense' is an
    // outflow) — now split across two columns instead of a +/- prefix on one.
    { key: 'debit', label: t('transactions.colDebit', { defaultValue: 'Debit' }), render: (row) => (
      row.type === 'credit' ? (
        <span className="text-muted-foreground text-xs">—</span>
      ) : row.category === 'expense' ? (
        <span className="font-semibold font-mono text-red-600">NPR {(row.amount || 0).toLocaleString()}</span>
      ) : <span className="text-muted-foreground text-xs">—</span>
    )},
    { key: 'credit', label: t('transactions.colCredit', { defaultValue: 'Credit' }), render: (row) => (
      row.type === 'credit' ? (
        <span className="font-semibold font-mono text-green-600">NPR {(row.amount || 0).toLocaleString()}</span>
      ) : row.category === 'expense' ? (
        <span className="text-muted-foreground text-xs">—</span>
      ) : <span className="font-semibold font-mono text-green-600">NPR {(row.amount || 0).toLocaleString()}</span>
    )},
    { key: 'status', label: t('transactions.colStatus', { defaultValue: 'Status' }), filterValue: colFilters.status, onFilterChange: v => setCol('status', v), filterPlaceholder: t('transactions.colStatusFilterPlaceholder', { defaultValue: 'e.g. pending' }), render: (row) => (
      <select
        value={row.status}
        onClick={e => e.stopPropagation()}
        onChange={e => updateTransactionStatus(row.id, e.target.value)}
        className="text-xs border border-input rounded-md px-2 py-1 bg-background cursor-pointer"
      >
        <option value="completed">{statusLabels.completed}</option>
        <option value="pending">{statusLabels.pending}</option>
        <option value="cancelled">{statusLabels.cancelled}</option>
      </select>
    )},
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('transactions.pageTitle', { defaultValue: 'Transactions' })}
        subtitle={t('transactions.pageSubtitle', { defaultValue: 'Cash, Bank, QR, Cheque & Credit records' })}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => {
          selectPayMethod(
            activeTab === 'bank' ? 'bank' :
            activeTab === 'cheque' ? 'cheque' :
            activeTab === 'qr' ? 'qr' :
            activeTab === 'credit' ? 'credit' : 'cash'
          );
          setShowNew(true);
        }}
        addLabel={t('transactions.newTransaction', { defaultValue: 'New Transaction' })}
      />

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Label className="text-xs font-medium">{t('transactions.fromDate', { defaultValue: 'From Date' })}</Label>
              <Input type="date" className="h-9 text-sm mt-1" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label className="text-xs font-medium">{t('transactions.toDate', { defaultValue: 'To Date' })}</Label>
              <Input type="date" className="h-9 text-sm mt-1" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
          <Button variant="outline" onClick={() => { setDateFrom(''); setDateTo(''); }} disabled={!dateFrom && !dateTo}>
            {t('transactions.clearDates', { defaultValue: 'Clear Dates' })}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">{t('transactions.cashInHand', { defaultValue: 'Cash in Hand' })}</p>
          <p className="text-xl font-bold mt-1">NPR {cashBalance.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">{t('transactions.bankBalance', { defaultValue: 'Bank Balance' })}</p>
          <p className="text-xl font-bold mt-1">NPR {bankTotal.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">{t('transactions.bankAccounts', { defaultValue: 'Bank Accounts' })}</p>
          <p className="text-xl font-bold mt-1">{bankAccounts.length}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">{t('transactions.totalTransactions', { defaultValue: 'Total Transactions' })}</p>
          <p className="text-xl font-bold mt-1">{transactions.length}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); if (v === 'bank' && bankAccounts.length > 0) setActiveBankId(bankAccounts[0].id); }}>
        <TabsList>
          <TabsTrigger value="all">{t('transactions.tabAll', { defaultValue: 'All' })}</TabsTrigger>
          <TabsTrigger value="cash">{tabLabels.cash}</TabsTrigger>
          <TabsTrigger value="bank">{tabLabels.bank}</TabsTrigger>
          <TabsTrigger value="qr">{tabLabels.qr}</TabsTrigger>
          <TabsTrigger value="cheque">{tabLabels.cheque}</TabsTrigger>
          <TabsTrigger value="credit">{tabLabels.credit}</TabsTrigger>
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
                <Plus className="w-3.5 h-3.5" /> {t('transactions.addAccount', { defaultValue: 'Add Account' })}
              </button>
            </div>

            {/* Active bank account details */}
            {(() => {
              const acct = bankAccounts.find(b => b.id === activeBankId);
              if (!acct) return (
                <div className="bg-card border rounded-xl p-12 text-center">
                  <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">{t('transactions.noBankAccountsYet', { defaultValue: 'No bank accounts yet. Click "Add Account" to create one.' })}</p>
                </div>
              );
              const bankTxns = filtered.filter(t => t.bank_account_number === acct.account_number || t.bank_name === acct.bank_name);
              return (
                <div className="space-y-4">
                  <div className="bg-card border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div><p className="text-xs text-muted-foreground">{tabLabels.bank}</p><p className="font-semibold">{acct.bank_name}</p></div>
                    <div><p className="text-xs text-muted-foreground">{t('transactions.accountNo', { defaultValue: 'Account No.' })}</p><p className="font-mono text-sm">{acct.account_number}</p></div>
                    <div><p className="text-xs text-muted-foreground">{t('transactions.type', { defaultValue: 'Type' })}</p><p>{bankAccountTypeLabels[acct.account_type] || acct.account_type}</p></div>
                    <div><p className="text-xs text-muted-foreground">{t('transactions.balance', { defaultValue: 'Balance' })}</p><p className="font-bold text-green-600">NPR {(acct.current_balance || 0).toLocaleString()}</p></div>
                    {acct.portal_url && (
                      <div className="col-span-2 sm:col-span-4 flex items-center gap-3 pt-1 border-t">
                        <button onClick={() => setBrowserAccount(acct)} className="flex items-center gap-1 text-sm text-primary hover:underline">
                          <ExternalLink className="w-3.5 h-3.5" /> {t('transactions.openBankPortal', { defaultValue: 'Open Bank Portal' })}
                        </button>
                        {acct.portal_username && <span className="text-xs text-muted-foreground">{t('transactions.userLabel', { defaultValue: 'User:' })} <span className="font-mono">{acct.portal_username}</span></span>}
                      </div>
                    )}
                  </div>
                  <DataTable columns={columns} data={bankTxns} emptyMessage={t('transactions.noTransactionsForAccount', { defaultValue: 'No transactions for this account' })} />
                </div>
              );
            })()}

            {/* Add Bank Account Dialog */}
            <Dialog open={showAddBank} onOpenChange={setShowAddBank}>
              <DialogContent className="glass-dialog max-w-2xl overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500 -mx-6 -mt-6 mb-4" />
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-primary" /> {t('transactions.addBankAccount', { defaultValue: 'Add Bank Account' })}
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
                      <Landmark className="w-3.5 h-3.5" /> {t('transactions.bankDetails', { defaultValue: 'Bank Details' })}
                    </p>

                    {/* Bank Name */}
                    <div>
                      <Label className="text-xs font-medium">{t('transactions.bankNameRequired', { defaultValue: 'Bank Name *' })}</Label>
                      <div className="relative mt-1">
                        <Landmark className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          className="pl-8 h-9 text-sm"
                          placeholder={t('transactions.bankNamePlaceholder', { defaultValue: 'e.g. Nepal Investment Bank' })}
                          value={bankForm.bank_name}
                          onChange={e => setBankForm({ ...bankForm, bank_name: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Account Type chips */}
                    <div>
                      <Label className="text-xs font-medium">{t('transactions.accountType', { defaultValue: 'Account Type' })}</Label>
                      <div className="flex gap-2 mt-1">
                        {['current', 'savings', 'fixed'].map(acctType => (
                          <button
                            key={acctType}
                            type="button"
                            onClick={() => setBankForm({ ...bankForm, account_type: acctType })}
                            className={`sel-chip text-xs px-3 py-1.5 rounded-md ${
                              bankForm.account_type === acctType
                                ? 'border-primary bg-primary/10 text-primary border-2'
                                : 'border-border text-muted-foreground border'
                            }`}
                          >
                            {bankAccountTypeLabels[acctType]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Branch */}
                    <div>
                      <Label className="text-xs font-medium">{t('transactions.branch', { defaultValue: 'Branch' })}</Label>
                      <div className="relative mt-1">
                        <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          className="pl-8 h-9 text-sm"
                          placeholder={t('transactions.branchPlaceholder', { defaultValue: 'Branch name (optional)' })}
                          value={bankForm.branch}
                          onChange={e => setBankForm({ ...bankForm, branch: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Opening Balance */}
                    <div>
                      <Label className="text-xs font-medium">{t('transactions.openingBalance', { defaultValue: 'Opening Balance' })}</Label>
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
                      <Lock className="w-3.5 h-3.5" /> {t('transactions.portalLogin', { defaultValue: 'Portal Login' })}
                    </p>

                    {/* Account Number */}
                    <div>
                      <Label className="text-xs font-medium">{t('transactions.accountNumberRequired', { defaultValue: 'Account Number *' })}</Label>
                      <div className="relative mt-1">
                        <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          className="pl-8 h-9 text-sm"
                          placeholder={t('transactions.accountNumberPlaceholder', { defaultValue: 'Account number' })}
                          value={bankForm.account_number}
                          onChange={e => setBankForm({ ...bankForm, account_number: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Portal URL */}
                    <div>
                      <Label className="text-xs font-medium">{t('transactions.portalUrl', { defaultValue: 'Portal URL' })}</Label>
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
                      <Label className="text-xs font-medium">{t('transactions.usernameCustomerId', { defaultValue: 'Username / Customer ID' })}</Label>
                      <div className="relative mt-1">
                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          className="pl-8 h-9 text-sm"
                          placeholder={t('transactions.usernamePlaceholder', { defaultValue: 'Username' })}
                          value={bankForm.portal_username}
                          onChange={e => setBankForm({ ...bankForm, portal_username: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <Label className="text-xs font-medium">{t('transactions.password', { defaultValue: 'Password' })}</Label>
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
                  <Button variant="outline" onClick={() => setShowAddBank(false)}>{t('transactions.cancel', { defaultValue: 'Cancel' })}</Button>
                  <Button onClick={createBankAccount} disabled={!bankForm.bank_name || !bankForm.account_number}>{t('transactions.addAccount', { defaultValue: 'Add Account' })}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <TabsContent value={activeTab} className="mt-4">
            {filtered.length === 0 ? (
              <EmptyState
                icon={ArrowLeftRight}
                title={t('transactions.noTransactionsYetTitle', { defaultValue: 'No transactions yet' })}
                description={t('transactions.noTransactionsYetDesc', { defaultValue: 'Record your first income or expense transaction.' })}
                action={
                  <Button onClick={() => setShowNew(true)}>
                    <Plus className="w-4 h-4 mr-2" />{t('transactions.addFirstRecord', { defaultValue: 'Add First Record' })}
                  </Button>
                }
              />
            ) : (
              <DataTable columns={columns} data={filtered} emptyMessage={t('transactions.noTransactionsYetTitle', { defaultValue: 'No transactions yet' })} />
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
              <Banknote className="w-5 h-5 text-primary" /> {t('transactions.newTransaction', { defaultValue: 'New Transaction' })}
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
                <Banknote className="w-3.5 h-3.5" /> {t('transactions.transactionDetails', { defaultValue: 'Transaction Details' })}
              </p>

              {/* Large NPR Amount */}
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('transactions.amountRequired', { defaultValue: 'Amount *' })}</Label>
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

              {/* Ledger Account Type */}
              <div>
                <Label className="text-xs font-medium">{t('transactions.ledgerAccountType', { defaultValue: 'Ledger Account Type' })}</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {ACCOUNT_TYPES.map(c => (
                    <button
                      key={c.v}
                      type="button"
                      onClick={() => selectAccountType(c.v)}
                      className={`sel-chip text-xs px-3 py-1.5 rounded-md ${
                        form.account_type === c.v
                          ? c.active + ' border-2'
                          : c.color + ' border opacity-70'
                      }`}
                    >
                      {accountTypeChipLabels[c.v]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="text-xs font-medium">{t('transactions.descriptionRequired', { defaultValue: 'Description *' })}</Label>
                <div className="relative mt-1">
                  <FileText className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder={t('transactions.descriptionPlaceholder', { defaultValue: 'What is this transaction for?' })}
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Party Name */}
              <div className="relative">
                <Label className="text-xs font-medium">{t('transactions.partyName', { defaultValue: 'Party Name' })}</Label>
                <div className="relative mt-1">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder={t('transactions.partyNamePlaceholder', { defaultValue: 'Vendor, customer, or party (optional)' })}
                    value={form.party_name}
                    onChange={e => setForm({ ...form, party_name: e.target.value })}
                    onFocus={() => setShowPartySuggestions(true)}
                    onBlur={() => setTimeout(() => setShowPartySuggestions(false), 150)}
                  />
                </div>
                {showPartySuggestions && partySuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-input bg-background shadow-md max-h-48 overflow-y-auto">
                    {partySuggestions.map(a => {
                      const acctTypeRaw = (a.account_type || a.accountType || '').toUpperCase();
                      return (
                        <button
                          type="button"
                          key={a.id}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center justify-between gap-2"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            setForm(f => ({ ...f, party_name: a.account_name || a.accountName }));
                            setShowPartySuggestions(false);
                          }}
                        >
                          <span>{a.account_name || a.accountName}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{ledgerAccountTypeLabels[acctTypeRaw] || a.account_type || a.accountType}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Debit / Credit — every transaction posts a balanced double-entry pair.
                  The "other side" (Cash/Bank, or Sales Revenue/Purchase Expenses for
                  Credit) is resolved automatically from the Payment Method — see
                  counterAccountKey() — so only the category/debt side needs picking here. */}
              <div className="pt-1 border-t">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2 pb-1">{t('transactions.debitAndCredit', { defaultValue: 'Debit & Credit' })}</p>
                <p className="text-xs text-muted-foreground mb-2">{debitCreditSummary}</p>
                {partyTrackingNote && (
                  <p className="text-xs text-muted-foreground mb-2">{partyTrackingNote}</p>
                )}
                {form.status === 'pending' && (
                  <p className="text-xs text-amber-600 mb-2">
                    {t('transactions.pendingNotePrefix', { defaultValue: 'Recorded as' })} <strong>{statusLabels.pending}</strong>{' — '}
                    {form.category === 'income'
                      ? t('transactions.pendingNoteIncome', { defaultValue: "Cash/Bank won't move yet. Instead this posts to Accounts Receivable as money expected, until it's marked Completed (e.g. the cheque clears or payment is received)." })
                      : t('transactions.pendingNoteExpense', { defaultValue: "Cash/Bank won't move yet. Instead this posts to Accounts Payable as money owed, until it's marked Completed (e.g. the cheque clears or payment is received)." })}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-muted/50 p-3">
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-xs font-medium">{t('transactions.partyLedgerAccount', { defaultValue: 'Party Ledger Account' })}</p>
                    {matchedLedgerAccount ? (
                      <p className="text-xs text-muted-foreground mt-1">{t('transactions.matchedAccount', { name: matchedLedgerAccount.account_name, defaultValue: `Matched: ${matchedLedgerAccount.account_name}` })}</p>
                    ) : partyLabel ? (
                      <p className="text-xs text-muted-foreground mt-1">{t('transactions.willCreateNewAccount', { name: partyLabel, defaultValue: `Will create a new "${partyLabel}" account on save.` })}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">{t('transactions.noPartyNameYet', { defaultValue: 'No Party Name entered yet.' })}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium">{t('transactions.status', { defaultValue: 'Status' })}</Label>
                    <select
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    >
                      <option value="completed">{statusLabels.completed}</option>
                      <option value="pending">{statusLabels.pending}</option>
                      <option value="cancelled">{statusLabels.cancelled}</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium">{t('transactions.noteOptional', { defaultValue: 'Note (optional)' })}</Label>
                <Input
                  className="h-9 text-sm mt-1"
                  placeholder={payMethod === 'credit'
                    ? t('transactions.notePlaceholderCredit', { defaultValue: 'e.g. terms / party detail' })
                    : t('transactions.notePlaceholderCashBank', { defaultValue: 'e.g. which bank or cash drawer' })}
                  value={form.cash_bank_note}
                  onChange={e => setForm({ ...form, cash_bank_note: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">{t('transactions.otherSideResolvedAuto', { counterLabel, defaultValue: `The other side of the entry (${counterLabel}) is resolved automatically — this is just appended to the description.` })}</p>
              </div>

              {/* Date */}
              <div>
                <Label className="text-xs font-medium">{t('transactions.dateRequired', { defaultValue: 'Date *' })}</Label>
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
                <Label className="text-xs font-medium">{t('transactions.referenceNo', { defaultValue: 'Reference No.' })}</Label>
                <div className="relative mt-1">
                  <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder={t('transactions.referenceNoPlaceholder', { defaultValue: 'e.g. Bill/Voucher # (optional)' })}
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
                <CreditCard className="w-3.5 h-3.5" /> {t('transactions.paymentMethod', { defaultValue: 'Payment Method' })}
              </p>

              {/* 2×2 Payment method tiles */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                {PAY_METHODS.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectPayMethod(m.id)}
                    className={`pay-card flex flex-col items-center gap-1 py-3 rounded-lg border transition-all ${
                      payMethod === m.id
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="text-2xl">{m.emoji}</span>
                    <span className="text-xs font-medium">{payMethodLabels[m.id]}</span>
                  </button>
                ))}
              </div>

              {/* Conditional fields */}
              {(payMethod === 'bank' || payMethod === 'qr') && (
                <div className="space-y-3 pt-1">
                  {bankAccounts.length > 0 && (
                    <div>
                      <Label className="text-xs font-medium">{t('transactions.selectBankAccount', { defaultValue: 'Select Bank Account' })}</Label>
                      <Select
                        value={form.bank_account_number}
                        onValueChange={v => {
                          const acct = bankAccounts.find(b => b.account_number === v);
                          setForm({ ...form, bank_name: acct?.bank_name || '', bank_account_number: v });
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder={t('transactions.chooseAccountEllipsis', { defaultValue: 'Choose account...' })} /></SelectTrigger>
                        <SelectContent>
                          {bankAccounts.map(b => (
                            <SelectItem key={b.id} value={b.account_number}>
                              {b.bank_name} — {b.account_number} ({bankAccountTypeLabels[b.account_type] || b.account_type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">{t('transactions.orEnterManually', { defaultValue: 'Or enter manually below' })}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs font-medium">{t('transactions.bankName', { defaultValue: 'Bank Name' })}</Label>
                    <Input className="h-9 text-sm mt-1" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">{t('transactions.accountNo', { defaultValue: 'Account No.' })}</Label>
                    <Input className="h-9 text-sm mt-1" value={form.bank_account_number} onChange={e => setForm({ ...form, bank_account_number: e.target.value })} />
                  </div>
                  {bankAccounts.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t('transactions.noBankAccountsSavedPrefix', { defaultValue: 'No bank accounts saved. Go to' })}{' '}
                      <a href="/settings" className="underline text-primary">{t('transactions.settingsLinkLabel', { defaultValue: 'Settings' })}</a>{' '}
                      {t('transactions.toAddBankAccountsSuffix', { defaultValue: 'to add bank accounts.' })}
                    </p>
                  )}
                </div>
              )}

              {payMethod === 'cheque' && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium">{t('transactions.chequeNumber', { defaultValue: 'Cheque Number' })}</Label>
                      <Input className="h-9 text-sm mt-1" value={form.cheque_number} onChange={e => setForm({ ...form, cheque_number: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">{t('transactions.chequeDate', { defaultValue: 'Cheque Date' })}</Label>
                      <Input type="date" className="h-9 text-sm mt-1" value={form.cheque_date} onChange={e => setForm({ ...form, cheque_date: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">{t('transactions.issueDate', { defaultValue: 'Issue Date' })}</Label>
                    <Input type="date" className="h-9 text-sm mt-1" value={form.cheque_issue_date} onChange={e => setForm({ ...form, cheque_issue_date: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">{t('transactions.bankName', { defaultValue: 'Bank Name' })}</Label>
                    <Input className="h-9 text-sm mt-1" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} />
                  </div>
                </div>
              )}

              {/* cash / credit: nothing extra */}
            </motion.div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNew(false)}>{t('transactions.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button
              onClick={createTransaction}
              disabled={!form.amount || !form.description || !form.party_name}
            >
              {t('transactions.save', { defaultValue: 'Save' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {browserAccount && <FloatingBankBrowser account={browserAccount} onClose={() => setBrowserAccount(null)} />}
    </div>
  );
}
