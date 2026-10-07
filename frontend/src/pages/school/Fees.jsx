import { useState, useEffect, useMemo, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, DollarSign, CheckCircle, Printer, Users, Sparkles, ChevronDown, ChevronRight, ChevronLeft, Receipt, Search, FileText, Send, ScanLine } from 'lucide-react';
import { feesApi, classesApi, schoolFinanceApi, inventoryApi, bankAccountApi } from '@/api';
import StudentFeeProfileTab from './fees/StudentFeeProfileTab';
import FeeHeadsTab from './fees/FeeHeadsTab';
import FeePackagesTab from './fees/FeePackagesTab';
import PendingProofsTab from './fees/PendingProofsTab';
import VerifyPaymentDialog from './fees/VerifyPaymentDialog';
import StudentCombobox from '@/components/shared/StudentCombobox';
import { getActiveCompanyId } from '@/lib/companyContext';
import { useRole } from '@/lib/useRole';
import { confirm } from '@/lib/confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { printFeeReceipt } from '@/lib/printFeeReceipt';
import { printFeeInvoice } from '@/lib/printFeeInvoice';
import { getTodayBS, NEPALI_MONTHS, formatBsYearMonth } from '@/lib/nepaliDate';

// ── Fee Structure Dialog ──────────────────────────────────────────────────────

