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
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Plus, Trash2, ShoppingCart, User, FileText } from 'lucide-react';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { SmartNumberInput } from "@/components/ui/smart-number-input";
import { FileAttachmentZone } from "@/components/ui/file-attachment-zone";
import { useRole } from "@/lib/useRole";
import { WorkflowJobPicker, TaskBadge, useWorkflowTasks } from '../components/shared/TaskLinkSelect';
import { useIdempotencyKey } from '@/lib/useIdempotencyKey';
import { toast } from 'sonner';
import PayNowSection, { EMPTY_PAY_NOW } from '../components/shared/PayNowSection';
import BillStatusBadge, { billStatusLabel } from '../components/shared/BillStatusBadge';
import BillPaymentDialog from '../components/shared/BillPaymentDialog';
import { apiErrorMessage, billDue, billStatusKey, buildPayNow, partyPayload, round2, validatePayNow } from '@/lib/bills';

import { useCompanyUnits } from '@/lib/useCompanyUnits';

const EMPTY_FORM = {
  task_id: '', // Workflow job this record is for (optional)
  create_job: false, // "Also create a workflow job" — made by the server with the bill
  vendor_id: '', // saved vendor picked from the dropdown
  vendor_name: '', vendor_contact: '', vendor_address: '', vendor_pan: '',
  order_number: '', ordered_by: '',
  date_ad: new Date().toISOString().split('T')[0],
  due_date: '',
  pay_now: { ...EMPTY_PAY_NOW }, // Udharo / Paid in full / Part paid
  is_vat: false,
  notes: '',
  items: [{ description: '', quantity: 1, unit: '', unit_price: 0, total: 0 }],
  labor_items: [{ description: '', amount: 0 }],
  attachments: [],
};

