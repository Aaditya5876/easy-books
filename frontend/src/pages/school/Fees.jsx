import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, DollarSign, CheckCircle, Printer, Users, Sparkles } from 'lucide-react';
import { feesApi, classesApi, studentsApi, aiApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

// ── Fee Structure Dialog ──────────────────────────────────────────────────────

function FeeStructureDialog({ open, onClose, initial, classes, companyId }) {
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, amount: initial.amount, frequency: initial.frequency, classId: initial.classId || '' }
      : { name: '', amount: '', frequency: 'MONTHLY', classId: '' }
  );
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (data) =>
      isEdit ? feesApi.updateStructure(initial.id, data) : feesApi.createStructure(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-structures'] });
      toast.success(isEdit ? 'Fee structure updated' : 'Fee structure created');
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to save'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Fee name is required'); return; }
    if (!form.amount || isNaN(form.amount)) { toast.error('Valid amount required'); return; }
    save.mutate({ ...form, amount: parseFloat(form.amount), companyId });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Fee' : 'Add Fee Structure'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Fee Name *</Label>
            <Input placeholder="e.g. Tuition Fee, Exam Fee, Bus Fee" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Amount (NPR) *</Label>
            <Input type="number" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Frequency</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.frequency}
              onChange={e => set('frequency', e.target.value)}
            >
              <option value="MONTHLY">Monthly</option>
              <option value="TERM">Per Term</option>
              <option value="ANNUAL">Annual</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Applicable Class <span className="text-muted-foreground">(leave blank for all)</span></Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.classId}
              onChange={e => set('classId', e.target.value)}
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Fee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Record Payment Dialog ─────────────────────────────────────────────────────