function FeeStructureDialog({ open, onClose, initial, classes, companyId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, amount: initial.amount, frequency: initial.frequency, classId: initial.classId || '', feeHeadId: initial.feeHeadId || '' }
      : { name: '', amount: '', frequency: 'MONTHLY', classId: '', feeHeadId: '' }
  );
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [errors, setErrors] = useState({});

  const { data: feeHeads = [] } = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => schoolFinanceApi.listFeeHeads().then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (data) =>
      isEdit ? feesApi.updateStructure(initial.id, data) : feesApi.createStructure(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-structures'] });
      toast.success(isEdit ? t('fees.feeStructureUpdated', { defaultValue: 'Fee structure updated' }) : t('fees.feeStructureCreated', { defaultValue: 'Fee structure created' }));
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('fees.failedToSave', { defaultValue: 'Failed to save' })),
  });

  function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = t('fees.feeNameRequired', { defaultValue: 'Fee name is required' });
    if (!form.amount || isNaN(form.amount)) errs.amount = t('fees.validAmountRequired', { defaultValue: 'Valid amount required' });
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error(Object.values(errs)[0]);
      return;
    }
    setErrors({});
    save.mutate({ ...form, amount: parseFloat(form.amount), companyId });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('fees.editFee', { defaultValue: 'Edit Fee' }) : t('fees.addFeeStructure', { defaultValue: 'Add Fee Structure' })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t('fees.feeNameRequiredLabel', { defaultValue: 'Fee Name *' })}</Label>
            <Input placeholder={t('fees.feeNamePlaceholder', { defaultValue: 'e.g. Tuition Fee, Exam Fee, Bus Fee' })} value={form.name} onChange={e => { set('name', e.target.value); if (errors.name) setErrors(er => ({ ...er, name: undefined })); }} />
            {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{t('fees.feeHead', { defaultValue: 'Fee Head' })} <span className="text-muted-foreground">{t('fees.forReporting', { defaultValue: '(groups income reports)' })}</span></Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.feeHeadId}
              onChange={e => set('feeHeadId', e.target.value)}
            >
              <option value="">{t('fees.noHead', { defaultValue: '— None —' })}</option>
              {feeHeads.filter(h => h.isActive && h.type === 'GENERAL').map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('fees.amountNprLabel', { defaultValue: 'Amount (NPR) *' })}</Label>
            <Input type="number" placeholder="0.00" value={form.amount} onChange={e => { set('amount', e.target.value); if (errors.amount) setErrors(er => ({ ...er, amount: undefined })); }} />
            {errors.amount && <p className="text-xs text-red-600">{errors.amount}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{t('fees.frequency', { defaultValue: 'Frequency' })}</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.frequency}
              onChange={e => set('frequency', e.target.value)}
            >
              <option value="MONTHLY">{t('fees.monthly', { defaultValue: 'Monthly' })}</option>
              <option value="TERM">{t('fees.perTerm', { defaultValue: 'Per Term' })}</option>
              <option value="ANNUAL">{t('fees.annual', { defaultValue: 'Annual' })}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('fees.applicableClass', { defaultValue: 'Applicable Class' })} <span className="text-muted-foreground">{t('fees.leaveBlankForAll', { defaultValue: '(leave blank for all)' })}</span></Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.classId}
              onChange={e => set('classId', e.target.value)}
            >
              <option value="">{t('fees.allClasses', { defaultValue: 'All Classes' })}</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('fees.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? t('fees.saving', { defaultValue: 'Saving…' }) : isEdit ? t('fees.saveChanges', { defaultValue: 'Save Changes' }) : t('fees.addFee', { defaultValue: 'Add Fee' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Record Payment Dialog ─────────────────────────────────────────────────────

function PaymentDialog({ open, onClose, invoice }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [errors, setErrors] = useState({});

  // Every non-cash method names a specific configured account — which bank
  // account, or which of the school's own eSewa/Khalti wallets — so the
  // admin picks from what's actually set up in Settings instead of typing
  // free text, and that account's balance moves accurately.
  const showBankAccount = method === 'BANK' || method === 'ESEWA' || method === 'KHALTI';
  const requireBankAccount = showBankAccount;

  const { data: allAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => bankAccountApi.list().then(r => r.data),
    enabled: open && showBankAccount,
  });
  const bankAccounts = allAccounts.filter(b => b.paymentType === method);
  const accountLabel = method === 'ESEWA'
    ? t('fees.esewaNumber', { defaultValue: 'eSewa Number' })
    : method === 'KHALTI'
      ? t('fees.khaltiNumber', { defaultValue: 'Khalti Number' })
      : t('fees.bankAccount', { defaultValue: 'Bank Account' });

  const remaining = invoice ? Number(invoice.totalAmount) - Number(invoice.paidAmount) : 0;

  const pay = useMutation({
    mutationFn: (data) => feesApi.recordPayment(invoice.id, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['fee-invoices'] });
      qc.invalidateQueries({ queryKey: ['school-dashboard'] });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      const receiptNo = res?.data?.receiptNo;
      toast.success(receiptNo
        ? t('fees.paymentRecordedReceipt', { defaultValue: 'Payment recorded — Receipt {{receiptNo}}', receiptNo })
        : t('fees.paymentRecorded', { defaultValue: 'Payment recorded' }));
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('fees.failedToRecordPayment', { defaultValue: 'Failed to record payment' })),
  });

  function handleSubmit(e) {
    e.preventDefault();
    const amt = parseFloat(amount);
    const errs = {};
    if (!amt || amt <= 0) errs.amount = t('fees.enterValidPaymentAmount', { defaultValue: 'Enter a valid payment amount' });
    else if (amt > remaining) errs.amount = t('fees.cannotExceedRemaining', { defaultValue: 'Cannot exceed remaining amount: Rs. {{amount}}', amount: remaining.toFixed(2) });
    if (requireBankAccount && !bankAccountId) errs.bankAccountId = t('fees.selectBankAccount', { defaultValue: 'Select which bank account received this payment' });
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error(Object.values(errs)[0]);
      return;
    }
    setErrors({});
    pay.mutate({ amount: amt, method, notes, bankAccountId: showBankAccount ? (bankAccountId || undefined) : undefined });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('fees.recordPayment', { defaultValue: 'Record Payment' })}</DialogTitle>
        </DialogHeader>
        {invoice && (
          <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
            <p><span className="text-muted-foreground">{t('fees.studentColon', { defaultValue: 'Student:' })}</span> <strong>{invoice.student?.name}</strong></p>
            <p><span className="text-muted-foreground">{t('fees.monthColon', { defaultValue: 'Month:' })}</span> {formatBsYearMonth(invoice.month)}</p>
            <p><span className="text-muted-foreground">{t('fees.totalColon', { defaultValue: 'Total:' })}</span> Rs. {Number(invoice.totalAmount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</p>
            <p><span className="text-muted-foreground">{t('fees.paidColon', { defaultValue: 'Paid:' })}</span> Rs. {Number(invoice.paidAmount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</p>
            <p className="font-semibold text-amber-700"><span className="text-muted-foreground font-normal">{t('fees.remainingColon', { defaultValue: 'Remaining:' })}</span> Rs. {remaining.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('fees.paymentAmountNprLabel', { defaultValue: 'Payment Amount (NPR) *' })}</Label>
            <Input
              type="number"
              placeholder={t('fees.maxPlaceholder', { defaultValue: 'Max: {{amount}}', amount: remaining.toFixed(2) })}
              value={amount}
              onChange={e => { setAmount(e.target.value); if (errors.amount) setErrors(er => ({ ...er, amount: undefined })); }}
            />
            {errors.amount && <p className="text-xs text-red-600">{errors.amount}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{t('fees.paymentMethod', { defaultValue: 'Payment Method' })}</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={method} onChange={e => { setMethod(e.target.value); setBankAccountId(''); }}>
              <option value="CASH">{t('fees.methodCash', { defaultValue: 'Cash' })}</option>
              <option value="BANK">{t('fees.methodBank', { defaultValue: 'Bank Transfer / Cheque' })}</option>
              <option value="ESEWA">eSewa</option>
              <option value="KHALTI">Khalti</option>
            </select>
          </div>
          {showBankAccount && (
            <div className="space-y-1.5">
              <Label>{accountLabel} *</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={bankAccountId} onChange={e => { setBankAccountId(e.target.value); if (errors.bankAccountId) setErrors(er => ({ ...er, bankAccountId: undefined })); }}>
                <option value="">{t('fees.chooseAccountOf', { defaultValue: 'Choose {{account}}…', account: accountLabel })}</option>
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>{b.bankName} — {b.accountNumber}</option>
                ))}
              </select>
              {errors.bankAccountId && <p className="text-xs text-red-600">{errors.bankAccountId}</p>}
              {bankAccounts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('fees.noAccountsOfTypeHint', { defaultValue: 'No {{account}} set up yet — add one in Settings → Payment QR Codes.', account: accountLabel })}
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{t('fees.notes', { defaultValue: 'Notes' })}</Label>
            <Input
              placeholder={
                method === 'ESEWA' || method === 'KHALTI'
                  ? t('fees.notesPlaceholderWallet', { defaultValue: 'Payer phone number / transaction ID…' })
                  : t('fees.notesPlaceholder', { defaultValue: 'Cheque no. / reference…' })
              }
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('fees.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={pay.isPending}>
              {pay.isPending ? t('fees.recording', { defaultValue: 'Recording…' }) : t('fees.recordPayment', { defaultValue: 'Record Payment' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Billing Run Dialog ────────────────────────────────────────────────────────
// Generates line-itemed invoices from every student's fee profile
// (class fees + bus/hostel auto-fees + package + scholarships).

function BillingRunDialog({ open, onClose, classes, invoiceDate }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState({ classId: '', dueDate: '' });
  const [result, setResult] = useState(null);

  const run = useMutation({
    mutationFn: () => schoolFinanceApi.billingRun({
      classId: form.classId || undefined,
      dueDate: form.dueDate || undefined,
      invoiceDate: invoiceDate || undefined,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['fee-invoices'] });
      qc.invalidateQueries({ queryKey: ['school-dashboard'] });
      setResult(res.data);
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('fees.failedToGenerateInvoices', { defaultValue: 'Failed to generate invoices' })),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    run.mutate();
  };

  const handleClose = () => { setResult(null); onClose(); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {result.created > 0
                  ? t('fees.billingRunDone', { defaultValue: 'Billing Run Complete' })
                  : t('fees.alreadyGeneratedTitle', { defaultValue: 'Already Generated' })}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {result.created > 0
                ? t('fees.billingRunResult', {
                    defaultValue: '{{created}} invoices created · {{skippedExisting}} already billed · {{skippedEmpty}} with no fees',
                    created: result.created, skippedExisting: result.skippedExisting, skippedEmpty: result.skippedEmpty,
                  })
                : t('fees.alreadyGeneratedBody', {
                    defaultValue: 'Every student in this selection already has an invoice for this month ({{skippedExisting}} skipped). Nothing new was created.',
                    skippedExisting: result.skippedExisting,
                  })}
            </p>
            <DialogFooter>
              <Button onClick={handleClose}>{t('fees.ok', { defaultValue: 'OK' })}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('fees.billingRun', { defaultValue: 'Monthly Billing Run' })}</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground -mt-1">
              {t('fees.billingRunHint', { defaultValue: 'Creates one itemized invoice per student from their fee profile — class fees, bus & hostel (auto-detected), package and scholarships. Students already billed for this month are skipped. Uses the Invoice Date set on the Fee Invoices page to determine the billing month.' })}
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('fees.classOptional', { defaultValue: 'Class (optional — blank = whole school)' })}</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.classId} onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}>
                  <option value="">{t('fees.allClasses', { defaultValue: 'All Classes' })}</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('fees.dueDateOptional', { defaultValue: 'Due Date (optional, default +10 days)' })}</Label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>{t('fees.cancel', { defaultValue: 'Cancel' })}</Button>
                <Button type="submit" disabled={run.isPending}>
                  {run.isPending ? t('fees.generating', { defaultValue: 'Generating…' }) : t('fees.runBilling', { defaultValue: 'Run Billing' })}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── New Invoice Dialog ────────────────────────────────────────────────────────

let rowSeq = 0;
const newFeeRow = () => ({ key: ++rowSeq, kind: 'FEE', description: '', amount: '', feeHeadId: '' });
const newItemRow = () => ({ key: ++rowSeq, kind: 'ITEM', inventoryItemId: '', quantity: '1', description: '' });

function NewInvoiceDialog({ open, onClose, companyId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [studentId, setStudentId] = useState('');
  const todayBs = getTodayBS();
  const [bsYear, setBsYear] = useState(String(todayBs.year));
  const [bsMonth, setBsMonth] = useState(String(todayBs.month));
  const month = bsYear && bsMonth ? `${bsYear}-${String(bsMonth).padStart(2, '0')}` : '';
  const [invoiceDate, setInvoiceDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [rows, setRows] = useState([newFeeRow()]);
  const [errors, setErrors] = useState({});

  const { data: feeHeads = [] } = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => schoolFinanceApi.listFeeHeads().then(r => r.data),
    enabled: open,
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventory-items', companyId],
    queryFn: () => inventoryApi.list().then(r => r.data),
    enabled: open,
  });

  const updateRow = (key, patch) => setRows(rs => rs.map(r => r.key === key ? { ...r, ...patch } : r));
  const removeRow = (key) => setRows(rs => rs.length > 1 ? rs.filter(r => r.key !== key) : rs);

  const rowAmount = (row) => {
    if (row.kind === 'FEE') return parseFloat(row.amount) || 0;
    const item = inventoryItems.find(i => i.id === row.inventoryItemId);
    return item ? (parseFloat(row.quantity) || 0) * Number(item.unitSellingPrice || 0) : 0;
  };
  const total = rows.reduce((sum, r) => sum + rowAmount(r), 0);

  const save = useMutation({
    mutationFn: (data) => feesApi.createInvoice(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-invoices'] });
      qc.invalidateQueries({ queryKey: ['school-dashboard'] });
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      toast.success(t('fees.invoiceCreated', { defaultValue: 'Invoice created' }));
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('fees.failedToCreateInvoice', { defaultValue: 'Failed to create invoice' })),
  });

  function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!studentId) errs.studentId = t('fees.selectAStudent', { defaultValue: 'Select a student' });
    if (!/^\d{4}$/.test(bsYear)) errs.month = t('fees.validYearRequired', { defaultValue: 'Enter a valid BS year' });
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error(Object.values(errs)[0]);
      return;
    }
    setErrors({});
    for (const r of rows) {
      if (r.kind === 'ITEM' && !r.inventoryItemId) { toast.error(t('fees.selectAnItem', { defaultValue: 'Select an item for every item row' })); return; }
      if (r.kind === 'FEE' && !r.description.trim()) { toast.error(t('fees.descriptionRequiredForFeeRow', { defaultValue: 'Description is required for every fee row' })); return; }
    }
    if (total <= 0) { toast.error(t('fees.validAmountRequired', { defaultValue: 'Valid amount required' })); return; }

    const items = rows.map(r => {
      if (r.kind === 'ITEM') {
        const item = inventoryItems.find(i => i.id === r.inventoryItemId);
        return {
          inventoryItemId: r.inventoryItemId,
          quantity: parseFloat(r.quantity) || 0,
          description: r.description.trim() || item?.itemName || 'Item',
          amount: rowAmount(r),
        };
      }
      return { description: r.description.trim(), amount: parseFloat(r.amount) || 0, feeHeadId: r.feeHeadId || undefined };
    });

    save.mutate({ studentId, month, invoiceDate, items, companyId });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t('fees.createFeeInvoice', { defaultValue: 'Create Fee Invoice' })}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t('fees.studentRequiredLabel', { defaultValue: 'Student *' })}</Label>
            <StudentCombobox
              value={studentId}
              onChange={v => { setStudentId(v); if (errors.studentId) setErrors(er => ({ ...er, studentId: undefined })); }}
              placeholder={t('fees.selectStudent', { defaultValue: 'Select student…' })}
            />
            {errors.studentId && <p className="text-xs text-red-600">{errors.studentId}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{t('fees.monthPeriodLabel', { defaultValue: 'Billing Month (BS) *' })}</Label>
            <div className="flex gap-2">
              <select
                className="w-1/2 border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={bsMonth}
                onChange={e => { setBsMonth(e.target.value); if (errors.month) setErrors(er => ({ ...er, month: undefined })); }}
              >
                {NEPALI_MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
              </select>
              <Input
                type="number"
                className="w-1/2"
                placeholder={t('fees.bsYear', { defaultValue: 'BS Year' })}
                value={bsYear}
                onChange={e => { setBsYear(e.target.value); if (errors.month) setErrors(er => ({ ...er, month: undefined })); }}
              />
            </div>
            {errors.month && <p className="text-xs text-red-600">{errors.month}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{t('fees.invoiceDate', { defaultValue: 'Invoice Date' })}</Label>
            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" />
          </div>

          <div className="space-y-2">
            <Label>{t('fees.charges', { defaultValue: 'Charges' })}</Label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {rows.map(row => (
                <div key={row.key} className="flex items-start gap-2 border rounded-md p-2">
                  {row.kind === 'FEE' ? (
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input placeholder={t('fees.descriptionPlaceholder', { defaultValue: 'e.g. Tuition fee' })} value={row.description} onChange={e => updateRow(row.key, { description: e.target.value })} className="col-span-2 h-8 text-sm" />
                      <select className="h-8 text-sm border rounded-md px-2 bg-background" value={row.feeHeadId} onChange={e => updateRow(row.key, { feeHeadId: e.target.value })}>
                        <option value="">{t('fees.noHead', { defaultValue: '— None —' })}</option>
                        {feeHeads.filter(h => h.isActive).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                      </select>
                      <Input type="number" placeholder="0.00" value={row.amount} onChange={e => updateRow(row.key, { amount: e.target.value })} className="h-8 text-sm" />
                    </div>
                  ) : (
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <select className="col-span-2 h-8 text-sm border rounded-md px-2 bg-background" value={row.inventoryItemId} onChange={e => updateRow(row.key, { inventoryItemId: e.target.value })}>
                        <option value="">{t('fees.selectItemEllipsis', { defaultValue: 'Select item…' })}</option>
                        {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.itemName} (Rs. {Number(i.unitSellingPrice || 0).toLocaleString()}, {Number(i.quantity)} {i.unit} left)</option>)}
                      </select>
                      <Input type="number" min="1" placeholder={t('fees.qty', { defaultValue: 'Qty' })} value={row.quantity} onChange={e => updateRow(row.key, { quantity: e.target.value })} className="h-8 text-sm" />
                      <div className="col-span-3 text-xs text-muted-foreground text-right">
                        Rs. {rowAmount(row).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}
                  <button type="button" onClick={() => removeRow(row.key)} className="p-1.5 mt-0.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRows(rs => [...rs, newFeeRow()])}>
                <Plus className="w-3.5 h-3.5 mr-1" /> {t('fees.addFeeRow', { defaultValue: 'Add Fee' })}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setRows(rs => [...rs, newItemRow()])}>
                <Plus className="w-3.5 h-3.5 mr-1" /> {t('fees.addItemRow', { defaultValue: 'Add Item' })}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-3 text-sm font-medium">
            <span>{t('fees.total', { defaultValue: 'Total' })}</span>
            <span className="tabular-nums">Rs. {total.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('fees.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('fees.creating', { defaultValue: 'Creating…' }) : t('fees.createInvoice', { defaultValue: 'Create Invoice' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const STATUS_BADGE = {
  PAID:    'bg-emerald-100 text-emerald-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-red-100 text-red-700',
  WAIVED:  'bg-muted text-muted-foreground',
};

const INVOICE_PAGE_SIZE = 50;

export default function Fees() {
  const { t } = useTranslation();
  const companyId = getActiveCompanyId();
  const { canDelete, isAdmin, isAccountant } = useRole();
  const canVerifyPayments = isAdmin || isAccountant;
  const qc = useQueryClient();
  const [tab, setTab] = useState('invoices');
  const [filterStatus, setFilterStatus] = useState('');
  const [invoiceSearchInput, setInvoiceSearchInput] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoicePage, setInvoicePage] = useState(1);
  const [structureDialog, setStructureDialog] = useState(null);
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [bulkDialog, setBulkDialog] = useState(false);
  const [payDialog, setPayDialog] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [invoiceDate, setInvoiceDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [verifyDialog, setVerifyDialog] = useState(false);

  const { data: pendingProofs = [] } = useQuery({
    queryKey: ['fee-payments-pending'],
    queryFn: () => feesApi.listPendingProofs().then(r => r.data),
    enabled: !!companyId && canVerifyPayments,
  });

  useEffect(() => {
    const timer = setTimeout(() => setInvoiceSearch(invoiceSearchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [invoiceSearchInput]);

  useEffect(() => { setInvoicePage(1); }, [filterStatus, invoiceSearch]);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes', companyId],
    queryFn: () => classesApi.list().then(r => r.data),
    enabled: !!companyId,
  });

  const { data: structures = [], isLoading: loadingStructures } = useQuery({
    queryKey: ['fee-structures', companyId],
    queryFn: () => feesApi.listStructures().then(r => r.data),
    enabled: !!companyId && tab === 'structures',
  });

  const { data: invoicesPageData, isLoading: loadingInvoices, isPlaceholderData: invoicesLoadingMore } = useQuery({
    queryKey: ['fee-invoices', companyId, filterStatus, invoiceSearch, invoicePage],
    queryFn: () => feesApi.listInvoices({
      ...(filterStatus ? { status: filterStatus } : {}),
      ...(invoiceSearch ? { search: invoiceSearch } : {}),
      page: invoicePage,
      pageSize: INVOICE_PAGE_SIZE,
    }).then(r => r.data),
    enabled: !!companyId && tab === 'invoices',
    placeholderData: (prev) => prev,
  });

  const invoices = invoicesPageData?.data ?? [];
  const invoicesTotal = invoicesPageData?.total ?? 0;
  const invoiceTotalPages = Math.max(1, Math.ceil(invoicesTotal / INVOICE_PAGE_SIZE));

  // Visual grouping only — one row per student on this page, expandable to
  // each month's invoice underneath. The invoices themselves stay separate
  // records (billing, receipts, ledger postings are all unchanged).
  const studentGroups = useMemo(() => {
    const map = new Map();
    for (const inv of invoices) {
      const key = inv.studentId;
      if (!map.has(key)) map.set(key, { studentId: key, student: inv.student, invoices: [] });
      map.get(key).invoices.push(inv);
    }
    return Array.from(map.values());
  }, [invoices]);

  const removeStructure = useMutation({
    mutationFn: (id) => feesApi.removeStructure(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-structures'] }); toast.success(t('fees.feeDeleted', { defaultValue: 'Fee deleted' })); },
    onError: (err) => toast.error(err?.response?.data?.message || t('fees.failedToDelete', { defaultValue: 'Failed to delete' })),
  });

  const releaseOne = useMutation({
    mutationFn: (id) => feesApi.release(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-invoices'] }); toast.success(t('fees.invoiceReleased', { defaultValue: 'Invoice released to student portal' })); },
    onError: (err) => toast.error(err?.response?.data?.message || t('fees.failedToRelease', { defaultValue: 'Failed to release invoice' })),
  });

  const [releaseResult, setReleaseResult] = useState(null);
  const releaseBulk = useMutation({
    mutationFn: () => feesApi.releaseBulk(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['fee-invoices'] });
      setReleaseResult(res.data.released ?? 0);
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('fees.failedToRelease', { defaultValue: 'Failed to release invoice' })),
  });

  const classLabel = (id) => {
    const c = classes.find(c => c.id === id);
    return c ? `${c.name}${c.section ? ` (${c.section})` : ''}` : t('fees.allClasses', { defaultValue: 'All Classes' });
  };

  const FREQ = { MONTHLY: t('fees.monthly', { defaultValue: 'Monthly' }), TERM: t('fees.perTerm', { defaultValue: 'Per Term' }), ANNUAL: t('fees.annual', { defaultValue: 'Annual' }) };
  const STATUS_LABEL = {
    PAID: t('fees.paid', { defaultValue: 'Paid' }),
    PARTIAL: t('fees.partial', { defaultValue: 'Partial' }),
    PENDING: t('fees.pending', { defaultValue: 'Pending' }),
    WAIVED: t('fees.waived', { defaultValue: 'Waived' }),
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('fees.feeManagement', { defaultValue: 'Fee Management' })}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('fees.feeManagementSubtitle', { defaultValue: 'Fee structures and student invoices' })}</p>
        </div>
        <div className="flex gap-2">
          {canVerifyPayments && (
            <Button variant="outline" onClick={() => setVerifyDialog(true)} className="self-end">
              <ScanLine className="w-4 h-4 mr-2" /> {t('fees.scanReceiptQr', { defaultValue: 'Scan Receipt QR' })}
            </Button>
          )}
          {tab === 'structures' && (
            <Button onClick={() => setStructureDialog({ mode: 'add' })}>
              <Plus className="w-4 h-4 mr-2" /> {t('fees.addFee', { defaultValue: 'Add Fee' })}
            </Button>
          )}
          {tab === 'invoices' && (
            <>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">{t('fees.invoiceDate', { defaultValue: 'Invoice Date' })}</Label>
                <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" />
              </div>
              {canVerifyPayments && (
                <Button variant="outline" onClick={() => releaseBulk.mutate()} disabled={releaseBulk.isPending} className="self-end">
                  <Send className="w-4 h-4 mr-2" /> {t('fees.releaseInvoices', { defaultValue: 'Release Invoices' })}
                </Button>
              )}
              {canVerifyPayments && (
                <Button variant="outline" onClick={() => setBulkDialog(true)} className="self-end">
                  <Users className="w-4 h-4 mr-2" /> {t('fees.billingRun', { defaultValue: 'Monthly Billing Run' })}
                </Button>
              )}
              <Button onClick={() => setInvoiceDialog(true)} className="self-end">
                <Plus className="w-4 h-4 mr-2" /> {t('fees.newInvoice', { defaultValue: 'New Invoice' })}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit flex-wrap">
        {[
          { id: 'invoices', label: t('fees.feeInvoices', { defaultValue: 'Fee Invoices' }) },
          ...(canVerifyPayments ? [{ id: 'pendingProofs', label: t('fees.pendingProofs', { defaultValue: 'Pending Proofs' }), count: pendingProofs.length }] : []),
          { id: 'profile', label: t('fees.studentFees', { defaultValue: 'Student Fees' }) },
          { id: 'structures', label: t('fees.feeStructures', { defaultValue: 'Fee Structures' }) },
          { id: 'heads', label: t('fees.feeHeads', { defaultValue: 'Fee Heads' }) },
          { id: 'packages', label: t('fees.packages', { defaultValue: 'Packages' }) },
        ].map(tb => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${tab === tb.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {tb.label}
            {!!tb.count && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {tb.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'pendingProofs' && canVerifyPayments && <PendingProofsTab />}
      {tab === 'profile' && <StudentFeeProfileTab />}
      {tab === 'heads' && <FeeHeadsTab />}
      {tab === 'packages' && <FeePackagesTab />}
      <VerifyPaymentDialog open={verifyDialog} onClose={() => setVerifyDialog(false)} />

      <Dialog open={releaseResult !== null} onOpenChange={() => setReleaseResult(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {releaseResult > 0
                ? t('fees.invoicesReleasedTitle', { defaultValue: 'Invoices Released' })
                : t('fees.alreadyReleasedTitle', { defaultValue: 'Already Released' })}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {releaseResult > 0
              ? t('fees.invoicesReleased', { defaultValue: '{{count}} invoice(s) released to student portal', count: releaseResult })
              : t('fees.alreadyReleasedBody', { defaultValue: 'Every invoice has already been released to the student portal. Nothing new to release.' })}
          </p>
          <DialogFooter>
            <Button onClick={() => setReleaseResult(null)}>{t('fees.ok', { defaultValue: 'OK' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoices Tab */}
      {tab === 'invoices' && (
        <>
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={t('fees.searchByStudent', { defaultValue: 'Search by student name or roll number…' })}
                value={invoiceSearchInput}
                onChange={e => setInvoiceSearchInput(e.target.value)}
              />
            </div>
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">{t('fees.allStatus', { defaultValue: 'All Status' })}</option>
              <option value="PENDING">{t('fees.pending', { defaultValue: 'Pending' })}</option>
              <option value="PARTIAL">{t('fees.partial', { defaultValue: 'Partial' })}</option>
              <option value="PAID">{t('fees.paid', { defaultValue: 'Paid' })}</option>
              <option value="WAIVED">{t('fees.waived', { defaultValue: 'Waived' })}</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-border overflow-hidden">
            {loadingInvoices ? (
              <div className="p-12 text-center text-muted-foreground text-sm">{t('fees.loadingInvoices', { defaultValue: 'Loading invoices…' })}</div>
            ) : invoices.length === 0 ? (
              <div className="p-12 text-center">
                <DollarSign className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">{t('fees.noInvoicesFound', { defaultValue: 'No invoices found' })}</p>
                <Button className="mt-4" size="sm" onClick={() => setInvoiceDialog(true)}>{t('fees.createFirstInvoice', { defaultValue: 'Create First Invoice' })}</Button>
              </div>
            ) : (
              <div className={`overflow-x-auto ${invoicesLoadingMore ? 'opacity-60 transition-opacity' : ''}`}>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('fees.student', { defaultValue: 'Student' })}</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('fees.month', { defaultValue: 'Month' })}</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('fees.invoiceDate', { defaultValue: 'Invoice Date' })}</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('fees.total', { defaultValue: 'Total' })}</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('fees.paid', { defaultValue: 'Paid' })}</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('fees.due', { defaultValue: 'Due' })}</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('fees.status', { defaultValue: 'Status' })}</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {studentGroups.map(group => {
                      const isStudentExpanded = expandedStudentId === group.studentId;
                      const groupTotal = group.invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
                      const groupPaid = group.invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
                      const groupDue = groupTotal - groupPaid;
                      const statusCounts = group.invoices.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {});
                      return (
                      <Fragment key={group.studentId}>
                        <tr className="hover:bg-muted/30 cursor-pointer bg-muted/10" onClick={() => setExpandedStudentId(isStudentExpanded ? null : group.studentId)}>
                          <td className="px-5 py-3 font-semibold">
                            <span className="inline-flex items-center gap-1.5">
                              {isStudentExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                              {group.student?.name ?? '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {t('fees.invoiceCount', { defaultValue: '{{count}} invoice(s)', count: group.invoices.length })}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">—</td>
                          <td className="px-5 py-3 text-right tabular-nums font-semibold">Rs. {groupTotal.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-emerald-700 font-semibold">Rs. {groupPaid.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-amber-700 font-semibold">Rs. {groupDue.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(statusCounts).map(([st, count]) => (
                                <span key={st} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[st] || ''}`}>
                                  {count} {STATUS_LABEL[st] || st}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-3" />
                        </tr>
                        {isStudentExpanded && group.invoices.map(inv => {
                      const due = Number(inv.totalAmount) - Number(inv.paidAmount);
                      const isExpanded = expandedId === inv.id;
                      return (
                        <Fragment key={inv.id}>
                        <tr className="hover:bg-muted/20 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : inv.id)}>
                          <td className="px-5 py-3 font-medium pl-9 text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                              {inv.invoiceNo || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-foreground font-medium">{formatBsYearMonth(inv.month)}</td>
                          <td className="px-5 py-3 text-muted-foreground">{inv.invoiceDate ? format(new Date(inv.invoiceDate), 'dd MMM yyyy') : '—'}</td>
                          <td className="px-5 py-3 text-right tabular-nums">Rs. {Number(inv.totalAmount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-emerald-700">Rs. {Number(inv.paidAmount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-amber-700">Rs. {due.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-3">
                            <div className="flex flex-col items-start gap-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inv.status] || ''}`}>
                                {STATUS_LABEL[inv.status] || inv.status}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${inv.releasedAt ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                {inv.releasedAt ? t('fees.released', { defaultValue: 'Released' }) : t('fees.notReleased', { defaultValue: 'Not Released' })}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-1 flex-wrap">
                              {!inv.releasedAt && canVerifyPayments && (
                                <Button size="sm" variant="outline" className="text-blue-600 hover:bg-blue-50" disabled={releaseOne.isPending} onClick={() => releaseOne.mutate(inv.id)} title={t('fees.release', { defaultValue: 'Release to student portal' })}>
                                  <Send className="w-3.5 h-3.5 mr-1" /> {t('fees.release', { defaultValue: 'Release' })}
                                </Button>
                              )}
                              {inv.status !== 'PAID' && inv.status !== 'WAIVED' && (
                                <Button size="sm" variant="outline" onClick={() => setPayDialog(inv)}>
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> {t('fees.pay', { defaultValue: 'Pay' })}
                                </Button>
                              )}
                              {inv.status !== 'PAID' && inv.status !== 'WAIVED' && (
                                <Button size="sm" variant="ghost" className="text-violet-600 hover:bg-violet-50" onClick={async () => {
                                  try {
                                    await feesApi.sendFeeReminderSms(inv.id);
                                    toast.success(t('fees.smsReminderSent', { defaultValue: 'SMS reminder sent to guardian' }));
                                  } catch (e) {
                                    toast.error(e?.response?.data?.message || t('fees.smsFailed', { defaultValue: 'SMS failed — check SMS_API_KEY' }));
                                  }
                                }} title={t('fees.sendSmsReminder', { defaultValue: 'Send SMS Reminder' })}>
                                  <Sparkles className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => {
                                feesApi.receipt(inv.id).then(r => printFeeInvoice(r.data)).catch(() => toast.error(t('fees.couldNotLoadInvoice', { defaultValue: 'Could not load invoice' })));
                              }} title={t('fees.printInvoice', { defaultValue: 'Print Invoice' })}>
                                <FileText className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => {
                                feesApi.receipt(inv.id).then(r => printFeeReceipt(r.data)).catch(() => toast.error(t('fees.couldNotLoadReceipt', { defaultValue: 'Could not load receipt' })));
                              }} title={t('fees.printReceipt', { defaultValue: 'Print Receipt' })}>
                                <Printer className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-muted/20">
                            <td colSpan={8} className="px-6 py-5">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-background rounded-xl border border-border shadow-sm overflow-hidden">
                                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
                                    <FileText className="w-3.5 h-3.5 text-primary" />
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                      {t('fees.lineItems', { defaultValue: 'What this invoice covers' })}
                                    </p>
                                  </div>
                                  <div className="p-4">
                                    {(inv.items ?? []).length === 0 ? (
                                      <p className="text-sm text-muted-foreground">{inv.description || '—'}</p>
                                    ) : (
                                      <div className="divide-y divide-border/60">
                                        {inv.items.map(item => (
                                          <div key={item.id} className="flex justify-between items-center text-sm py-2 first:pt-0 last:pb-0">
                                            <span>
                                              {item.description}
                                              {item.feeHead ? <span className="text-xs text-muted-foreground ml-1">· {item.feeHead.name}</span> : null}
                                              {item.inventoryItem ? <span className="text-xs text-muted-foreground ml-1">· {item.quantity} {item.inventoryItem.unit}</span> : null}
                                            </span>
                                            <span className={`tabular-nums font-medium ${Number(item.amount) < 0 ? 'text-emerald-600' : ''}`}>
                                              {Number(item.amount) < 0 ? '− ' : ''}Rs. {Math.abs(Number(item.amount)).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="bg-background rounded-xl border border-border shadow-sm overflow-hidden">
                                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
                                    <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                      {t('fees.paymentHistory', { defaultValue: 'Payment history' })}
                                    </p>
                                  </div>
                                  <div className="p-4">
                                    {(inv.payments ?? []).length === 0 ? (
                                      <p className="text-sm text-muted-foreground">{t('fees.noPaymentsYet', { defaultValue: 'No payments yet' })}</p>
                                    ) : (
                                      <div className="divide-y divide-border/60">
                                        {inv.payments.map(p => (
                                          <div key={p.id} className="flex justify-between items-center text-sm py-2 first:pt-0 last:pb-0">
                                            <span className="inline-flex items-center gap-1.5">
                                              <span className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                                                <Receipt className="w-3 h-3 text-emerald-600" />
                                              </span>
                                              <span className="flex flex-col">
                                                <span className="font-mono text-xs">{p.receiptNo}</span>
                                                <span className="text-xs text-muted-foreground">{p.method} · {format(new Date(p.paidAt), 'dd MMM yyyy')}</span>
                                              </span>
                                            </span>
                                            <span className="flex items-center gap-2">
                                              <span className="tabular-nums font-medium text-emerald-700">Rs. {Number(p.amount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span>
                                              <button
                                                onClick={() => {
                                                  feesApi.receipt(inv.id).then(r => {
                                                    const fullPayment = r.data.payments.find(x => x.id === p.id) || p;
                                                    printFeeReceipt(r.data, fullPayment);
                                                  }).catch(() => toast.error(t('fees.couldNotLoadReceipt', { defaultValue: 'Could not load receipt' })));
                                                }}
                                                title={t('fees.printThisReceipt', { defaultValue: 'Print this receipt' })}
                                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                              >
                                                <Printer className="w-3.5 h-3.5" />
                                              </button>
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                        })}
                      </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {invoiceTotalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
                <span className="text-muted-foreground">
                  {t('fees.pageInfo', {
                    defaultValue: 'Page {{page}} of {{totalPages}} · {{total}} invoices',
                    page: invoicePage, totalPages: invoiceTotalPages, total: invoicesTotal,
                  })}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={invoicePage <= 1} onClick={() => setInvoicePage(p => Math.max(1, p - 1))}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> {t('fees.prevPage', { defaultValue: 'Previous' })}
                  </Button>
                  <Button variant="outline" size="sm" disabled={invoicePage >= invoiceTotalPages} onClick={() => setInvoicePage(p => Math.min(invoiceTotalPages, p + 1))}>
                    {t('fees.nextPage', { defaultValue: 'Next' })} <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Structures Tab */}
      {tab === 'structures' && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {loadingStructures ? (
            <div className="p-12 text-center text-muted-foreground text-sm">{t('fees.loading', { defaultValue: 'Loading…' })}</div>
          ) : structures.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t('fees.noFeeStructuresYet', { defaultValue: 'No fee structures yet' })}</p>
              <Button className="mt-4" size="sm" onClick={() => setStructureDialog({ mode: 'add' })}>{t('fees.addFirstFee', { defaultValue: 'Add First Fee' })}</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('fees.feeName', { defaultValue: 'Fee Name' })}</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('fees.class', { defaultValue: 'Class' })}</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('fees.amount', { defaultValue: 'Amount' })}</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('fees.frequency', { defaultValue: 'Frequency' })}</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {structures.map(s => (
                    <tr key={s.id} className="hover:bg-muted/20">
                      <td className="px-5 py-3 font-medium">{s.name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{classLabel(s.classId)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">Rs. {Number(s.amount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                      <td className="px-5 py-3 text-muted-foreground">{FREQ[s.frequency]}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setStructureDialog({ mode: 'edit', structure: s })} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {canDelete && (
                            <button onClick={async () => {
                              const ok = await confirm({ description: t('fees.deleteConfirm', { defaultValue: 'Delete "{{name}}"?', name: s.name }), variant: 'destructive' });
                              if (!ok) return;
                              removeStructure.mutate(s.id);
                            }} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {bulkDialog && (
        <BillingRunDialog
          open={bulkDialog}
          onClose={() => setBulkDialog(false)}
          classes={classes}
          invoiceDate={invoiceDate}
        />
      )}
      {structureDialog && (
        <FeeStructureDialog
          open={!!structureDialog}
          onClose={() => setStructureDialog(null)}
          initial={structureDialog.mode === 'edit' ? structureDialog.structure : null}
          classes={classes}
          companyId={companyId}
        />
      )}
      {invoiceDialog && (
        <NewInvoiceDialog
          open={invoiceDialog}
          onClose={() => setInvoiceDialog(false)}
          companyId={companyId}
        />
      )}
      {payDialog && (
        <PaymentDialog
          open={!!payDialog}
          onClose={() => setPayDialog(null)}
          invoice={payDialog}
        />
      )}
    </div>
  );
}
