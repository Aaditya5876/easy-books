import { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  taskApi, salesApi, purchaseApi, quotationApi, clientApi, vendorApi, employeeApi, memoApi, inventoryApi,
} from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { SmartNumberInput } from '@/components/ui/smart-number-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Plus, X, User, CheckCircle2, FileText, Paperclip, Search, Link2,
  Receipt, ShoppingCart, UserPlus, Truck, BadgePlus, Trash2, ExternalLink, FileSpreadsheet, Wallet, Clock,
} from 'lucide-react';
import { FileAttachmentZone } from '@/components/ui/file-attachment-zone';
import { useToast } from '@/components/ui/use-toast';
import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';
import { useRole } from '@/lib/useRole';
import { fileUrl } from '@/lib/fileUrl';
import { useIdempotencyKey } from '@/lib/useIdempotencyKey';
import {
  TASK_STATUSES, TASK_PRIORITIES, WORKFLOW_TYPES, PARTY_TYPES, TASK_CATEGORIES, MEMO_FOLDERS,
  toTaskPayload, defaultMemoFolder, isTaskOverdue, toOrderItems, linesTotal, matchByName,
  statusLabel, priorityLabel, workflowTypeLabel, partyTypeLabel, memoFolderLabel,
} from '@/lib/tasks';

// ─── Look ─────────────────────────────────────────────────────────────────────

// Sticky-note colour per kind of work.
const NOTE_COLORS = {
  JOB_CARD: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900',
  ORDER_SLIP: 'bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-900',
  GENERAL_ASSESSMENT: 'bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-900',
  APPOINTMENT: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900',
  GENERAL: 'bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-800',
};
const STATUS_BADGE = {
  PENDING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};
const PRIORITY_DOT = { LOW: 'bg-green-500', MEDIUM: 'bg-amber-500', HIGH: 'bg-orange-500', URGENT: 'bg-red-600' };
const COLUMN_DOT = { PENDING: 'bg-gray-400', IN_PROGRESS: 'bg-blue-500', COMPLETED: 'bg-green-500', CANCELLED: 'bg-red-400' };

const EMPTY_TASK = {
  title: '', description: '', workflowType: 'JOB_CARD', category: 'General', priority: 'MEDIUM', status: 'PENDING',
  dueDate: '', dueTime: '', assignedName: '', assignedTo: '', assignedContact: '', assignedEmployeeId: null, department: '',
  partyType: '', partyId: null, partyName: '', partyContact: '', notes: '',
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => {
  if (!d) return null;
  const x = new Date(d);
  return isNaN(x) ? null : x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtNPR = (v) => `NPR ${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
// Drops blank values so optional API fields (email, phone…) aren't sent as ''.
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined));
const apiError = (e, fallback) => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : typeof m === 'string' ? m : fallback;
};
const rows = (res) => (Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : []);

// Files picked for a task, each filed under a Memo folder. Creates one memo
// per folder, linked to the task (referenceId).
async function saveTaskDocuments(task, files) {
  const byFolder = {};
  for (const f of files) (byFolder[f.folder] ||= []).push(f.url);
  for (const [category, urls] of Object.entries(byFolder)) {
    await memoApi.create(compact({
      companyId: getActiveCompanyId(),
      category,
      title: `Task #${task.taskNumber ?? ''} — ${task.title}`,
      content: task.description || undefined,
      dateAd: todayIso(),
      referenceId: task.id,
      linkedReference: `Task #${task.taskNumber ?? ''}`,
      clientName: task.partyType === 'VENDOR' ? undefined : task.partyName,
      clientContact: task.partyType === 'VENDOR' ? undefined : task.partyContact,
      vendorName: task.partyType === 'VENDOR' ? task.partyName : undefined,
      vendorContact: task.partyType === 'VENDOR' ? task.partyContact : undefined,
      assignedTo: task.assignedName || task.assignedTo,
      documentUrl: urls[0],
      attachments: urls,
    }));
  }
}

// ─── Directories (existing clients, vendors, employees, stock) ───────────────

const DirectoryContext = createContext({ clients: [], vendors: [], employees: [], inventory: [], reload: () => {} });

