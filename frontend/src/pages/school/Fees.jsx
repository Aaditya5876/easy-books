import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, DollarSign, CheckCircle, Printer, Users, Sparkles, ChevronDown, ChevronRight, ChevronLeft, Receipt, Search } from 'lucide-react';
import { feesApi, classesApi, aiApi, schoolFinanceApi } from '@/api';
import StudentFeeProfileTab from './fees/StudentFeeProfileTab';
import FeeHeadsTab from './fees/FeeHeadsTab';
import FeePackagesTab from './fees/FeePackagesTab';
import StudentCombobox from '@/components/shared/StudentCombobox';
import { getActiveCompanyId } from '@/lib/companyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

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
    if (!form.name.trim()) { toast.error(t('fees.feeNameRequired', { defaultValue: 'Fee name is required' })); return; }
    if (!form.amount || isNaN(form.amount)) { toast.error(t('fees.validAmountRequired', { defaultValue: 'Valid amount required' })); return; }
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
            <Input placeholder={t('fees.feeNamePlaceholder', { defaultValue: 'e.g. Tuition Fee, Exam Fee, Bus Fee' })} value={form.name} onChange={e => set('name', e.target.value)} />
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
            <Input type="number" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} />
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

  const remaining = invoice ? Number(invoice.totalAmount) - Number(invoice.paidAmount) : 0;

  const pay = useMutation({
    mutationFn: (data) => feesApi.recordPayment(invoice.id, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['fee-invoices'] });
      qc.invalidateQueries({ queryKey: ['school-dashboard'] });
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
    if (!amt || amt <= 0) { toast.error(t('fees.enterValidPaymentAmount', { defaultValue: 'Enter a valid payment amount' })); return; }
    if (amt > remaining) { toast.error(t('fees.cannotExceedRemaining', { defaultValue: 'Cannot exceed remaining amount: Rs. {{amount}}', amount: remaining.toFixed(2) })); return; }
    pay.mutate({ amount: amt, method, notes });
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
            <p><span className="text-muted-foreground">{t('fees.monthColon', { defaultValue: 'Month:' })}</span> {invoice.month}</p>
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
              onChange={e => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fees.paymentMethod', { defaultValue: 'Payment Method' })}</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={method} onChange={e => setMethod(e.target.value)}>
              <option value="CASH">{t('fees.methodCash', { defaultValue: 'Cash' })}</option>
              <option value="BANK">{t('fees.methodBank', { defaultValue: 'Bank Transfer / Cheque' })}</option>
              <option value="ESEWA">eSewa</option>
              <option value="KHALTI">Khalti</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('fees.notes', { defaultValue: 'Notes' })}</Label>
            <Input placeholder={t('fees.notesPlaceholder', { defaultValue: 'Cheque no. / reference…' })} value={notes} onChange={e => setNotes(e.target.value)} />
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

function BillingRunDialog({ open, onClose, classes }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState({ month: '', classId: '', dueDate: '' });

  const run = useMutation({
    mutationFn: () => schoolFinanceApi.billingRun({
      month: form.month.trim(),
      classId: form.classId || undefined,
      dueDate: form.dueDate || undefined,
    }),
    onSuccess: (res) => {
      const { created, skippedExisting, skippedEmpty } = res.data;
      qc.invalidateQueries({ queryKey: ['fee-invoices'] });
      qc.invalidateQueries({ queryKey: ['school-dashboard'] });
      toast.success(t('fees.billingRunResult', {
        defaultValue: '{{created}} invoices created · {{skippedExisting}} already billed · {{skippedEmpty}} with no fees',
        created, skippedExisting, skippedEmpty,
      }));
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('fees.failedToGenerateInvoices', { defaultValue: 'Failed to generate invoices' })),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.month.trim()) return toast.error(t('fees.monthRequired', { defaultValue: 'Month is required' }));
    run.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('fees.billingRun', { defaultValue: 'Monthly Billing Run' })}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          {t('fees.billingRunHint', { defaultValue: 'Creates one itemized invoice per student from their fee profile — class fees, bus & hostel (auto-detected), package and scholarships. Students already billed for this month are skipped.' })}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('fees.monthPeriodLabel', { defaultValue: 'Month / Period *' })}</Label>
            <Input placeholder={t('fees.monthPlaceholder', { defaultValue: 'e.g. 2081-Bhadra' })} value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} />
          </div>
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
            <Button type="button" variant="outline" onClick={onClose}>{t('fees.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={run.isPending}>
              {run.isPending ? t('fees.generating', { defaultValue: 'Generating…' }) : t('fees.runBilling', { defaultValue: 'Run Billing' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── New Invoice Dialog ────────────────────────────────────────────────────────

function NewInvoiceDialog({ open, onClose, classes, companyId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState({ studentId: '', month: '', totalAmount: '', description: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (data) => feesApi.createInvoice(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-invoices'] });
      qc.invalidateQueries({ queryKey: ['school-dashboard'] });
      toast.success(t('fees.invoiceCreated', { defaultValue: 'Invoice created' }));
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('fees.failedToCreateInvoice', { defaultValue: 'Failed to create invoice' })),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.studentId) { toast.error(t('fees.selectAStudent', { defaultValue: 'Select a student' })); return; }
    if (!form.month.trim()) { toast.error(t('fees.monthRequired', { defaultValue: 'Month is required' })); return; }
    if (!form.totalAmount || isNaN(form.totalAmount)) { toast.error(t('fees.validAmountRequired', { defaultValue: 'Valid amount required' })); return; }
    save.mutate({ ...form, totalAmount: parseFloat(form.totalAmount), companyId });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('fees.createFeeInvoice', { defaultValue: 'Create Fee Invoice' })}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t('fees.studentRequiredLabel', { defaultValue: 'Student *' })}</Label>
            <StudentCombobox
              value={form.studentId}
              onChange={id => set('studentId', id)}
              placeholder={t('fees.selectStudent', { defaultValue: 'Select student…' })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fees.monthPeriodLabel', { defaultValue: 'Month / Period *' })}</Label>
            <Input placeholder={t('fees.monthPlaceholderLong', { defaultValue: 'e.g. 2081-Bhadra or Term 1 2081' })} value={form.month} onChange={e => set('month', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fees.totalAmountNprLabel', { defaultValue: 'Total Amount (NPR) *' })}</Label>
            <Input type="number" placeholder="0.00" value={form.totalAmount} onChange={e => set('totalAmount', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fees.description', { defaultValue: 'Description' })}</Label>
            <Input placeholder={t('fees.descriptionPlaceholder', { defaultValue: 'Tuition + Exam fee, etc.' })} value={form.description} onChange={e => set('description', e.target.value)} />
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

// ── Bulk Invoice Dialog ───────────────────────────────────────────────────────

function BulkInvoiceDialog({ open, onClose, classes, companyId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [classId, setClassId] = useState('');
  const [month, setMonth] = useState('');
  const [selectedStructures, setSelectedStructures] = useState([]);

  const { data: structures = [] } = useQuery({
    queryKey: ['fee-structures', companyId, classId],
    queryFn: () => feesApi.listStructures(classId || undefined).then(r => r.data),
    enabled: !!companyId,
  });

  const generate = useMutation({
    mutationFn: () => feesApi.generateBulk({ companyId, classId, month, feeStructureIds: selectedStructures }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['fee-invoices'] });
      qc.invalidateQueries({ queryKey: ['school-dashboard'] });
      toast.success(t('fees.bulkCreatedResult', { defaultValue: 'Created {{created}} invoices. {{skipped}} already existed.', created: r.data.created, skipped: r.data.skipped }));
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || t('fees.failedToGenerateInvoices', { defaultValue: 'Failed to generate invoices' })),
  });

  const toggleStructure = (id) => setSelectedStructures(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t('fees.generateBulkInvoices', { defaultValue: 'Generate Bulk Invoices' })}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t('fees.classRequiredLabel', { defaultValue: 'Class *' })}</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={classId} onChange={e => setClassId(e.target.value)}>
                <option value="">{t('fees.selectEllipsis', { defaultValue: 'Select…' })}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>{t('fees.monthPeriodLabel', { defaultValue: 'Month / Period *' })}</Label>
              <Input placeholder={t('fees.monthPlaceholder', { defaultValue: 'e.g. 2081-Bhadra' })} value={month} onChange={e => setMonth(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t('fees.feeTypesToInclude', { defaultValue: 'Fee Types to Include *' })}</Label>
            <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
              {structures.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">{t('fees.noStructuresForClass', { defaultValue: 'No fee structures found for this class' })}</div>
              ) : structures.map(s => (
                <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer">
                  <input type="checkbox" checked={selectedStructures.includes(s.id)} onChange={() => toggleStructure(s.id)} />
                  <span className="flex-1 text-sm">{s.name}</span>
                  <span className="text-sm font-medium">Rs. {Number(s.amount).toLocaleString('en-NP')}</span>
                </label>
              ))}
            </div>
          </div>
          {selectedStructures.length > 0 && structures.filter(s => selectedStructures.includes(s.id)).length > 0 && (
            <div className="text-sm bg-muted rounded-md px-3 py-2">
              {t('fees.totalPerStudent', { defaultValue: 'Total per student:' })} <strong>Rs. {structures.filter(s => selectedStructures.includes(s.id)).reduce((sum, s) => sum + Number(s.amount), 0).toLocaleString('en-NP')}</strong>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('fees.cancel', { defaultValue: 'Cancel' })}</Button>
          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending || !classId || !month || selectedStructures.length === 0}
          >
            {generate.isPending ? t('fees.generating', { defaultValue: 'Generating…' }) : t('fees.generateInvoices', { defaultValue: 'Generate Invoices' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Receipt Print ─────────────────────────────────────────────────────────────

function printReceipt(inv) {
  const w = window.open('', '_blank');
  const fmt = (n) => Number(n).toLocaleString('en-NP', { minimumFractionDigits: 2 });
  const className = inv.student?.class
    ? `${inv.student.class.name}${inv.student.class.section ? ` (${inv.student.class.section})` : ''}`
    : '—';

  w.document.write(`
    <html><head><title>Fee Receipt</title>
    <style>
      body{font-family:sans-serif;max-width:500px;margin:30px auto;padding:0 20px;font-size:13px}
      h2{text-align:center;margin:0;font-size:18px}
      .divider{border-top:1px dashed #999;margin:12px 0}
      .row{display:flex;justify-content:space-between;margin:4px 0}
      .label{color:#666}
      .total{font-size:15px;font-weight:bold;margin-top:8px}
      .stamp{margin-top:40px;text-align:right;font-size:12px}
      @media print{button{display:none}}
    </style></head>
    <body>
    <h2>${inv.company?.name || 'School'}</h2>
    ${inv.company?.address ? `<p style="text-align:center;color:#666;margin:4px 0">${inv.company.address}</p>` : ''}
    ${inv.company?.phone ? `<p style="text-align:center;color:#666;margin:4px 0">Phone: ${inv.company.phone}</p>` : ''}
    <div class="divider"></div>
    <div style="text-align:center;font-weight:bold;margin-bottom:8px">FEE RECEIPT</div>
    <div class="row"><span class="label">Receipt No:</span> <span>${inv.id.slice(-8).toUpperCase()}</span></div>
    <div class="row"><span class="label">Date:</span> <span>${format(new Date(), 'dd MMM yyyy')}</span></div>
    <div class="divider"></div>
    <div class="row"><span class="label">Student:</span> <span>${inv.student?.name || '—'}</span></div>
    <div class="row"><span class="label">Roll No:</span> <span>${inv.student?.rollNumber || '—'}</span></div>
    <div class="row"><span class="label">Class:</span> <span>${className}</span></div>
    <div class="row"><span class="label">Month:</span> <span>${inv.month}</span></div>
    ${inv.description ? `<div class="row"><span class="label">Description:</span> <span>${inv.description}</span></div>` : ''}
    <div class="divider"></div>
    <div class="row"><span class="label">Total Amount:</span> <span>Rs. ${fmt(inv.totalAmount)}</span></div>
    ${Number(inv.discount) > 0 ? `<div class="row"><span class="label">Discount:</span> <span>- Rs. ${fmt(inv.discount)}</span></div>` : ''}
    <div class="row total"><span>Amount Paid:</span> <span>Rs. ${fmt(inv.paidAmount)}</span></div>
    ${Number(inv.totalAmount) - Number(inv.paidAmount) > 0 ? `<div class="row" style="color:#c00"><span>Balance Due:</span> <span>Rs. ${fmt(Number(inv.totalAmount) - Number(inv.paidAmount))}</span></div>` : ''}
    <div class="divider"></div>
    <div class="stamp">
      <p>_______________________</p>
      <p>Accountant / Cashier</p>
    </div>
    <br><button onclick="window.print()">Print Receipt</button>
    </body></html>
  `);
  w.document.close();
  setTimeout(() => w.print(), 300);
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

  const removeStructure = useMutation({
    mutationFn: (id) => feesApi.removeStructure(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-structures'] }); toast.success(t('fees.feeDeleted', { defaultValue: 'Fee deleted' })); },
    onError: (err) => toast.error(err?.response?.data?.message || t('fees.failedToDelete', { defaultValue: 'Failed to delete' })),
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
          {tab === 'structures' && (
            <Button onClick={() => setStructureDialog({ mode: 'add' })}>
              <Plus className="w-4 h-4 mr-2" /> {t('fees.addFee', { defaultValue: 'Add Fee' })}
            </Button>
          )}
          {tab === 'invoices' && (
            <>
              <Button variant="outline" onClick={() => setBulkDialog(true)}>
                <Users className="w-4 h-4 mr-2" /> {t('fees.billingRun', { defaultValue: 'Monthly Billing Run' })}
              </Button>
              <Button onClick={() => setInvoiceDialog(true)}>
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
          { id: 'profile', label: t('fees.studentFees', { defaultValue: 'Student Fees' }) },
          { id: 'structures', label: t('fees.feeStructures', { defaultValue: 'Fee Structures' }) },
          { id: 'heads', label: t('fees.feeHeads', { defaultValue: 'Fee Heads' }) },
          { id: 'packages', label: t('fees.packages', { defaultValue: 'Packages' }) },
        ].map(tb => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === tb.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <StudentFeeProfileTab />}
      {tab === 'heads' && <FeeHeadsTab />}
      {tab === 'packages' && <FeePackagesTab />}

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
                      <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('fees.total', { defaultValue: 'Total' })}</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('fees.paid', { defaultValue: 'Paid' })}</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('fees.due', { defaultValue: 'Due' })}</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('fees.status', { defaultValue: 'Status' })}</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoices.map(inv => {
                      const due = Number(inv.totalAmount) - Number(inv.paidAmount);
                      const isExpanded = expandedId === inv.id;
                      return (
                        <Fragment key={inv.id}>
                        <tr className="hover:bg-muted/20 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : inv.id)}>
                          <td className="px-5 py-3 font-medium">
                            <span className="inline-flex items-center gap-1.5">
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                              {inv.student?.name ?? '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">{inv.month}</td>
                          <td className="px-5 py-3 text-right tabular-nums">Rs. {Number(inv.totalAmount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-emerald-700">Rs. {Number(inv.paidAmount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-amber-700">Rs. {due.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inv.status] || ''}`}>
                              {STATUS_LABEL[inv.status] || inv.status}
                            </span>
                          </td>
                          <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-1 flex-wrap">
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
                                feesApi.receipt(inv.id).then(r => printReceipt(r.data)).catch(() => toast.error(t('fees.couldNotLoadReceipt', { defaultValue: 'Could not load receipt' })));
                              }} title={t('fees.printReceipt', { defaultValue: 'Print Receipt' })}>
                                <Printer className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-muted/20">
                            <td colSpan={7} className="px-8 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                    {t('fees.lineItems', { defaultValue: 'What this invoice covers' })}
                                  </p>
                                  {(inv.items ?? []).length === 0 ? (
                                    <p className="text-sm text-muted-foreground">{inv.description || '—'}</p>
                                  ) : (
                                    <div className="space-y-1">
                                      {inv.items.map(item => (
                                        <div key={item.id} className="flex justify-between text-sm">
                                          <span>{item.description}{item.feeHead ? <span className="text-xs text-muted-foreground ml-1">· {item.feeHead.name}</span> : null}</span>
                                          <span className={`tabular-nums ${Number(item.amount) < 0 ? 'text-emerald-600' : ''}`}>
                                            {Number(item.amount) < 0 ? '− ' : ''}Rs. {Math.abs(Number(item.amount)).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                    {t('fees.paymentHistory', { defaultValue: 'Payment history' })}
                                  </p>
                                  {(inv.payments ?? []).length === 0 ? (
                                    <p className="text-sm text-muted-foreground">{t('fees.noPaymentsYet', { defaultValue: 'No payments yet' })}</p>
                                  ) : (
                                    <div className="space-y-1">
                                      {inv.payments.map(p => (
                                        <div key={p.id} className="flex justify-between items-center text-sm">
                                          <span className="inline-flex items-center gap-1.5">
                                            <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                                            <span className="font-mono text-xs">{p.receiptNo}</span>
                                            <span className="text-xs text-muted-foreground">{p.method} · {format(new Date(p.paidAt), 'dd MMM yyyy')}</span>
                                          </span>
                                          <span className="tabular-nums text-emerald-700">Rs. {Number(p.amount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
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
                          <button onClick={() => { if (confirm(t('fees.deleteConfirm', { defaultValue: 'Delete "{{name}}"?', name: s.name }))) removeStructure.mutate(s.id); }} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
          classes={classes}
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
