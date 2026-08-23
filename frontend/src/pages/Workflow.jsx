import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { taskApi, salesApi, purchaseApi, clientApi, vendorApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, X, Calendar, User, Tag, AlertCircle, CheckCircle2, Clock, Pencil, FileText, Paperclip } from 'lucide-react';
import { FileAttachmentZone } from '@/components/ui/file-attachment-zone';
import { memoApi } from '@/api';
import { useToast } from "@/components/ui/use-toast";
import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';
import { motion } from 'framer-motion';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ['General', 'Finance', 'HR', 'Operations', 'Marketing', 'Sales', 'Admin', 'Legal'];

const CATEGORY_COLORS = {
  Finance: 'bg-blue-100 text-blue-700',
  HR: 'bg-purple-100 text-purple-700',
  Operations: 'bg-orange-100 text-orange-700',
  Marketing: 'bg-pink-100 text-pink-700',
  Sales: 'bg-green-100 text-green-700',
  Admin: 'bg-gray-100 text-gray-700',
  Legal: 'bg-red-100 text-red-700',
  General: 'bg-slate-100 text-slate-700',
};

const PRIORITY_STRIPE = {
  High: 'bg-red-500',
  Medium: 'bg-amber-500',
  Low: 'bg-green-500',
};

const PRIORITY_BADGE = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-green-100 text-green-700',
};

const EMPTY_FORM = {
  title: '',
  description: '',
  category: 'General',
  priority: 'Medium',
  status: 'Pending',
  due_date: '',
  assigned_to: '',
  attachments: [],
};

const COLUMNS = [
  { key: 'Pending', dotColor: 'bg-gray-400' },
  { key: 'In Progress', dotColor: 'bg-blue-500' },
  { key: 'Done', dotColor: 'bg-green-500' },
];

// ─── i18n label helpers ──────────────────────────────────────────────────────
// These take `t` as a plain argument (not a hook call), so they're safe to
// call from anywhere, including outside component bodies.

function categoryLabel(t, category) {
  const map = {
    General: t('workflow.categoryGeneral', { defaultValue: 'General' }),
    Finance: t('workflow.categoryFinance', { defaultValue: 'Finance' }),
    HR: t('workflow.categoryHr', { defaultValue: 'HR' }),
    Operations: t('workflow.categoryOperations', { defaultValue: 'Operations' }),
    Marketing: t('workflow.categoryMarketing', { defaultValue: 'Marketing' }),
    Sales: t('workflow.categorySales', { defaultValue: 'Sales' }),
    Admin: t('workflow.categoryAdmin', { defaultValue: 'Admin' }),
    Legal: t('workflow.categoryLegal', { defaultValue: 'Legal' }),
  };
  return map[category] || category;
}

function priorityLabel(t, priority) {
  const map = {
    High: t('workflow.priorityHigh', { defaultValue: 'High' }),
    Medium: t('workflow.priorityMedium', { defaultValue: 'Medium' }),
    Low: t('workflow.priorityLow', { defaultValue: 'Low' }),
  };
  return map[priority] || priority;
}