function PaymentDialog({ open, onClose, invoice }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const remaining = invoice ? Number(invoice.totalAmount) - Number(invoice.paidAmount) : 0;

  const pay = useMutation({
    mutationFn: (data) => feesApi.recordPayment(invoice.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-invoices'] });
      qc.invalidateQueries({ queryKey: ['school-dashboard'] });
      toast.success('Payment recorded');
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to record payment'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid payment amount'); return; }
    if (amt > remaining) { toast.error(`Cannot exceed remaining amount: Rs. ${remaining.toFixed(2)}`); return; }
    pay.mutate({ amount: amt, notes });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        {invoice && (
          <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
            <p><span className="text-muted-foreground">Student:</span> <strong>{invoice.student?.name}</strong></p>
            <p><span className="text-muted-foreground">Month:</span> {invoice.month}</p>
            <p><span className="text-muted-foreground">Total:</span> Rs. {Number(invoice.totalAmount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</p>
            <p><span className="text-muted-foreground">Paid:</span> Rs. {Number(invoice.paidAmount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</p>
            <p className="font-semibold text-amber-700"><span className="text-muted-foreground font-normal">Remaining:</span> Rs. {remaining.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Payment Amount (NPR) *</Label>
            <Input
              type="number"
              placeholder={`Max: ${remaining.toFixed(2)}`}
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Cash / Bank Transfer / Cheque no." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pay.isPending}>
              {pay.isPending ? 'Recording…' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── New Invoice Dialog ────────────────────────────────────────────────────────

function NewInvoiceDialog({ open, onClose, students, classes, companyId }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ studentId: '', month: '', totalAmount: '', description: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (data) => feesApi.createInvoice(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-invoices'] });
      qc.invalidateQueries({ queryKey: ['school-dashboard'] });
      toast.success('Invoice created');
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to create invoice'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.studentId) { toast.error('Select a student'); return; }
    if (!form.month.trim()) { toast.error('Month is required'); return; }
    if (!form.totalAmount || isNaN(form.totalAmount)) { toast.error('Valid amount required'); return; }
    save.mutate({ ...form, totalAmount: parseFloat(form.totalAmount), companyId });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Create Fee Invoice</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Student *</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.studentId}
              onChange={e => set('studentId', e.target.value)}
            >
              <option value="">Select student…</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} — Roll {s.rollNumber || 'N/A'}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Month / Period *</Label>
            <Input placeholder="e.g. 2081-Bhadra or Term 1 2081" value={form.month} onChange={e => set('month', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Total Amount (NPR) *</Label>
            <Input type="number" placeholder="0.00" value={form.totalAmount} onChange={e => set('totalAmount', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input placeholder="Tuition + Exam fee, etc." value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Creating…' : 'Create Invoice'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Bulk Invoice Dialog ───────────────────────────────────────────────────────

function BulkInvoiceDialog({ open, onClose, classes, companyId }) {
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
      qc.invalidateQueries(['fee-invoices']);
      qc.invalidateQueries(['school-dashboard']);
      toast.success(`Created ${r.data.created} invoices. ${r.data.skipped} already existed.`);
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to generate invoices'),
  });

  const toggleStructure = (id) => setSelectedStructures(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Generate Bulk Invoices</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Class *</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={classId} onChange={e => setClassId(e.target.value)}>
                <option value="">Select…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Month / Period *</Label>
              <Input placeholder="e.g. 2081-Bhadra" value={month} onChange={e => setMonth(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Fee Types to Include *</Label>
            <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
              {structures.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">No fee structures found for this class</div>
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
              Total per student: <strong>Rs. {structures.filter(s => selectedStructures.includes(s.id)).reduce((sum, s) => sum + Number(s.amount), 0).toLocaleString('en-NP')}</strong>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending || !classId || !month || selectedStructures.length === 0}
          >
            {generate.isPending ? 'Generating…' : 'Generate Invoices'}
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

export default function Fees() {
  const companyId = getActiveCompanyId();
  const qc = useQueryClient();
  const [tab, setTab] = useState('invoices');
  const [filterStatus, setFilterStatus] = useState('');
  const [structureDialog, setStructureDialog] = useState(null);
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [bulkDialog, setBulkDialog] = useState(false);
  const [payDialog, setPayDialog] = useState(null);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes', companyId],
    queryFn: () => classesApi.list().then(r => r.data),
    enabled: !!companyId,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students', companyId],
    queryFn: () => studentsApi.list().then(r => r.data),
    enabled: !!companyId,
  });

  const { data: structures = [], isLoading: loadingStructures } = useQuery({
    queryKey: ['fee-structures', companyId],
    queryFn: () => feesApi.listStructures().then(r => r.data),
    enabled: !!companyId && tab === 'structures',
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['fee-invoices', companyId, filterStatus],
    queryFn: () => feesApi.listInvoices(filterStatus ? { status: filterStatus } : {}).then(r => r.data),
    enabled: !!companyId && tab === 'invoices',
  });

  const removeStructure = useMutation({
    mutationFn: (id) => feesApi.removeStructure(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-structures'] }); toast.success('Fee deleted'); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to delete'),
  });

  const classLabel = (id) => {
    const c = classes.find(c => c.id === id);
    return c ? `${c.name}${c.section ? ` (${c.section})` : ''}` : 'All Classes';
  };

  const FREQ = { MONTHLY: 'Monthly', TERM: 'Per Term', ANNUAL: 'Annual' };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fee Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Fee structures and student invoices</p>
        </div>
        <div className="flex gap-2">
          {tab === 'structures' && (
            <Button onClick={() => setStructureDialog({ mode: 'add' })}>
              <Plus className="w-4 h-4 mr-2" /> Add Fee
            </Button>
          )}
          {tab === 'invoices' && (
            <>
              <Button variant="outline" onClick={() => setBulkDialog(true)}>
                <Users className="w-4 h-4 mr-2" /> Bulk Generate
              </Button>
              <Button onClick={() => setInvoiceDialog(true)}>
                <Plus className="w-4 h-4 mr-2" /> New Invoice
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {[{ id: 'invoices', label: 'Fee Invoices' }, { id: 'structures', label: 'Fee Structures' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Invoices Tab */}
      {tab === 'invoices' && (
        <>
          <div className="flex gap-3">
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
              <option value="WAIVED">Waived</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-border overflow-hidden">
            {loadingInvoices ? (
              <div className="p-12 text-center text-muted-foreground text-sm">Loading invoices…</div>
            ) : invoices.length === 0 ? (
              <div className="p-12 text-center">
                <DollarSign className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No invoices found</p>
                <Button className="mt-4" size="sm" onClick={() => setInvoiceDialog(true)}>Create First Invoice</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Student</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Month</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Paid</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Due</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoices.map(inv => {
                      const due = Number(inv.totalAmount) - Number(inv.paidAmount);
                      return (
                        <tr key={inv.id} className="hover:bg-muted/20">
                          <td className="px-5 py-3 font-medium">{inv.student?.name ?? '—'}</td>
                          <td className="px-5 py-3 text-muted-foreground">{inv.month}</td>
                          <td className="px-5 py-3 text-right tabular-nums">Rs. {Number(inv.totalAmount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-emerald-700">Rs. {Number(inv.paidAmount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-amber-700">Rs. {due.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inv.status] || ''}`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {inv.status !== 'PAID' && inv.status !== 'WAIVED' && (
                                <Button size="sm" variant="outline" onClick={() => setPayDialog(inv)}>
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Pay
                                </Button>
                              )}
                              {inv.status !== 'PAID' && inv.status !== 'WAIVED' && (
                                <Button size="sm" variant="ghost" className="text-violet-600 hover:bg-violet-50" onClick={async () => {
                                  try {
                                    await feesApi.sendFeeReminderSms(inv.id);
                                    toast.success('SMS reminder sent to guardian');
                                  } catch (e) {
                                    toast.error(e?.response?.data?.message || 'SMS failed — check SMS_API_KEY');
                                  }
                                }} title="Send SMS Reminder">
                                  <Sparkles className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => {
                                feesApi.receipt(inv.id).then(r => printReceipt(r.data)).catch(() => toast.error('Could not load receipt'));
                              }} title="Print Receipt">
                                <Printer className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Structures Tab */}
      {tab === 'structures' && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {loadingStructures ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
          ) : structures.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No fee structures yet</p>
              <Button className="mt-4" size="sm" onClick={() => setStructureDialog({ mode: 'add' })}>Add First Fee</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Fee Name</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Class</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Frequency</th>
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
                          <button onClick={() => { if (confirm(`Delete "${s.name}"?`)) removeStructure.mutate(s.id); }} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
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
        <BulkInvoiceDialog
          open={bulkDialog}
          onClose={() => setBulkDialog(false)}
          classes={classes}
          companyId={companyId}
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
          students={students}
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