function useDirectoryLoader() {
  const [dir, setDir] = useState({ clients: [], vendors: [], employees: [], inventory: [] });
  const reload = useCallback(async () => {
    // Each list may be refused for some roles — show what we can.
    const [c, v, e, i] = await Promise.allSettled([clientApi.list(), vendorApi.list(), employeeApi.directory(), inventoryApi.list()]);
    const ok = (r) => (r.status === 'fulfilled' ? rows(r.value) : []);
    setDir({
      clients: ok(c).filter((x) => !x.deletedAt),
      vendors: ok(v).filter((x) => !x.deletedAt),
      employees: ok(e),
      inventory: ok(i).filter((x) => !x.deletedAt),
    });
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { ...dir, reload };
}

const partyList = (dir, type) => (type === 'CLIENT' ? dir.clients : type === 'VENDOR' ? dir.vendors : type === 'EMPLOYEE' ? dir.employees : []);

// ─── Shared form pieces ──────────────────────────────────────────────────────

function Field({ label, children, className, hint }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function EnumSelect({ value, onChange, options, label, allowEmpty, emptyLabel }) {
  return (
    <Select value={value || (allowEmpty ? '__none' : undefined)} onValueChange={(v) => onChange(v === '__none' ? '' : v)}>
      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value="__none">{emptyLabel}</SelectItem>}
        {options.map((o) => <SelectItem key={o} value={o}>{label(o)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// Free-text name with suggestions from existing records. Picking (or typing)
// an existing name links the record; anything else stays a plain name.
function NameWithSuggestions({ id, value, records, onChange, placeholder, linked }) {
  const { t } = useTranslation();
  return (
    <div className="relative">
      <Input
        className={cn('h-9 text-sm', linked && 'pr-7')}
        list={id}
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value, matchByName(records, e.target.value))}
      />
      {linked && <Link2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-600" title={t('workflow.linkedRecord', { defaultValue: 'Linked to an existing record' })} />}
      <datalist id={id}>
        {records.map((r) => <option key={r.id} value={r.name} />)}
      </datalist>
    </div>
  );
}

// All task fields; used by both "New Task" and the detail panel.
function TaskFields({ value, onChange }) {
  const { t } = useTranslation();
  const dir = useContext(DirectoryContext);
  const set = (k) => (v) => onChange({ ...value, [k]: v?.target ? v.target.value : v });

  const setAssignee = (name, emp) => onChange({
    ...value,
    assignedName: name,
    assignedEmployeeId: emp?.id ?? null,
    department: emp?.department && !value.department ? emp.department : value.department,
  });
  const setPartyType = (partyType) => onChange({ ...value, partyType, partyId: null });
  const setParty = (name, rec) => onChange({
    ...value,
    partyName: name,
    partyId: rec?.id ?? null,
    partyContact: rec?.phone && !value.partyContact ? rec.phone : value.partyContact,
  });
  const linkableParty = ['CLIENT', 'VENDOR', 'EMPLOYEE'].includes(value.partyType);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label={`${t('workflow.titleLabel', { defaultValue: 'Title' })} *`} className="sm:col-span-2">
        <Input className="h-9 text-sm" value={value.title} onChange={set('title')} placeholder={t('workflow.whatNeedsDone', { defaultValue: 'What needs to be done?' })} />
      </Field>
      <Field label={t('workflow.type', { defaultValue: 'Type' })}>
        <EnumSelect value={value.workflowType} onChange={set('workflowType')} options={WORKFLOW_TYPES} label={(o) => workflowTypeLabel(t, o)} />
      </Field>
      <Field label={t('workflow.category', { defaultValue: 'Category' })}>
        <EnumSelect value={value.category} onChange={set('category')} options={TASK_CATEGORIES} label={(c) => t(`workflow.category${c[0]}${c.slice(1).toLowerCase()}`, { defaultValue: c })} allowEmpty emptyLabel="—" />
      </Field>
      <Field label={t('workflow.priority', { defaultValue: 'Priority' })}>
        <EnumSelect value={value.priority} onChange={set('priority')} options={TASK_PRIORITIES} label={(p) => priorityLabel(t, p)} />
      </Field>
      <Field label={t('workflow.status', { defaultValue: 'Status' })}>
        <EnumSelect value={value.status} onChange={set('status')} options={TASK_STATUSES} label={(s) => statusLabel(t, s)} />
      </Field>
      <Field label={t('workflow.dueDate', { defaultValue: 'Due Date' })}>
        <Input type="date" className="h-9 text-sm" value={value.dueDate ? String(value.dueDate).slice(0, 10) : ''} onChange={set('dueDate')} />
      </Field>
      <Field label={t('workflow.dueTime', { defaultValue: 'Due Time' })}>
        <Input type="time" className="h-9 text-sm" value={value.dueTime || ''} onChange={set('dueTime')} />
      </Field>

      <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">{t('workflow.assignment', { defaultValue: 'Assignment' })}</p>
      <Field label={t('workflow.assignedTo', { defaultValue: 'Assigned To' })} hint={dir.employees.length ? t('workflow.pickEmployeeHint', { defaultValue: 'Pick an employee to link them, or type any name.' }) : undefined}>
        <NameWithSuggestions
          id="wf-employees"
          value={value.assignedName}
          records={dir.employees}
          linked={!!value.assignedEmployeeId}
          onChange={setAssignee}
          placeholder={t('workflow.fullName', { defaultValue: 'Full name' })}
        />
      </Field>
      <Field label={t('workflow.contact', { defaultValue: 'Contact' })}>
        <Input className="h-9 text-sm" value={value.assignedContact || ''} onChange={set('assignedContact')} placeholder={t('workflow.phoneOrEmail', { defaultValue: 'Phone / email' })} />
      </Field>
      <Field label={t('workflow.assigneeEmail', { defaultValue: 'Assignee Email' })}>
        <Input type="email" className="h-9 text-sm" value={value.assignedTo || ''} onChange={set('assignedTo')} placeholder="team@company.com" />
      </Field>
      <Field label={t('workflow.department', { defaultValue: 'Department' })}>
        <Input className="h-9 text-sm" value={value.department || ''} onChange={set('department')} placeholder={t('workflow.departmentPlaceholder', { defaultValue: 'e.g. Workshop' })} />
      </Field>

      <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">{t('workflow.forWhom', { defaultValue: 'Client / Vendor' })}</p>
      <Field label={t('workflow.partyType', { defaultValue: 'Party Type' })}>
        <EnumSelect value={value.partyType} onChange={setPartyType} options={PARTY_TYPES} label={(p) => partyTypeLabel(t, p)} allowEmpty emptyLabel="—" />
      </Field>
      <Field label={t('workflow.partyName', { defaultValue: 'Name' })}>
        {linkableParty ? (
          <NameWithSuggestions
            id={`wf-party-${value.partyType}`}
            value={value.partyName}
            records={partyList(dir, value.partyType)}
            linked={!!value.partyId}
            onChange={setParty}
          />
        ) : (
          <Input className="h-9 text-sm" value={value.partyName || ''} onChange={set('partyName')} />
        )}
      </Field>
      <Field label={t('workflow.partyContact', { defaultValue: 'Party Contact' })} className="sm:col-span-2">
        <Input className="h-9 text-sm" value={value.partyContact || ''} onChange={set('partyContact')} placeholder="+977…" />
      </Field>

      <Field label={t('workflow.description', { defaultValue: 'Description' })} className="sm:col-span-2">
        <Textarea className="resize-none text-sm" rows={3} value={value.description || ''} onChange={set('description')} placeholder={t('workflow.addDetailsPlaceholder', { defaultValue: 'Add details about this task...' })} />
      </Field>
    </div>
  );
}

// Picked files, each with the Memo folder it will be filed under.
function DocumentPicker({ files, onChange, defaultFolder }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <FileAttachmentZone
        files={files}
        maxFiles={10}
        label={t('workflow.scanOrAttach', { defaultValue: 'Attach scans (job cards, order slips, quotations…)' })}
        onChange={(next) => onChange(next.map((f) => ({ ...f, folder: f.folder || defaultFolder })))}
      />
      {files.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">{t('workflow.chooseMemoFolder', { defaultValue: 'Choose where each document is saved in Memo:' })}</p>
          {files.map((f, i) => (
            <div key={f.url || i} className="flex items-center gap-2">
              <span className="flex-1 truncate text-xs" title={f.originalName}>{f.originalName || f.name}</span>
              <Select value={f.folder} onValueChange={(folder) => onChange(files.map((x, j) => (j === i ? { ...x, folder } : x)))}>
                <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEMO_FOLDERS.map((m) => <SelectItem key={m} value={m}>{memoFolderLabel(t, m)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sticky note card ────────────────────────────────────────────────────────

// From the outside a note shows only: number, title, assigned date, due date,
// status and who it's assigned to — plus small counts of what's linked.
function TaskNote({ task, onClick }) {
  const { t } = useTranslation();
  const overdue = isTaskOverdue(task);
  const c = task.linkCounts || {};
  const linkBits = [
    c.quotations && { icon: FileSpreadsheet, n: c.quotations, label: t('workflow.quotations', { defaultValue: 'Quotations' }) },
    c.purchases && { icon: ShoppingCart, n: c.purchases, label: t('workflow.purchases', { defaultValue: 'Purchases' }) },
    c.sales && { icon: Receipt, n: c.sales, label: t('workflow.salesBills', { defaultValue: 'Sales bills' }) },
    c.documents && { icon: Paperclip, n: c.documents, label: t('workflow.documents', { defaultValue: 'Documents' }) },
  ].filter(Boolean);
  return (
    <button
      type="button"
      onClick={() => onClick(task)}
      className={cn(
        'relative w-full rounded-md border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
        NOTE_COLORS[task.workflowType] || NOTE_COLORS.GENERAL,
      )}
    >
      <span className={cn('absolute right-2 top-2 h-2 w-2 rounded-full', PRIORITY_DOT[task.priority] || 'bg-gray-300')} title={priorityLabel(t, task.priority)} />
      <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="font-mono font-semibold text-foreground">#{task.taskNumber ?? '—'}</span>
        <span>· {workflowTypeLabel(t, task.workflowType)}</span>
      </div>
      <p className="mb-2 line-clamp-2 pr-3 text-sm font-semibold leading-snug">{task.title}</p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
        <span className="text-muted-foreground">{t('workflow.assignedOn', { defaultValue: 'Assigned' })}</span>
        <span className="text-right">{fmtDate(task.createdAt) || '—'}</span>
        <span className="text-muted-foreground">{t('workflow.due', { defaultValue: 'Due' })}</span>
        <span className={cn('text-right', overdue && 'font-semibold text-red-600')}>
          {fmtDate(task.dueDate) || '—'}{task.dueTime ? ` ${task.dueTime}` : ''}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 text-xs">
          <User className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{task.assignedName || task.assignedTo || t('workflow.unassigned', { defaultValue: 'Unassigned' })}</span>
        </span>
        <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', STATUS_BADGE[task.status])}>
          {overdue ? t('workflow.overdue', { defaultValue: 'Overdue' }) : statusLabel(t, task.status)}
        </span>
      </div>
      {linkBits.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 border-t border-black/5 pt-2 text-[10px] text-muted-foreground dark:border-white/10">
          {linkBits.map(({ icon: Icon, n, label }) => (
            <span key={label} className="flex items-center gap-0.5" title={label}><Icon className="h-3 w-3" />{n}</span>
          ))}
        </div>
      )}
    </button>
  );
}

// ─── Quick actions ───────────────────────────────────────────────────────────

const EMPTY_LINE = { inventoryItemId: '', description: '', quantity: 1, unitPrice: 0, unit: '' };

// Multi-line items with optional stock item per line.
function LineItems({ lines, onChange, priceKey }) {
  const { t } = useTranslation();
  const { inventory } = useContext(DirectoryContext);
  const setLine = (i, patch) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const pickItem = (i, id) => {
    if (id === '__none') return setLine(i, { inventoryItemId: '' });
    const item = inventory.find((x) => x.id === id);
    setLine(i, {
      inventoryItemId: id,
      description: item?.itemName || item?.partNumber || lines[i].description,
      unitPrice: Number(item?.[priceKey] ?? 0),
      unit: item?.unit || '',
    });
  };
  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-md border border-border p-2">
          {inventory.length > 0 && (
            <div className="col-span-12">
              <Select value={l.inventoryItemId || '__none'} onValueChange={(v) => pickItem(i, v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{t('workflow.notStockItem', { defaultValue: 'Not a stock item (service / labour)' })}</SelectItem>
                  {inventory.map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.itemName || it.partNumber} · {t('workflow.inStock', { defaultValue: 'stock {{q}}', q: Number(it.quantity ?? 0) })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="col-span-12 sm:col-span-6">
            <Input className="h-8 text-xs" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder={t('workflow.itemDescription', { defaultValue: 'Item / Work' })} />
          </div>
          <div className="col-span-4 sm:col-span-2">
            <SmartNumberInput className="h-8 text-xs" value={l.quantity} min="0" step="any" onChange={(e) => setLine(i, { quantity: e.target.value })} title={t('workflow.quantity', { defaultValue: 'Quantity' })} />
          </div>
          <div className="col-span-6 sm:col-span-3">
            <SmartNumberInput className="h-8 text-xs" value={l.unitPrice} min="0" step="any" onChange={(e) => setLine(i, { unitPrice: e.target.value })} title={t('workflow.rate', { defaultValue: 'Rate' })} />
          </div>
          <div className="col-span-2 sm:col-span-1 flex justify-end">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={lines.length === 1} onClick={() => onChange(lines.filter((_, j) => j !== i))}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => onChange([...lines, { ...EMPTY_LINE }])}>
        <Plus className="h-3 w-3" />{t('workflow.addLine', { defaultValue: 'Add line' })}
      </Button>
    </div>
  );
}

const ACTION_TITLES = (t) => ({
  quotation: t('workflow.createQuotation', { defaultValue: 'Create Quotation' }),
  sales: t('workflow.createSalesBill', { defaultValue: 'Create Sales Bill' }),
  purchase: t('workflow.createPurchase', { defaultValue: 'Create Purchase' }),
  client: t('workflow.addClient', { defaultValue: 'Add Client' }),
  vendor: t('workflow.addVendor', { defaultValue: 'Add Vendor' }),
  employee: t('workflow.addEmployee', { defaultValue: 'Add Employee' }),
});

// Every record made here is saved with taskId, so it shows up under the job.
function QuickActionDialog({ kind, task, onClose, onDone }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const dir = useContext(DirectoryContext);
  const [saving, setSaving] = useState(false);
  // One key per dialog: a retried save returns the first record, never a second bill.
  const idem = useIdempotencyKey();
  const cfg = () => ({ idempotencyKey: idem.key });
  const isOrder = kind === 'sales' || kind === 'purchase' || kind === 'quotation';
  const isParty = kind === 'client' || kind === 'vendor';
  const forVendor = kind === 'purchase' || kind === 'vendor';
  const records = forVendor ? dir.vendors : dir.clients;
  const jobPartyFits = forVendor ? task.partyType === 'VENDOR' : task.partyType === 'CLIENT';
  const [form, setForm] = useState(() => {
    const name = jobPartyFits ? (task.partyName || '') : '';
    return {
      name,
      linkedId: jobPartyFits ? (task.partyId || matchByName(records, name)?.id || null) : null,
      contact: jobPartyFits ? (task.partyContact || '') : '',
      email: '', address: '',
      lines: [{ ...EMPTY_LINE, description: task.title }],
      isVat: false, paymentMethod: kind === 'purchase' ? 'CREDIT' : 'CASH',
      notes: `Task #${task.taskNumber ?? ''} — ${task.title}`,
      quotationNumber: `QT-J${task.taskNumber ?? ''}-${String(Date.now()).slice(-4)}`,
      employeeId: `EMP-${String(Date.now()).slice(-5)}`, department: task.department || '', designation: '', phone: '',
      files: [],
    };
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const titles = ACTION_TITLES(t);
  const items = toOrderItems(form.lines);
  const total = linesTotal(form.lines, form.isVat);

  async function submit() {
    setSaving(true);
    const companyId = getActiveCompanyId();
    const taskId = task.id;
    try {
      let created;
      if (isOrder) {
        const party = forVendor
          ? compact({ vendorId: form.linkedId, vendorName: form.name.trim(), vendorContact: form.contact })
          : compact({ clientId: form.linkedId, clientName: form.name.trim(), clientContact: form.contact });
        if (kind === 'quotation') {
          created = await quotationApi.create({
            companyId, taskId, ...party, dateAd: todayIso(), quotationNumber: form.quotationNumber.trim(),
            items, isVat: form.isVat, totalAmount: total, description: form.notes || undefined,
          }, cfg());
        } else {
          const attachments = form.files.map(({ url, originalName }) => ({ url, originalName }));
          const body = { companyId, taskId, ...party, dateAd: todayIso(), isVat: form.isVat, paymentMethod: form.paymentMethod, notes: form.notes || undefined, items, ...(attachments.length ? { attachments } : {}) };
          created = await (kind === 'sales' ? salesApi : purchaseApi).create(body, cfg());
        }
      } else if (isParty) {
        created = await (kind === 'client' ? clientApi : vendorApi).create({
          companyId, taskId, ...compact({ name: form.name.trim(), phone: form.contact, email: form.email, address: form.address }),
        }, cfg());
      } else {
        created = await employeeApi.create({
          companyId, taskId,
          ...compact({ name: form.name.trim(), employeeId: form.employeeId.trim(), phone: form.phone, email: form.email, department: form.department, designation: form.designation }),
        }, cfg());
      }
      toast({ title: titles[kind], description: t('workflow.savedFor', { defaultValue: 'Saved for task #{{n}}.', n: task.taskNumber ?? '' }) });
      onDone(kind, created?.data);
    } catch (e) {
      toast({ title: t('workflow.error', { defaultValue: 'Error' }), description: apiError(e, t('workflow.couldNotSave', { defaultValue: 'Could not save.' })), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const nameLabel = {
    quotation: t('workflow.qaClientName', { defaultValue: 'Client Name' }),
    sales: t('workflow.qaClientName', { defaultValue: 'Client Name' }),
    purchase: t('workflow.qaVendorName', { defaultValue: 'Vendor Name' }),
    client: t('workflow.qaName', { defaultValue: 'Name' }),
    vendor: t('workflow.qaName', { defaultValue: 'Name' }),
    employee: t('workflow.qaFullName', { defaultValue: 'Full Name' }),
  }[kind];
  const valid = form.name.trim()
    && (kind !== 'employee' || form.employeeId.trim())
    && (!isOrder || items.length > 0)
    && (kind !== 'quotation' || form.quotationNumber.trim());

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn('glass-dialog', isOrder ? 'max-w-2xl' : 'max-w-md')}>
        <DialogHeader>
          <DialogTitle>{titles[kind]}</DialogTitle>
          <p className="text-xs text-muted-foreground">{t('workflow.forTask', { defaultValue: 'For task #{{n}} — {{title}}', n: task.taskNumber ?? '', title: task.title })}</p>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`${nameLabel} *`}>
              {isOrder ? (
                <NameWithSuggestions
                  id={`qa-${kind}-party`}
                  value={form.name}
                  records={records}
                  linked={!!form.linkedId}
                  onChange={(name, rec) => setForm((f) => ({ ...f, name, linkedId: rec?.id ?? null, contact: rec?.phone && !f.contact ? rec.phone : f.contact }))}
                />
              ) : (
                <Input className="h-9 text-sm" value={form.name} onChange={set('name')} />
              )}
            </Field>
            {kind !== 'employee' && (
              <Field label={t('workflow.contact', { defaultValue: 'Contact' })}>
                <Input className="h-9 text-sm" value={form.contact} onChange={set('contact')} placeholder="+977…" />
              </Field>
            )}
            {kind === 'quotation' && (
              <Field label={`${t('workflow.quotationNumber', { defaultValue: 'Quotation No.' })} *`}>
                <Input className="h-9 text-sm" value={form.quotationNumber} onChange={set('quotationNumber')} />
              </Field>
            )}
          </div>

          {kind === 'employee' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`${t('workflow.employeeId', { defaultValue: 'Employee ID' })} *`}><Input className="h-9 text-sm" value={form.employeeId} onChange={set('employeeId')} /></Field>
                <Field label={t('workflow.phone', { defaultValue: 'Phone' })}><Input className="h-9 text-sm" value={form.phone} onChange={set('phone')} /></Field>
                <Field label={t('workflow.department', { defaultValue: 'Department' })}><Input className="h-9 text-sm" value={form.department} onChange={set('department')} /></Field>
                <Field label={t('workflow.designation', { defaultValue: 'Designation' })}><Input className="h-9 text-sm" value={form.designation} onChange={set('designation')} /></Field>
              </div>
              <Field label={t('workflow.email', { defaultValue: 'Email' })}><Input type="email" className="h-9 text-sm" value={form.email} onChange={set('email')} /></Field>
              <p className="text-xs text-muted-foreground">{t('workflow.employeeMoreLater', { defaultValue: 'Salary and other details can be added later in Employees.' })}</p>
            </>
          )}
          {isParty && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('workflow.email', { defaultValue: 'Email' })}><Input type="email" className="h-9 text-sm" value={form.email} onChange={set('email')} /></Field>
              <Field label={t('workflow.address', { defaultValue: 'Address' })}><Input className="h-9 text-sm" value={form.address} onChange={set('address')} /></Field>
            </div>
          )}

          {isOrder && (
            <>
              <LineItems lines={form.lines} onChange={set('lines')} priceKey={kind === 'purchase' ? 'unitPurchasePrice' : 'unitSellingPrice'} />
              <div className="grid items-end gap-3 sm:grid-cols-3">
                {kind !== 'quotation' && (
                  <Field label={t('workflow.paymentMethod', { defaultValue: 'Payment' })}>
                    <Select value={form.paymentMethod} onValueChange={set('paymentMethod')}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">{t('workflow.payCash', { defaultValue: 'Cash' })}</SelectItem>
                        <SelectItem value="BANK_TRANSFER">{t('workflow.payBank', { defaultValue: 'Bank Transfer' })}</SelectItem>
                        <SelectItem value="CHEQUE">{t('workflow.payCheque', { defaultValue: 'Cheque' })}</SelectItem>
                        <SelectItem value="QR">{t('workflow.payQr', { defaultValue: 'QR / Wallet' })}</SelectItem>
                        <SelectItem value="CREDIT">{t('workflow.payCredit', { defaultValue: 'Credit' })}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                <label className="flex h-9 items-center gap-2 text-sm">
                  <Checkbox checked={form.isVat} onCheckedChange={(v) => setForm((f) => ({ ...f, isVat: !!v }))} /> {t('workflow.vat13', { defaultValue: 'VAT 13%' })}
                </label>
                <p className="text-right text-sm font-semibold sm:col-start-3">{t('workflow.total', { defaultValue: 'Total' })}: {fmtNPR(total)}</p>
              </div>
              <Field label={t('workflow.notes', { defaultValue: 'Notes' })}><Input className="h-9 text-sm" value={form.notes} onChange={set('notes')} /></Field>
              {kind !== 'quotation' && (
                <Field label={t('workflow.billScan', { defaultValue: 'Bill scan (saved to Memo)' })}>
                  <FileAttachmentZone files={form.files} onChange={set('files')} maxFiles={5} label={t('workflow.attachBill', { defaultValue: 'Attach bill' })} />
                </Field>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('workflow.cancel', { defaultValue: 'Cancel' })}</Button>
          <Button onClick={submit} disabled={!valid || saving}>{saving ? t('workflow.saving', { defaultValue: 'Saving…' }) : t('workflow.save', { defaultValue: 'Save' })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Connected records ───────────────────────────────────────────────────────

const KIND_META = {
  TASK_CREATED: { icon: CheckCircle2, to: null },
  QUOTATION: { icon: FileSpreadsheet, to: '/quotations' },
  PURCHASE: { icon: ShoppingCart, to: '/purchase' },
  SALE: { icon: Receipt, to: '/sales' },
  PAYMENT: { icon: Wallet, to: '/sales' },
  CLIENT: { icon: UserPlus, to: '/clients' },
  VENDOR: { icon: Truck, to: '/vendors' },
  EMPLOYEE: { icon: BadgePlus, to: '/employees' },
  DOCUMENT: { icon: Paperclip, to: '/memo' },
};

function kindLabel(t, kind) {
  return {
    TASK_CREATED: t('workflow.evTaskCreated', { defaultValue: 'Job created' }),
    QUOTATION: t('workflow.evQuotation', { defaultValue: 'Quotation' }),
    PURCHASE: t('workflow.evPurchase', { defaultValue: 'Purchase' }),
    SALE: t('workflow.evSale', { defaultValue: 'Sales bill' }),
    PAYMENT: t('workflow.evPayment', { defaultValue: 'Payment received' }),
    CLIENT: t('workflow.evClient', { defaultValue: 'Client added' }),
    VENDOR: t('workflow.evVendor', { defaultValue: 'Vendor added' }),
    EMPLOYEE: t('workflow.evEmployee', { defaultValue: 'Employee added' }),
    DOCUMENT: t('workflow.evDocument', { defaultValue: 'Document' }),
  }[kind] || kind;
}

function ConnectedRecords({ links, loading }) {
  const { t } = useTranslation();
  if (loading && !links) return <p className="text-xs text-muted-foreground">{t('workflow.loading', { defaultValue: 'Loading…' })}</p>;
  if (!links) return null;
  const s = links.summary;
  const people = [
    links.client && { label: t('tasks.partyClient', { defaultValue: 'Client' }), rec: links.client, to: '/clients' },
    links.vendor && { label: t('tasks.partyVendor', { defaultValue: 'Vendor' }), rec: links.vendor, to: '/vendors' },
    links.partyEmployee && { label: t('tasks.partyEmployee', { defaultValue: 'Employee' }), rec: links.partyEmployee, to: '/employees' },
    links.assignedEmployee && { label: t('workflow.assignedTo', { defaultValue: 'Assigned To' }), rec: links.assignedEmployee, to: '/employees' },
  ].filter(Boolean);
  const stat = (label, value, tone) => (
    <div className="rounded-md border border-border px-2 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn('text-xs font-semibold', tone)}>{fmtNPR(value)}</p>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {stat(t('workflow.quoted', { defaultValue: 'Quoted' }), s.quoted)}
        {stat(t('workflow.billed', { defaultValue: 'Billed' }), s.billed)}
        {stat(t('workflow.received', { defaultValue: 'Received' }), s.received, 'text-emerald-700 dark:text-emerald-400')}
        {stat(t('workflow.outstanding', { defaultValue: 'Still to receive' }), s.outstanding, s.outstanding > 0 ? 'text-amber-700 dark:text-amber-400' : undefined)}
        {stat(t('workflow.purchaseCost', { defaultValue: 'Purchase cost' }), s.purchaseCost)}
        {stat(t('workflow.margin', { defaultValue: 'Margin' }), s.margin, s.margin < 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400')}
      </div>

      {people.length > 0 && (
        <div className="space-y-1">
          {people.map(({ label, rec, to }) => (
            <Link key={label} to={to} className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted/40">
              <span><span className="text-muted-foreground">{label}:</span> <span className="font-medium">{rec.name}</span>{rec.phone ? ` · ${rec.phone}` : ''}</span>
              <Link2 className="h-3 w-3 text-emerald-600" />
            </Link>
          ))}
        </div>
      )}

      <ol className="relative space-y-2 border-l border-border pl-4">
        {links.timeline.map((e) => {
          const meta = KIND_META[e.kind] || {};
          const Icon = meta.icon || Clock;
          const body = (
            <>
              <span className="absolute -left-[9px] mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background">
                <Icon className="h-2.5 w-2.5 text-muted-foreground" />
              </span>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium">{kindLabel(t, e.kind)}{e.status ? <span className="ml-1 text-[10px] font-normal text-muted-foreground">({e.status.replace('_', ' ').toLowerCase()})</span> : null}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{e.label}</p>
                </div>
                <div className="shrink-0 text-right">
                  {e.amount != null && <p className="font-mono text-xs">{fmtNPR(e.amount)}</p>}
                  <p className="text-[10px] text-muted-foreground">{fmtDate(e.at)}</p>
                </div>
              </div>
            </>
          );
          return (
            <li key={`${e.kind}-${e.id}`} className="relative">
              {meta.to ? <Link to={meta.to} className="block rounded-md px-1 hover:bg-muted/40">{body}</Link> : <div className="px-1">{body}</div>}
            </li>
          );
        })}
      </ol>

      {links.documents.length > 0 && (
        <div className="space-y-1">
          {links.documents.map((m) => (
            <div key={m.id} className="rounded-md border border-border p-2 text-xs">
              <p className="mb-1 font-medium">{memoFolderLabel(t, m.category)}</p>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(m.attachments) && m.attachments.length ? m.attachments : [m.documentUrl]).filter(Boolean).map((url, i) => (
                  <a key={url} href={fileUrl(url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <FileText className="h-3 w-3" />{t('workflow.file', { defaultValue: 'File' })} {i + 1}<ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Detail panel ────────────────────────────────────────────────────────────

function TaskPanel({ task, onClose, onSaved, onDeleted, onLinksChanged }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const dir = useContext(DirectoryContext);
  const { canCreate, canManageEmployees, canEdit } = useRole();
  const [draft, setDraft] = useState(task);
  const [saving, setSaving] = useState(false);
  const [links, setLinks] = useState(null);
  const [linksLoading, setLinksLoading] = useState(false);
  const [newFiles, setNewFiles] = useState([]);
  const [action, setAction] = useState(null);

  const loadLinks = useCallback(async () => {
    setLinksLoading(true);
    try { setLinks((await taskApi.links(task.id)).data); } catch { setLinks(null); } finally { setLinksLoading(false); }
  }, [task.id]);

  useEffect(() => { setDraft(task); setNewFiles([]); loadLinks(); }, [task, loadLinks]);

  async function save() {
    if (!draft.title?.trim()) return;
    setSaving(true);
    try {
      const saved = (await taskApi.update(task.id, toTaskPayload(draft))).data;
      if (newFiles.length) await saveTaskDocuments(saved, newFiles);
      toast({ title: t('workflow.taskUpdatedTitle', { defaultValue: 'Task updated' }), description: `#${saved.taskNumber} ${saved.title}` });
      onSaved(saved);
    } catch (e) {
      toast({ title: t('workflow.error', { defaultValue: 'Error' }), description: apiError(e, t('workflow.couldNotSaveTask', { defaultValue: 'Could not save task.' })), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(t('workflow.confirmDelete', { defaultValue: 'Move this task to the recycle bin?' }))) return;
    try {
      await taskApi.remove(task.id);
      onDeleted(task.id);
    } catch (e) {
      toast({ title: t('workflow.error', { defaultValue: 'Error' }), description: apiError(e, 'Could not delete.'), variant: 'destructive' });
    }
  }

  // After a quick action: refresh the job's links; a newly created client or
  // vendor becomes the job's party when the job has none yet.
  async function handleActionDone(kind, created) {
    setAction(null);
    dir.reload();
    const partyType = kind === 'client' ? 'CLIENT' : kind === 'vendor' ? 'VENDOR' : null;
    if (partyType && created?.id && !draft.partyId) {
      try {
        const saved = (await taskApi.update(task.id, { partyType, partyId: created.id, partyName: created.name, partyContact: created.phone || draft.partyContact || null })).data;
        setDraft((d) => ({ ...d, partyType, partyId: created.id, partyName: created.name, partyContact: saved.partyContact }));
        onLinksChanged(saved);
      } catch { /* the record is still linked via taskId */ }
    } else {
      onLinksChanged();
    }
    loadLinks();
  }

  const actions = [
    canCreate && { kind: 'quotation', icon: FileSpreadsheet },
    canCreate && { kind: 'purchase', icon: ShoppingCart },
    canCreate && { kind: 'sales', icon: Receipt },
    canCreate && { kind: 'client', icon: UserPlus },
    canCreate && { kind: 'vendor', icon: Truck },
    canManageEmployees && { kind: 'employee', icon: BadgePlus },
  ].filter(Boolean);
  const titles = ACTION_TITLES(t);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[520px] flex-col border-l border-border bg-background shadow-2xl">
        <header className="flex items-start justify-between border-b border-border p-5">
          <div className="pr-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              #{task.taskNumber ?? '—'} · {workflowTypeLabel(t, task.workflowType)}
            </p>
            <h2 className="text-base font-bold leading-snug">{task.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('workflow.assignedOn', { defaultValue: 'Assigned' })} {fmtDate(task.createdAt)}{task.assignedBy ? ` · ${task.assignedBy}` : ''}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}><X className="h-4 w-4" /></Button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {actions.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('workflow.quickActions', { defaultValue: 'Quick Actions' })}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {actions.map(({ kind, icon: Icon }) => (
                  <Button key={kind} variant="outline" size="sm" className="h-9 justify-start gap-1.5 text-xs" onClick={() => setAction(kind)}>
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{titles[kind]}
                  </Button>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" />{t('workflow.connectedRecords', { defaultValue: 'Connected records' })}
            </p>
            <ConnectedRecords links={links} loading={linksLoading} />
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('workflow.jobDetails', { defaultValue: 'Job details' })}</p>
            <TaskFields value={draft} onChange={setDraft} />
          </section>

          <section className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" />{t('workflow.addDocuments', { defaultValue: 'Add documents' })}
            </p>
            <DocumentPicker files={newFiles} onChange={setNewFiles} defaultFolder={defaultMemoFolder(draft.workflowType)} />
          </section>
        </div>

        <footer className="flex gap-2 border-t border-border p-5">
          {canEdit && (
            <Button variant="outline" size="icon" onClick={remove} title={t('workflow.delete', { defaultValue: 'Delete' })}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          )}
          <Button className="flex-1 gap-2" onClick={save} disabled={saving || !draft.title?.trim()}>
            <CheckCircle2 className="h-4 w-4" />
            {saving ? t('workflow.saving', { defaultValue: 'Saving…' }) : t('workflow.saveChanges', { defaultValue: 'Save Changes' })}
          </Button>
        </footer>
      </aside>
      {action && <QuickActionDialog kind={action} task={draft} onClose={() => setAction(null)} onDone={handleActionDone} />}
    </>
  );
}

// ─── New task ────────────────────────────────────────────────────────────────

function NewTaskDialog({ open, onOpenChange, onCreated, initialType }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_TASK);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setForm({ ...EMPTY_TASK, workflowType: initialType || 'JOB_CARD' }); setFiles([]); }
  }, [open, initialType]);

  async function create() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const created = (await taskApi.create(toTaskPayload(form))).data;
      if (files.length) {
        await saveTaskDocuments(created, files).catch(() => toast({
          title: t('workflow.attachmentsNotSaved', { defaultValue: 'Attachments not saved' }),
          description: t('workflow.attachmentsNotSavedDesc', { defaultValue: 'The task was created, but its files could not be saved. Open the task and attach them again.' }),
          variant: 'destructive',
        }));
      }
      onCreated({ ...created, linkCounts: { quotations: 0, sales: 0, purchases: 0, documents: files.length ? 1 : 0 } });
      onOpenChange(false);
      toast({ title: t('workflow.taskCreatedTitle', { defaultValue: 'Task created' }), description: `#${created.taskNumber} ${created.title}` });
    } catch (e) {
      toast({ title: t('workflow.error', { defaultValue: 'Error' }), description: apiError(e, t('workflow.couldNotCreateTask', { defaultValue: 'Could not create task.' })), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-dialog max-w-3xl">
        <DialogHeader><DialogTitle>{t('workflow.newTask', { defaultValue: 'New Task' })}</DialogTitle></DialogHeader>
        <div className="grid max-h-[68vh] gap-6 overflow-y-auto pr-1 md:grid-cols-[3fr_2fr]">
          <TaskFields value={form} onChange={setForm} />
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" />{t('workflow.documents', { defaultValue: 'Documents' })}
            </p>
            <DocumentPicker files={files} onChange={setFiles} defaultFolder={defaultMemoFolder(form.workflowType)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('workflow.cancel', { defaultValue: 'Cancel' })}</Button>
          <Button onClick={create} disabled={!form.title.trim() || saving}>
            {saving ? t('workflow.creating', { defaultValue: 'Creating…' }) : t('workflow.createTask', { defaultValue: 'Create Task' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Workflow() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { canCreate } = useRole();
  const directory = useDirectoryLoader();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [typeFilter, setTypeFilter] = useState(null);
  const [search, setSearch] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setTasks(rows(await taskApi.list()));
    } catch {
      toast({ title: t('workflow.error', { defaultValue: 'Error' }), description: t('workflow.couldNotLoadTasks', { defaultValue: 'Could not load tasks.' }), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (typeFilter && task.workflowType !== typeFilter) return false;
      if (!q) return true;
      return [task.title, task.assignedName, task.assignedTo, task.partyName, task.department, `#${task.taskNumber}`]
        .some((v) => String(v ?? '').toLowerCase().includes(q));
    });
  }, [tasks, typeFilter, search]);

  const columns = showCancelled ? TASK_STATUSES : TASK_STATUSES.filter((s) => s !== 'CANCELLED');
  const byDue = (a, b) => (a.dueDate ? new Date(a.dueDate) : Infinity) - (b.dueDate ? new Date(b.dueDate) : Infinity);
  const counts = (type) => tasks.filter((x) => x.workflowType === type).length;
  const replaceTask = (saved) => setTasks((prev) => prev.map((x) => (x.id === saved.id ? { ...x, ...saved } : x)));

  return (
    <DirectoryContext.Provider value={directory}>
      <div className="space-y-4">
        <PageHeader
          title={t('workflow.pageTitle', { defaultValue: 'Workflow' })}
          subtitle={t('workflow.pageSubtitle', { defaultValue: 'Job cards, order slips and team tasks in one place' })}
        >
          {canCreate && (
            <Button onClick={() => setShowNew(true)} className="gap-2"><Plus className="h-4 w-4" />{t('workflow.newTask', { defaultValue: 'New Task' })}</Button>
          )}
        </PageHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <button
            type="button"
            onClick={() => setTypeFilter(null)}
            className={cn('rounded-lg border p-3 text-left', !typeFilter ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}
          >
            <p className="text-xl font-bold">{tasks.length}</p>
            <p className="text-[11px]">{t('workflow.allTasks', { defaultValue: 'All tasks' })}</p>
          </button>
          {WORKFLOW_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter((cur) => (cur === type ? null : type))}
              className={cn('rounded-lg border p-3 text-left', typeFilter === type ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}
            >
              <p className="text-xl font-bold">{counts(type)}</p>
              <p className="text-[11px]">{workflowTypeLabel(t, type)}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 pl-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('workflow.searchPlaceholder', { defaultValue: 'Search number, title, person…' })} />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={showCancelled} onCheckedChange={(v) => setShowCancelled(!!v)} />
            {t('workflow.showCancelled', { defaultValue: 'Show cancelled' })}
          </label>
        </div>

        {loading ? (
          <PageLoader />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={t('workflow.noTasksYet', { defaultValue: 'No tasks yet' })}
            description={t('workflow.noTasksYetHint', { defaultValue: 'Create a job card or order slip to start tracking work.' })}
            action={canCreate ? <Button onClick={() => setShowNew(true)} className="gap-2"><Plus className="h-4 w-4" />{t('workflow.newTask', { defaultValue: 'New Task' })}</Button> : null}
          />
        ) : (
          <div className={cn('grid items-start gap-4 md:grid-cols-2', showCancelled ? 'xl:grid-cols-4' : 'xl:grid-cols-3')}>
            {columns.map((status) => {
              const items = visible.filter((x) => x.status === status).sort(byDue);
              return (
                <section key={status} className="min-w-0">
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span className={cn('h-2 w-2 rounded-full', COLUMN_DOT[status])} />
                    <span className="text-sm font-semibold">{statusLabel(t, status)}</span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="min-h-[160px] space-y-2 rounded-lg bg-muted/20 p-2">
                    {items.length === 0
                      ? <p className="py-8 text-center text-xs text-muted-foreground">{t('workflow.noTasks', { defaultValue: 'No tasks' })}</p>
                      : items.map((task) => <TaskNote key={task.id} task={task} onClick={setSelected} />)}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {selected && (
          <TaskPanel
            task={selected}
            onClose={() => setSelected(null)}
            onSaved={(saved) => { replaceTask(saved); setSelected(null); load(true); }}
            onDeleted={(id) => { setTasks((prev) => prev.filter((x) => x.id !== id)); setSelected(null); }}
            onLinksChanged={(saved) => { if (saved) replaceTask(saved); load(true); }}
          />
        )}

        <NewTaskDialog
          open={showNew}
          onOpenChange={setShowNew}
          initialType={typeFilter || 'JOB_CARD'}
          onCreated={(created) => setTasks((prev) => [created, ...prev])}
        />
      </div>
    </DirectoryContext.Provider>
  );
}