function statusLabel(t, status) {
  const map = {
    Pending: t('workflow.columnPending', { defaultValue: 'Pending' }),
    'In Progress': t('workflow.columnInProgress', { defaultValue: 'In Progress' }),
    Done: t('workflow.columnDone', { defaultValue: 'Done' }),
  };
  return map[status] || status;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

// ─── KanbanCard ──────────────────────────────────────────────────────────────

function KanbanCard({ task, onClick }) {
  const { t } = useTranslation();
  const overdue = isOverdue(task.due_date);

  return (
    <div
      className="bg-card border border-border rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow group relative"
      onClick={() => onClick(task)}
    >
      {/* Priority stripe */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-lg', PRIORITY_STRIPE[task.priority] || 'bg-gray-300')} />

      <div className="pl-3">
        {/* Title */}
        <p className="font-semibold text-sm leading-snug mb-2 pr-1">{task.title}</p>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1 mb-2">
          {task.category && (
            <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium', CATEGORY_COLORS[task.category] || CATEGORY_COLORS.General)}>
              {categoryLabel(t, task.category)}
            </span>
          )}
          {task.priority && (
            <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium', PRIORITY_BADGE[task.priority] || '')}>
              {priorityLabel(t, task.priority)}
            </span>
          )}
        </div>

        {/* Due date */}
        {task.due_date && (
          <div className={cn('flex items-center gap-1 text-xs mb-1.5', overdue ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
            <Calendar className="w-3 h-3 shrink-0" />
            <span>{formatDate(task.due_date)}{overdue ? ` · ${t('workflow.overdue', { defaultValue: 'Overdue' })}` : ''}</span>
          </div>
        )}

        {/* Assigned to */}
        {task.assigned_to && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
            <User className="w-3 h-3 shrink-0" />
            <span className="truncate">{task.assigned_to}</span>
          </div>
        )}

        {/* Description */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

function KanbanColumn({ title, dotColor, tasks, onCardClick, onAddNew }) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', dotColor)} />
          <span className="font-semibold text-sm">{title}</span>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={onAddNew}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      <div className="space-y-2 min-h-[200px] bg-muted/20 rounded-lg p-2">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">{t('workflow.noTasks', { defaultValue: 'No tasks' })}</div>
        ) : (
          tasks.map(task => (
            <KanbanCard key={task.id} task={task} onClick={onCardClick} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── SlideOutPanel ────────────────────────────────────────────────────────────

const EMPTY_SALES = { client_name: '', invoice_number: '', date: '', amount: '', notes: '' };
const EMPTY_PURCHASE = { vendor_name: '', order_number: '', date: '', amount: '', notes: '' };
const EMPTY_CLIENT = { name: '', phone: '', email: '', address: '' };
const EMPTY_VENDOR = { name: '', phone: '', email: '', address: '' };

function SlideOutPanel({ task, onClose, onSave }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Quick-action dialog state
  const [salesDialog, setSalesDialog] = useState(false);
  const [purchaseDialog, setPurchaseDialog] = useState(false);
  const [clientDialog, setClientDialog] = useState(false);
  const [vendorDialog, setVendorDialog] = useState(false);

  const [salesForm, setSalesForm] = useState(EMPTY_SALES);
  const [purchaseForm, setPurchaseForm] = useState(EMPTY_PURCHASE);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT);
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR);

  const [qaSubmitting, setQaSubmitting] = useState(false);

  useEffect(() => {
    if (task) {
      setEditing({ ...task });
      setSalesForm(f => ({ ...EMPTY_SALES, ...f, notes: task.title || '' }));
      setPurchaseForm(f => ({ ...EMPTY_PURCHASE, ...f, notes: task.title || '' }));
    } else {
      setEditing(null);
    }
  }, [task]);

  // Reset forms when dialogs open so pre-fill is fresh
  function openSalesDialog() {
    setSalesForm({ ...EMPTY_SALES, notes: task?.title || '' });
    setSalesDialog(true);
  }
  function openPurchaseDialog() {
    setPurchaseForm({ ...EMPTY_PURCHASE, notes: task?.title || '' });
    setPurchaseDialog(true);
  }
  function openClientDialog() {
    setClientForm({ ...EMPTY_CLIENT });
    setClientDialog(true);
  }
  function openVendorDialog() {
    setVendorForm({ ...EMPTY_VENDOR });
    setVendorDialog(true);
  }

  if (!editing) return null;

  async function handleSave() {
    setSaving(true);
    await onSave(editing);
    setSaving(false);
  }

  async function handleCreateSales() {
    setQaSubmitting(true);
    try {
      const companyId = getActiveCompanyId();
      const amount = parseFloat(salesForm.amount) || 0;
      await salesApi.create({
        client_name: salesForm.client_name,
        invoice_number: salesForm.invoice_number,
        date_ad: salesForm.date,
        items: [{ description: editing.title, quantity: 1, unit: 'pcs', unit_price: amount, total: amount }],
        companyId,
        payment_type: 'cash',
        is_vat: false,
        notes: salesForm.notes,
        labor_items: [],
      });
      setSalesDialog(false);
      toast({
        title: t('workflow.salesBillCreatedTitle', { defaultValue: 'Sales bill created' }),
        description: t('workflow.salesBillCreatedDesc', { defaultValue: 'Bill for "{{name}}" created.', name: salesForm.client_name }),
      });
    } catch {
      toast({
        title: t('workflow.error', { defaultValue: 'Error' }),
        description: t('workflow.couldNotCreateSalesBill', { defaultValue: 'Could not create sales bill.' }),
        variant: 'destructive',
      });
    } finally {
      setQaSubmitting(false);
    }
  }

  async function handleCreatePurchase() {
    setQaSubmitting(true);
    try {
      const companyId = getActiveCompanyId();
      const amount = parseFloat(purchaseForm.amount) || 0;
      await purchaseApi.create({
        vendor_name: purchaseForm.vendor_name,
        order_number: purchaseForm.order_number,
        date_ad: purchaseForm.date,
        items: [{ description: editing.title, quantity: 1, unit: 'pcs', unit_price: amount, total: amount }],
        companyId,
        payment_type: 'cash',
        is_vat: false,
        notes: purchaseForm.notes,
        labor_items: [],
      });
      setPurchaseDialog(false);
      toast({
        title: t('workflow.purchaseCreatedTitle', { defaultValue: 'Purchase created' }),
        description: t('workflow.purchaseCreatedDesc', { defaultValue: 'Purchase from "{{name}}" created.', name: purchaseForm.vendor_name }),
      });
    } catch {
      toast({
        title: t('workflow.error', { defaultValue: 'Error' }),
        description: t('workflow.couldNotCreatePurchase', { defaultValue: 'Could not create purchase.' }),
        variant: 'destructive',
      });
    } finally {
      setQaSubmitting(false);
    }
  }

  async function handleCreateClient() {
    setQaSubmitting(true);
    try {
      const companyId = getActiveCompanyId();
      await clientApi.create({ ...clientForm, companyId });
      setClientDialog(false);
      toast({
        title: t('workflow.clientAddedTitle', { defaultValue: 'Client added' }),
        description: t('workflow.clientAddedDesc', { defaultValue: '"{{name}}" added as a client.', name: clientForm.name }),
      });
    } catch {
      toast({
        title: t('workflow.error', { defaultValue: 'Error' }),
        description: t('workflow.couldNotAddClient', { defaultValue: 'Could not add client.' }),
        variant: 'destructive',
      });
    } finally {
      setQaSubmitting(false);
    }
  }

  async function handleCreateVendor() {
    setQaSubmitting(true);
    try {
      const companyId = getActiveCompanyId();
      await vendorApi.create({ ...vendorForm, companyId });
      setVendorDialog(false);
      toast({
        title: t('workflow.vendorAddedTitle', { defaultValue: 'Vendor added' }),
        description: t('workflow.vendorAddedDesc', { defaultValue: '"{{name}}" added as a vendor.', name: vendorForm.name }),
      });
    } catch {
      toast({
        title: t('workflow.error', { defaultValue: 'Error' }),
        description: t('workflow.couldNotAddVendor', { defaultValue: 'Could not add vendor.' }),
        variant: 'destructive',
      });
    } finally {
      setQaSubmitting(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          'fixed right-0 top-0 h-screen w-[420px] bg-background border-l border-border shadow-2xl z-50 transition-transform duration-300 flex flex-col',
          task ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
          <div className="flex-1 pr-4">
            <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">{t('workflow.taskDetail', { defaultValue: 'Task Detail' })}</p>
            <h2 className="font-bold text-base leading-snug">{editing.title}</h2>
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Status + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> {t('workflow.status', { defaultValue: 'Status' })}
              </Label>
              <Select
                value={editing.status}
                onValueChange={v => setEditing(e => ({ ...e, status: v }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">{statusLabel(t, 'Pending')}</SelectItem>
                  <SelectItem value="In Progress">{statusLabel(t, 'In Progress')}</SelectItem>
                  <SelectItem value="Done">{statusLabel(t, 'Done')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" /> {t('workflow.priority', { defaultValue: 'Priority' })}
              </Label>
              <Select
                value={editing.priority}
                onValueChange={v => setEditing(e => ({ ...e, priority: v }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">{priorityLabel(t, 'High')}</SelectItem>
                  <SelectItem value="Medium">{priorityLabel(t, 'Medium')}</SelectItem>
                  <SelectItem value="Low">{priorityLabel(t, 'Low')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Tag className="w-3 h-3" /> {t('workflow.category', { defaultValue: 'Category' })}
            </Label>
            <span className={cn('inline-block text-xs px-2.5 py-1 rounded-md font-medium', CATEGORY_COLORS[editing.category] || CATEGORY_COLORS.General)}>
              {categoryLabel(t, editing.category || 'General')}
            </span>
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> {t('workflow.dueDate', { defaultValue: 'Due Date' })}
            </Label>
            <Input
              type="date"
              className="h-9 text-sm"
              value={editing.due_date || ''}
              onChange={e => setEditing(ed => ({ ...ed, due_date: e.target.value }))}
            />
            {editing.due_date && isOverdue(editing.due_date) && (
              <p className="text-xs text-red-500 font-medium">{t('workflow.taskOverdue', { defaultValue: 'This task is overdue.' })}</p>
            )}
          </div>

          {/* Assigned to */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <User className="w-3 h-3" /> {t('workflow.assignedTo', { defaultValue: 'Assigned To' })}
            </Label>
            <Input
              className="h-9 text-sm"
              placeholder={t('workflow.nameOrEmailPlaceholder', { defaultValue: 'Name or email...' })}
              value={editing.assigned_to || ''}
              onChange={e => setEditing(ed => ({ ...ed, assigned_to: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('workflow.description', { defaultValue: 'Description' })}</Label>
            <Textarea
              className="text-sm resize-none"
              rows={4}
              placeholder={t('workflow.addDetailsPlaceholder', { defaultValue: 'Add details about this task...' })}
              value={editing.description || ''}
              onChange={e => setEditing(ed => ({ ...ed, description: e.target.value }))}
            />
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('workflow.quickActions', { defaultValue: 'Quick Actions' })}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-1.5 text-xs font-medium h-9"
                onClick={openSalesDialog}
              >
                <Plus className="w-3 h-3 shrink-0 text-muted-foreground" />
                {t('workflow.createSalesBill', { defaultValue: 'Create Sales Bill' })}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-1.5 text-xs font-medium h-9"
                onClick={openPurchaseDialog}
              >
                <Plus className="w-3 h-3 shrink-0 text-muted-foreground" />
                {t('workflow.createPurchase', { defaultValue: 'Create Purchase' })}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-1.5 text-xs font-medium h-9"
                onClick={openClientDialog}
              >
                <Plus className="w-3 h-3 shrink-0 text-muted-foreground" />
                {t('workflow.addClient', { defaultValue: 'Add Client' })}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-1.5 text-xs font-medium h-9"
                onClick={openVendorDialog}
              >
                <Plus className="w-3 h-3 shrink-0 text-muted-foreground" />
                {t('workflow.addVendor', { defaultValue: 'Add Vendor' })}
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border shrink-0">
          <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
            <CheckCircle2 className="w-4 h-4" />
            {saving ? t('workflow.saving', { defaultValue: 'Saving…' }) : t('workflow.saveChanges', { defaultValue: 'Save Changes' })}
          </Button>
        </div>
      </div>

      {/* ── Create Sales Bill Dialog ── */}
      <Dialog open={salesDialog} onOpenChange={setSalesDialog}>
        <DialogContent className="glass-dialog max-w-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500 -mx-6 -mt-6 mb-4 rounded-t-lg" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              {t('workflow.createSalesBill', { defaultValue: 'Create Sales Bill' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.clientName', { defaultValue: 'Client Name' })} <span className="text-red-500">*</span></Label>
              <Input
                className="h-9 text-sm"
                placeholder={t('workflow.clientNamePlaceholder', { defaultValue: 'Client name...' })}
                value={salesForm.client_name}
                onChange={e => setSalesForm(f => ({ ...f, client_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.invoiceNumber', { defaultValue: 'Invoice Number' })}</Label>
              <Input
                className="h-9 text-sm"
                placeholder="INV-001..."
                value={salesForm.invoice_number}
                onChange={e => setSalesForm(f => ({ ...f, invoice_number: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.date', { defaultValue: 'Date' })}</Label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={salesForm.date}
                onChange={e => setSalesForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.amount', { defaultValue: 'Amount' })}</Label>
              <Input
                type="number"
                className="h-9 text-sm"
                placeholder="0.00"
                value={salesForm.amount}
                onChange={e => setSalesForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.notes', { defaultValue: 'Notes' })}</Label>
              <Textarea
                className="text-sm resize-none"
                rows={3}
                placeholder={t('workflow.notesPlaceholder', { defaultValue: 'Notes...' })}
                value={salesForm.notes}
                onChange={e => setSalesForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setSalesDialog(false)}>{t('workflow.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={handleCreateSales} disabled={!salesForm.client_name.trim() || qaSubmitting}>
              {qaSubmitting ? t('workflow.creating', { defaultValue: 'Creating…' }) : t('workflow.createBill', { defaultValue: 'Create Bill' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Purchase Dialog ── */}
      <Dialog open={purchaseDialog} onOpenChange={setPurchaseDialog}>
        <DialogContent className="glass-dialog max-w-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500 -mx-6 -mt-6 mb-4 rounded-t-lg" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              {t('workflow.createPurchase', { defaultValue: 'Create Purchase' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.vendorName', { defaultValue: 'Vendor Name' })} <span className="text-red-500">*</span></Label>
              <Input
                className="h-9 text-sm"
                placeholder={t('workflow.vendorNamePlaceholder', { defaultValue: 'Vendor name...' })}
                value={purchaseForm.vendor_name}
                onChange={e => setPurchaseForm(f => ({ ...f, vendor_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.orderNumber', { defaultValue: 'Order Number' })}</Label>
              <Input
                className="h-9 text-sm"
                placeholder="PO-001..."
                value={purchaseForm.order_number}
                onChange={e => setPurchaseForm(f => ({ ...f, order_number: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.date', { defaultValue: 'Date' })}</Label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={purchaseForm.date}
                onChange={e => setPurchaseForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.amount', { defaultValue: 'Amount' })}</Label>
              <Input
                type="number"
                className="h-9 text-sm"
                placeholder="0.00"
                value={purchaseForm.amount}
                onChange={e => setPurchaseForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.notes', { defaultValue: 'Notes' })}</Label>
              <Textarea
                className="text-sm resize-none"
                rows={3}
                placeholder={t('workflow.notesPlaceholder', { defaultValue: 'Notes...' })}
                value={purchaseForm.notes}
                onChange={e => setPurchaseForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setPurchaseDialog(false)}>{t('workflow.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={handleCreatePurchase} disabled={!purchaseForm.vendor_name.trim() || qaSubmitting}>
              {qaSubmitting ? t('workflow.creating', { defaultValue: 'Creating…' }) : t('workflow.createPurchase', { defaultValue: 'Create Purchase' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Client Dialog ── */}
      <Dialog open={clientDialog} onOpenChange={setClientDialog}>
        <DialogContent className="glass-dialog max-w-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500 -mx-6 -mt-6 mb-4 rounded-t-lg" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-amber-500" />
              {t('workflow.addClient', { defaultValue: 'Add Client' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.name', { defaultValue: 'Name' })} <span className="text-red-500">*</span></Label>
              <Input
                className="h-9 text-sm"
                placeholder={t('workflow.clientNamePlaceholder', { defaultValue: 'Client name...' })}
                value={clientForm.name}
                onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.phone', { defaultValue: 'Phone' })}</Label>
              <Input
                className="h-9 text-sm"
                placeholder="+977..."
                value={clientForm.phone}
                onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.email', { defaultValue: 'Email' })}</Label>
              <Input
                type="email"
                className="h-9 text-sm"
                placeholder="client@example.com"
                value={clientForm.email}
                onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.address', { defaultValue: 'Address' })}</Label>
              <Input
                className="h-9 text-sm"
                placeholder={t('workflow.addressPlaceholder', { defaultValue: 'Address...' })}
                value={clientForm.address}
                onChange={e => setClientForm(f => ({ ...f, address: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setClientDialog(false)}>{t('workflow.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={handleCreateClient} disabled={!clientForm.name.trim() || qaSubmitting}>
              {qaSubmitting ? t('workflow.adding', { defaultValue: 'Adding…' }) : t('workflow.addClient', { defaultValue: 'Add Client' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Vendor Dialog ── */}
      <Dialog open={vendorDialog} onOpenChange={setVendorDialog}>
        <DialogContent className="glass-dialog max-w-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500 -mx-6 -mt-6 mb-4 rounded-t-lg" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-amber-500" />
              {t('workflow.addVendor', { defaultValue: 'Add Vendor' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.name', { defaultValue: 'Name' })} <span className="text-red-500">*</span></Label>
              <Input
                className="h-9 text-sm"
                placeholder={t('workflow.vendorNamePlaceholder', { defaultValue: 'Vendor name...' })}
                value={vendorForm.name}
                onChange={e => setVendorForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.phone', { defaultValue: 'Phone' })}</Label>
              <Input
                className="h-9 text-sm"
                placeholder="+977..."
                value={vendorForm.phone}
                onChange={e => setVendorForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.email', { defaultValue: 'Email' })}</Label>
              <Input
                type="email"
                className="h-9 text-sm"
                placeholder="vendor@example.com"
                value={vendorForm.email}
                onChange={e => setVendorForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.address', { defaultValue: 'Address' })}</Label>
              <Input
                className="h-9 text-sm"
                placeholder={t('workflow.addressPlaceholder', { defaultValue: 'Address...' })}
                value={vendorForm.address}
                onChange={e => setVendorForm(f => ({ ...f, address: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setVendorDialog(false)}>{t('workflow.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={handleCreateVendor} disabled={!vendorForm.name.trim() || qaSubmitting}>
              {qaSubmitting ? t('workflow.adding', { defaultValue: 'Adding…' }) : t('workflow.addVendor', { defaultValue: 'Add Vendor' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── NewTaskDialog ────────────────────────────────────────────────────────────

const PRIORITY_CHIPS = [
  { v: 'High',   dots: '●●●', act: 'border-red-500 bg-red-50 text-red-700 border-2',      cls: 'border-red-300 text-red-600 border opacity-75' },
  { v: 'Medium', dots: '●●',  act: 'border-amber-500 bg-amber-50 text-amber-800 border-2', cls: 'border-amber-400 text-amber-700 border opacity-75' },
  { v: 'Low',    dots: '●',   act: 'border-green-500 bg-green-50 text-green-700 border-2', cls: 'border-green-400 text-green-600 border opacity-75' },
];

function NewTaskDialog({ open, onOpenChange, onCreated }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleCreate() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const companyId = getActiveCompanyId();
      const { attachments, ...taskData } = form;
      const res = await taskApi.create({ ...taskData, companyId });
      const created = res.data;
      if (attachments.length > 0 && created?.id) {
        await memoApi.create({
          companyId,
          title: `Task: ${form.title}`,
          content: `Attachments for task #${created.id}`,
          tags: ['task', 'attachment'],
          attachments,
        }).catch(() => null);
      }
      onCreated(created);
      setForm(EMPTY_FORM);
      onOpenChange(false);
      toast({
        title: t('workflow.taskCreatedTitle', { defaultValue: 'Task created' }),
        description: t('workflow.taskCreatedDesc', { defaultValue: '"{{title}}" added to {{status}}.', title: form.title, status: statusLabel(t, form.status) }),
      });
    } catch {
      toast({
        title: t('workflow.error', { defaultValue: 'Error' }),
        description: t('workflow.couldNotCreateTask', { defaultValue: 'Could not create task.' }),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-dialog max-w-3xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500 -mx-6 -mt-6 mb-4 rounded-t-lg" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-amber-500" />
            {t('workflow.newTask', { defaultValue: 'New Task' })}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 max-h-[65vh] overflow-hidden mt-2">
          {/* ── Left column: Task Details ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="space-y-3 overflow-y-auto pr-1"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />{t('workflow.taskDetailsSection', { defaultValue: 'Task Details' })}
            </p>

            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.titleLabel', { defaultValue: 'Title' })} <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Pencil className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-8 h-9 text-sm"
                  placeholder={t('workflow.whatNeedsDone', { defaultValue: 'What needs to be done?' })}
                  value={form.title}
                  onChange={e => setField('title', e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.description', { defaultValue: 'Description' })}</Label>
              <div className="relative">
                <FileText className="absolute left-2.5 top-3 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Textarea
                  className="pl-8 text-sm resize-none"
                  rows={3}
                  placeholder={t('workflow.optionalDetails', { defaultValue: 'Optional details...' })}
                  value={form.description}
                  onChange={e => setField('description', e.target.value)}
                />
              </div>
            </div>

            {/* Priority chips */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.priority', { defaultValue: 'Priority' })}</Label>
              <div className="grid grid-cols-3 gap-2">
                {PRIORITY_CHIPS.map(p => (
                  <button
                    key={p.v}
                    type="button"
                    onClick={() => setField('priority', p.v)}
                    className={`sel-chip text-xs ${form.priority === p.v ? p.act : p.cls}`}
                  >
                    {p.dots} {priorityLabel(t, p.v)}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── Right column: Assignment ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.06 }}
            className="space-y-3 overflow-y-auto pr-1"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />{t('workflow.assignment', { defaultValue: 'Assignment' })}
            </p>

            {/* Due Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.dueDate', { defaultValue: 'Due Date' })}</Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  className="pl-8 h-9 text-sm"
                  value={form.due_date}
                  onChange={e => setField('due_date', e.target.value)}
                />
              </div>
            </div>

            {/* Assigned To */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.assignedTo', { defaultValue: 'Assigned To' })}</Label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-8 h-9 text-sm"
                  placeholder={t('workflow.nameOrEmailPlaceholder', { defaultValue: 'Name or email...' })}
                  value={form.assigned_to}
                  onChange={e => setField('assigned_to', e.target.value)}
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.category', { defaultValue: 'Category' })}</Label>
              <div className="relative">
                <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none z-10" />
                <Select value={form.category} onValueChange={v => setField('category', v)}>
                  <SelectTrigger className="pl-8 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{categoryLabel(t, c)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('workflow.status', { defaultValue: 'Status' })}</Label>
              <div className="relative">
                <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none z-10" />
                <Select value={form.status} onValueChange={v => setField('status', v)}>
                  <SelectTrigger className="pl-8 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">{statusLabel(t, 'Pending')}</SelectItem>
                    <SelectItem value="In Progress">{statusLabel(t, 'In Progress')}</SelectItem>
                    <SelectItem value="Done">{statusLabel(t, 'Done')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" /> {t('workflow.attachments', { defaultValue: 'Attachments' })}
              </Label>
              <FileAttachmentZone
                value={form.attachments}
                onChange={files => setField('attachments', files)}
              />
            </div>
          </motion.div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('workflow.cancel', { defaultValue: 'Cancel' })}</Button>
          <Button onClick={handleCreate} disabled={!form.title.trim() || saving}>
            {saving ? t('workflow.creating', { defaultValue: 'Creating…' }) : t('workflow.createTask', { defaultValue: 'Create Task' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Workflow() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    try {
      const res = await taskApi.list();
      setTasks(res.data || []);
    } catch {
      toast({
        title: t('workflow.error', { defaultValue: 'Error' }),
        description: t('workflow.couldNotLoadTasks', { defaultValue: 'Could not load tasks.' }),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  // Optimistic update: replaces the task in state and updates selectedTask if open
  function applyTaskUpdate(updated) {
    setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    setSelectedTask(prev => (prev?.id === updated.id ? updated : prev));
  }

  async function handleSaveTask(edited) {
    try {
      const res = await taskApi.update(edited.id, edited);
      const saved = res.data ?? edited;
      applyTaskUpdate(saved);
      setSelectedTask(null);
      toast({
        title: t('workflow.taskUpdatedTitle', { defaultValue: 'Task updated' }),
        description: t('workflow.taskSavedDesc', { defaultValue: '"{{title}}" saved.', title: saved.title }),
      });
    } catch {
      toast({
        title: t('workflow.error', { defaultValue: 'Error' }),
        description: t('workflow.couldNotSaveTask', { defaultValue: 'Could not save task.' }),
        variant: 'destructive',
      });
    }
  }

  function handleTaskCreated(newTask) {
    setTasks(prev => [newTask, ...prev]);
  }

  function openNewTaskInColumn() {
    setShowNewDialog(true);
  }

  const pending = tasks.filter(t => t.status === 'Pending');
  const inProgress = tasks.filter(t => t.status === 'In Progress');
  const done = tasks.filter(t => t.status === 'Done');

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title={t('workflow.pageTitle', { defaultValue: 'Workflow' })}
        subtitle={t('workflow.pageSubtitle', { defaultValue: 'Track tasks and projects across your team' })}
      >
        <Button onClick={() => setShowNewDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          {t('workflow.newTask', { defaultValue: 'New Task' })}
        </Button>
      </PageHeader>

      {loading ? (
        <PageLoader />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={t('workflow.noTasksYet', { defaultValue: 'No tasks yet' })}
          description={t('workflow.noTasksYetHint', { defaultValue: 'Create your first task to start managing work across your team.' })}
          action={
            <Button onClick={() => setShowNewDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" /> {t('workflow.newTask', { defaultValue: 'New Task' })}
            </Button>
          }
        />
      ) : (
        <div className="flex gap-4 items-start">
          {COLUMNS.map(col => {
            const colTasks =
              col.key === 'Pending' ? pending
              : col.key === 'In Progress' ? inProgress
              : done;
            return (
              <KanbanColumn
                key={col.key}
                title={statusLabel(t, col.key)}
                dotColor={col.dotColor}
                tasks={colTasks}
                onCardClick={setSelectedTask}
                onAddNew={openNewTaskInColumn}
              />
            );
          })}
        </div>
      )}

      {/* Backdrop overlay */}
      {selectedTask && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setSelectedTask(null)}
        />
      )}

      {/* Slide-out detail panel */}
      <SlideOutPanel
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onSave={handleSaveTask}
      />

      {/* New Task dialog */}
      <NewTaskDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreated={handleTaskCreated}
      />
    </div>
  );
}