export default function Purchase() {
  const { t } = useTranslation();
  const { canCreate } = useRole();
  const companyId = getActiveCompanyId();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({ vendor_name: '', order_number: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showNew, setShowNew] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [paymentBillId, setPaymentBillId] = useState(null); // Record Payment / history dialog
  const UNITS = useCompanyUnits(); // this company's own unit list
  const workflowTasks = useWorkflowTasks();
  const saveKey = useIdempotencyKey(); // one key per purchase; reused if the save is retried

  const UNIT_LABELS = {
    Piece: t('purchase.unitPiece', { defaultValue: 'Piece' }),
    Set: t('purchase.unitSet', { defaultValue: 'Set' }),
    Liter: t('purchase.unitLiter', { defaultValue: 'Liter' }),
    ml: t('purchase.unitMl', { defaultValue: 'ml' }),
    Kg: t('purchase.unitKg', { defaultValue: 'Kg' }),
    gm: t('purchase.unitGm', { defaultValue: 'gm' }),
    NOS: t('purchase.unitNos', { defaultValue: 'NOS' }),
  };

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  // Load vendors when dialog opens
  useEffect(() => {
    if (showNew && companyId) {
      api.Vendor.filter({ company_id: companyId }).then(setVendors).catch(() => setVendors([]));
    }
  }, [showNew, companyId]);

  async function loadData() {
    setLoading(true);
    const data = await api.PurchaseOrder.filter({ company_id: companyId }, '-created_date', 50);
    setOrders(data);
    setLoading(false);
  }

  function updateItem(index, field, value) {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      items[index].total = (items[index].quantity || 0) * (items[index].unit_price || 0);
    }
    setForm({ ...form, items });
  }

  function addItem() {
    setForm({
      ...form,
      items: [...form.items, { description: '', quantity: 1, unit: '', unit_price: 0, total: 0 }]
    });
  }

  function removeItem(index) {
    if (form.items.length <= 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  }

  function addLaborItem() {
    setForm({ ...form, labor_items: [...form.labor_items, { description: '', amount: 0 }] });
  }

  function updateLaborItem(index, field, value) {
    const labor_items = [...form.labor_items];
    labor_items[index] = { ...labor_items[index], [field]: value };
    setForm({ ...form, labor_items });
  }

  function removeLaborItem(index) {
    if (form.labor_items.length <= 1) return;
    setForm({ ...form, labor_items: form.labor_items.filter((_, i) => i !== index) });
  }

  // Each purchase line is linked to its stock item (matched by name; a new item
  // is created only when none exists) so the server adds the stock inside the
  // purchase's own transaction. This page used to create a brand-new inventory
  // item for every line of every purchase — duplicates on each re-order.
  async function linkLinesToStock() {
    const stock = await api.InventoryItem.filter({ company_id: companyId });
    const byName = new Map(stock.map(i => [String(i.item_name || i.description || '').trim().toLowerCase(), i]));
    const linked = [];
    for (const item of form.items) {
      const name = String(item.description || '').trim();
      if (!name) continue;
      if (item.inventory_item_id) { linked.push(item); continue; }
      let match = byName.get(name.toLowerCase());
      if (!match) {
        match = await api.InventoryItem.create({
          company_id: companyId,
          item_name: name,
          description: name,
          quantity: 0, // the purchase itself adds the stock
          unit: item.unit && item.unit !== '__custom__' ? item.unit : UNITS[0],
          unit_purchase_price: Number(item.unit_price) || 0,
        });
        byName.set(name.toLowerCase(), match);
      }
      linked.push({ ...item, inventory_item_id: match.id });
    }
    return linked;
  }

  async function createOrder() {
    const entryDate = form.date_ad || new Date().toISOString().split('T')[0];
    const bsDate = adToBs(new Date(entryDate));
    const laborTotal = form.labor_items.reduce((s, li) => s + (Number(li.amount) || 0), 0);
    const subtotal = form.items.reduce((sum, i) => sum + (i.total || 0), 0) + laborTotal;
    const vatAmount = form.is_vat ? subtotal * 0.13 : 0;
    if (validatePayNow(form.pay_now, round2(subtotal + vatAmount))) {
      toast.error(t('bills.fixPayment', { defaultValue: 'Check the payment details' }));
      return;
    }

    setSaving(true);
    try {
      const items = (await linkLinesToStock())
        .map(i => ({ ...i, unit: i.unit && i.unit !== '__custom__' ? i.unit : UNITS[0] }));

      await api.PurchaseOrder.create({
        company_id: companyId,
        ...(form.task_id ? { task_id: form.task_id } : {}),
        ...(form.create_job ? { create_job: true } : {}),
        // The saved vendor (if still the one named) — otherwise the server links
        // the typed name to an existing vendor or creates one, in the same save.
        vendor_id: partyPayload(form.vendor_id, form.vendor_name, vendors).id,
        vendor_name: form.vendor_name,
        vendor_contact: form.vendor_contact,
        vendor_address: form.vendor_address,
        // API field names (vendor_pan / payment_type were silently dropped).
        vendor_pan_vat: form.vendor_pan || undefined,
        // Udharo / paid in full / part paid — saved with the bill (status follows from it).
        payment: buildPayNow(form.pay_now),
        labor_charges: laborTotal,
        date_ad: entryDate,
        date_bs: bsDate.formatted,
        due_date: form.due_date || null,
        order_number: form.order_number,
        ordered_by: form.ordered_by,
        items,
        work_description: form.labor_items.map(li => li.description).filter(Boolean).join(', '),
        is_vat: form.is_vat,
        notes: form.notes,
        // Saved by the backend as a linked Purchase Bill (Memo → Purchase Bills).
        attachments: form.attachments,
        subtotal,
        vat_amount: vatAmount,
        total_amount: subtotal + vatAmount,
      }, { idempotencyKey: saveKey.key });
      saveKey.renew();
      toast.success(t('purchase.saved', { defaultValue: 'Purchase saved' }));

      setForm({ ...EMPTY_FORM, pay_now: { ...EMPTY_PAY_NOW }, date_ad: new Date().toISOString().split('T')[0] });
      setShowNew(false);
      loadData();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('purchase.saveFailed', { defaultValue: 'Could not save the purchase' })));
    } finally {
      setSaving(false);
    }
  }

  const filtered = orders.filter(o =>
    (o.vendor_name?.toLowerCase().includes(search.toLowerCase()) ||
     o.order_number?.toLowerCase().includes(search.toLowerCase())) &&
    (!colFilters.vendor_name || o.vendor_name?.toLowerCase().includes(colFilters.vendor_name.toLowerCase())) &&
    (!colFilters.order_number || (o.order_number || '').toLowerCase().includes(colFilters.order_number.toLowerCase())) &&
    (!colFilters.status || billStatusLabel(t, o).toLowerCase().includes(colFilters.status.toLowerCase()))
  );

  const totalLabor = form.labor_items.reduce((s, li) => s + (li.amount || 0), 0);
  const itemsSubtotal = form.items.reduce((sum, i) => sum + (i.total || 0), 0);
  const subtotal = itemsSubtotal + totalLabor;
  const vatAmount = form.is_vat ? subtotal * 0.13 : 0;

  const columns = [
    { key: 'task_id', label: t('workflow.jobColumn', { defaultValue: 'Job' }), render: (row) => <TaskBadge tasks={workflowTasks} taskId={row.task_id} /> },
    { key: 'date_ad', label: t('purchase.date', { defaultValue: 'Date' }), render: (row) => (
      <div className="text-xs">
        <div>{formatDate(row.date_ad)}</div>
        <div className="text-muted-foreground">{row.date_bs}</div>
      </div>
    )},
    { key: 'order_number', label: t('purchase.orderNumber', { defaultValue: 'Order #' }), filterValue: colFilters.order_number, onFilterChange: v => setCol('order_number', v) },
    { key: 'vendor_name', label: t('purchase.vendor', { defaultValue: 'Vendor' }), filterValue: colFilters.vendor_name, onFilterChange: v => setCol('vendor_name', v), render: (row) => (
      <span className="font-medium">{row.vendor_name}</span>
    )},
    { key: 'items', label: t('purchase.items', { defaultValue: 'Items' }), render: (row) => (
      <span className="text-muted-foreground">{t('purchase.itemsCount', { count: row.items?.length || 0, defaultValue: '{{count}} items' })}</span>
    )},
    { key: 'is_vat', label: t('purchase.vat', { defaultValue: 'VAT' }), render: (row) => (
      <Badge variant={row.is_vat ? 'default' : 'secondary'}>{row.is_vat ? t('purchase.vatYes', { defaultValue: 'VAT' }) : t('purchase.vatNo', { defaultValue: 'Non-VAT' })}</Badge>
    )},
    { key: 'total_amount', label: t('purchase.total', { defaultValue: 'Total' }), render: (row) => (
      <span className="font-semibold font-mono">NPR {Number(row.total_amount || 0).toLocaleString()}</span>
    )},
    { key: 'paid_amount', label: t('bills.colPaid', { defaultValue: 'Paid' }), render: (row) => (
      <span className="font-mono text-muted-foreground">NPR {Number(row.paid_amount || 0).toLocaleString()}</span>
    )},
    { key: 'due', label: t('bills.colDue', { defaultValue: 'Due' }), render: (row) => {
      const due = billDue(row);
      return <span className={`font-mono font-semibold ${due > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>NPR {due.toLocaleString()}</span>;
    }},
    { key: 'status', label: t('purchase.status', { defaultValue: 'Status' }), filterValue: colFilters.status, onFilterChange: v => setCol('status', v), filterPlaceholder: t('bills.statusFilterPlaceholder', { defaultValue: 'e.g. unpaid' }), render: (row) => (
      <BillStatusBadge bill={row} />
    )},
    { key: 'actions', label: '', render: (row) => (
      canCreate && billDue(row) > 0 && billStatusKey(row) !== 'CANCELLED' ? (
        <Button size="sm" variant="outline" className="h-7 text-xs whitespace-nowrap" onClick={(e) => { e.stopPropagation(); setPaymentBillId(row.id); }}>
          {t('bills.recordPayment', { defaultValue: 'Record Payment' })}
        </Button>
      ) : null
    )},
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('purchase.title', { defaultValue: 'Purchase' })}
        subtitle={t('purchase.subtitle', { defaultValue: 'Purchase orders and bills' })}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setShowNew(true)}
        addLabel={t('purchase.newPurchase', { defaultValue: 'New Purchase' })}
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={t('purchase.noOrdersYet', { defaultValue: 'No purchase orders yet' })}
          description={t('purchase.noOrdersDescription', { defaultValue: 'Add your first purchase order to track your expenses.' })}
          action={canCreate ? <Button onClick={() => setShowNew(true)}>{t('purchase.newPurchase', { defaultValue: 'New Purchase' })}</Button> : null}
        />
      ) : (
        <DataTable columns={columns} data={filtered} onRowClick={(row) => setPaymentBillId(row.id)} emptyMessage={t('purchase.noSearchMatch', { defaultValue: 'No purchase orders match your search.' })} />
      )}

      {/* Payments: history + Record Payment (opened from a row) */}
      <BillPaymentDialog
        kind="purchase"
        billId={paymentBillId}
        open={!!paymentBillId}
        onOpenChange={(open) => { if (!open) setPaymentBillId(null); }}
        onSaved={loadData}
        canPay={canCreate}
      />

      {/* New Purchase Dialog */}
      <Dialog open={showNew} onOpenChange={open => { setShowNew(open); if (!open) setForm({ ...EMPTY_FORM, pay_now: { ...EMPTY_PAY_NOW }, date_ad: new Date().toISOString().split('T')[0] }); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden glass-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              {t('purchase.newPurchaseEntry', { defaultValue: 'New Purchase Entry' })}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 overflow-hidden">
            {/* ── Left column: bill header ── */}
            <div className="space-y-3 overflow-y-auto max-h-[calc(85vh-180px)] pr-1">

              {/* Vendor Details section */}
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 flex items-center gap-1">
                <User className="w-3 h-3" /> {t('purchase.vendorDetails', { defaultValue: 'Vendor Details' })}
              </h4>

              {/* Saved vendor picker */}
              {vendors.length > 0 && (
                <div>
                  <Label className="text-xs">{t('purchase.selectSavedVendor', { defaultValue: 'Select Saved Vendor' })}</Label>
                  <Select value={form.vendor_id || undefined} onValueChange={v => {
                    const vend = vendors.find(x => x.id === v);
                    if (vend) setForm(f => ({
                      ...f,
                      vendor_id: vend.id,
                      vendor_name: vend.name || '',
                      vendor_contact: vend.contact_person || vend.phone || '',
                      vendor_address: vend.address || '',
                      vendor_pan: vend.pan_vat || ''
                    }));
                  }}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder={t('purchase.selectSavedVendorPlaceholder', { defaultValue: 'Select saved vendor (or type below)' })} />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <WorkflowJobPicker
                tasks={workflowTasks}
                taskId={form.task_id}
                createJob={form.create_job}
                onTaskChange={v => setForm(f => ({ ...f, task_id: v }))}
                onCreateJobChange={v => setForm(f => ({ ...f, create_job: v }))}
                partyLabel={t('workflow.partyVendor', { defaultValue: 'vendor' })}
              />
              <div>
                <Label className="text-xs">{t('purchase.vendorName', { defaultValue: 'Vendor Name *' })}</Label>
                <Input
                  className="h-8 text-sm"
                  value={form.vendor_name}
                  onChange={e => setForm({ ...form, vendor_name: e.target.value })}
                  placeholder={t('purchase.vendorNamePlaceholder', { defaultValue: 'Vendor / Supplier name' })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{t('purchase.contact', { defaultValue: 'Contact' })} <span className="text-muted-foreground">({t('purchase.optional', { defaultValue: 'optional' })})</span></Label>
                  <Input
                    className="h-8 text-sm"
                    value={form.vendor_contact}
                    onChange={e => setForm({ ...form, vendor_contact: e.target.value })}
                    placeholder={t('purchase.contactPlaceholder', { defaultValue: 'Phone / email' })}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('purchase.panVat', { defaultValue: 'PAN / VAT' })} <span className="text-muted-foreground">({t('purchase.optional', { defaultValue: 'optional' })})</span></Label>
                  <Input
                    className="h-8 text-sm"
                    value={form.vendor_pan}
                    onChange={e => setForm({ ...form, vendor_pan: e.target.value })}
                    placeholder={t('purchase.panPlaceholder', { defaultValue: 'e.g. 123456789' })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">{t('purchase.address', { defaultValue: 'Address' })} <span className="text-muted-foreground">({t('purchase.optional', { defaultValue: 'optional' })})</span></Label>
                <Input
                  className="h-8 text-sm"
                  value={form.vendor_address}
                  onChange={e => setForm({ ...form, vendor_address: e.target.value })}
                  placeholder={t('purchase.vendorAddressPlaceholder', { defaultValue: 'Vendor address' })}
                />
              </div>

              {/* Bill Details section */}
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 mt-2 flex items-center gap-1">
                <FileText className="w-3 h-3" /> {t('purchase.billDetails', { defaultValue: 'Bill Details' })}
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{t('purchase.billDate', { defaultValue: 'Bill Date *' })}</Label>
                  <Input
                    type="date"
                    className="h-8 text-sm"
                    value={form.date_ad}
                    onChange={e => setForm({ ...form, date_ad: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('purchase.dueDate', { defaultValue: 'Due Date' })} <span className="text-muted-foreground">({t('purchase.creditHint', { defaultValue: 'credit' })})</span></Label>
                  <Input
                    type="date"
                    className="h-8 text-sm"
                    value={form.due_date}
                    onChange={e => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{t('purchase.orderBillNo', { defaultValue: 'Order / Bill No.' })} <span className="text-muted-foreground">({t('purchase.optional', { defaultValue: 'optional' })})</span></Label>
                  <Input
                    className="h-8 text-sm"
                    value={form.order_number}
                    onChange={e => setForm({ ...form, order_number: e.target.value })}
                    placeholder={t('purchase.vendorBillNoPlaceholder', { defaultValue: "Vendor's bill #" })}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('purchase.orderedBy', { defaultValue: 'Ordered By' })} <span className="text-muted-foreground">({t('purchase.optional', { defaultValue: 'optional' })})</span></Label>
                  <Input
                    className="h-8 text-sm"
                    value={form.ordered_by}
                    onChange={e => setForm({ ...form, ordered_by: e.target.value })}
                    placeholder={t('purchase.orderedByPlaceholder', { defaultValue: 'Your staff name' })}
                  />
                </div>
              </div>

              {/* VAT Toggle */}
              <div className="flex items-center gap-3 p-2.5 bg-secondary rounded-lg">
                <Switch checked={form.is_vat} onCheckedChange={v => setForm({ ...form, is_vat: v })} />
                <Label className="text-sm">{t('purchase.vatBill', { defaultValue: 'VAT Bill (13%)' })}</Label>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs">{t('purchase.notes', { defaultValue: 'Notes' })} <span className="text-muted-foreground">({t('purchase.optional', { defaultValue: 'optional' })})</span></Label>
                <Input
                  className="h-8 text-sm"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder={t('purchase.notesPlaceholder', { defaultValue: 'Remarks, special instructions...' })}
                />
              </div>

              {/* Attachments */}
              <div>
                <Label className="text-xs font-medium">{t('purchase.attachments', { defaultValue: 'Attachments' })}</Label>
                <FileAttachmentZone
                  files={form.attachments || []}
                  onChange={(files) => setForm({ ...form, attachments: files })}
                  label={t('purchase.attachmentsLabel', { defaultValue: 'Attach bills, receipts or photos' })}
                  className="mt-1"
                />
              </div>
            </div>

            {/* ── Right column: items ── */}
            <div className="overflow-y-auto max-h-[calc(85vh-180px)]">

              {/* Items */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 flex-1">
                    {t('purchase.items', { defaultValue: 'Items' })}
                  </h4>
                  <Button size="sm" variant="outline" className="h-7 text-xs ml-2" onClick={addItem}>
                    <Plus className="w-3 h-3 mr-1" />{t('purchase.addItem', { defaultValue: 'Add Item' })}
                  </Button>
                </div>

                {/* Header row */}
                <div className="grid grid-cols-12 gap-1 text-xs font-medium text-muted-foreground px-1 mb-1">
                  <div className="col-span-5">{t('purchase.description', { defaultValue: 'Description' })}</div>
                  <div className="col-span-2">{t('purchase.qty', { defaultValue: 'Qty' })}</div>
                  <div className="col-span-2">{t('purchase.unit', { defaultValue: 'Unit' })}</div>
                  <div className="col-span-2">{t('purchase.buyPrice', { defaultValue: 'Buy Price' })}</div>
                  <div className="col-span-1"></div>
                </div>

                <div className="space-y-1">
                  {form.items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1 items-center">
                      <div className="col-span-5">
                        <Input
                          placeholder={t('purchase.itemDescriptionPlaceholder', { defaultValue: 'Item description' })}
                          value={item.description}
                          onChange={e => updateItem(i, 'description', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <SmartNumberInput
                          value={item.quantity}
                          onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        {(!item.unit || UNITS.includes(item.unit)) ? (
                          <Select
                            value={item.unit || UNITS[0]}
                            onValueChange={v => updateItem(i, 'unit', v)}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {UNITS.map(u => <SelectItem key={u} value={u}>{UNIT_LABELS[u] || u}</SelectItem>)}
                              <SelectItem value="__custom__">{t('purchase.customUnit', { defaultValue: 'Custom...' })}</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex gap-1">
                            <Input
                              value={item.unit === '__custom__' ? '' : item.unit}
                              onChange={e => updateItem(i, 'unit', e.target.value || '__custom__')}
                              placeholder={t('purchase.unitPlaceholder', { defaultValue: 'Unit' })}
                              className="h-8 text-xs"
                              autoFocus
                            />
                            <Button type="button" variant="outline" size="sm" className="h-8 px-1 shrink-0 text-xs" onClick={() => updateItem(i, 'unit', '')}>↩</Button>
                          </div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <SmartNumberInput
                          value={item.unit_price}
                          onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeItem(i)}
                          disabled={form.items.length <= 1}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Labour Charges */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 flex-1">
                    {t('purchase.laborCharges', { defaultValue: 'Work / Labour Charges' })}
                  </h4>
                  <Button size="sm" variant="outline" className="h-7 text-xs ml-2" onClick={addLaborItem}>
                    <Plus className="w-3 h-3 mr-1" />{t('purchase.addRow', { defaultValue: 'Add Row' })}
                  </Button>
                </div>

                <div className="space-y-1">
                  {form.labor_items.map((li, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                      <div className="col-span-8">
                        <Input
                          value={li.description}
                          onChange={e => updateLaborItem(idx, 'description', e.target.value)}
                          placeholder={t('purchase.laborDescriptionPlaceholder', { defaultValue: 'e.g. Installation, Repair...' })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-3">
                        <SmartNumberInput
                          value={li.amount}
                          onChange={e => updateLaborItem(idx, 'amount', parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                          placeholder={t('purchase.amountPlaceholder', { defaultValue: 'Amount' })}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => removeLaborItem(idx)}
                          disabled={form.labor_items.length <= 1}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-secondary rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('purchase.itemsSubtotal', { defaultValue: 'Items Subtotal' })}</span>
                  <span className="font-mono">NPR {itemsSubtotal.toLocaleString()}</span>
                </div>
                {totalLabor > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('purchase.laborTotal', { defaultValue: 'Labour Total' })}</span>
                    <span className="font-mono">NPR {totalLabor.toLocaleString()}</span>
                  </div>
                )}
                {form.is_vat && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('purchase.vatPercent', { defaultValue: 'VAT (13%)' })}</span>
                    <span className="font-mono">NPR {vatAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>{t('purchase.total', { defaultValue: 'Total' })}</span>
                  <span className="font-mono">NPR {(subtotal + vatAmount).toLocaleString()}</span>
                </div>
              </div>

              {/* Payment — right next to the Total */}
              <div className="mt-3">
                <PayNowSection kind="purchase" value={form.pay_now} total={round2(subtotal + vatAmount)} onChange={pay_now => setForm(f => ({ ...f, pay_now }))} />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowNew(false)}>{t('purchase.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={createOrder} disabled={!form.vendor_name.trim() || saving || !!validatePayNow(form.pay_now, round2(subtotal + vatAmount))}>
              {saving ? t('bills.saving', { defaultValue: 'Saving…' }) : t('purchase.savePurchase', { defaultValue: 'Save Purchase' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
