import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/adapter';
import { getActiveCompanyId } from '@/lib/companyContext';
import { adToBs, getCurrentFiscalYear } from '@/lib/nepaliDate';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Plus, Trash2, Receipt } from 'lucide-react';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
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
  client_id: '', // saved client picked from the dropdown
  client_name: '', client_contact: '', client_address: '', client_pan: '',
  invoice_number: '', is_vat: false,
  pay_now: { ...EMPTY_PAY_NOW }, // Udharo / Received in full / Part received
  date_ad: new Date().toISOString().split('T')[0],
  due_date: '',
  notes: '',
  items: [{ inventory_item_id: '', description: '', quantity: 1, unit: '', unit_price: 0, total: 0 }],
  labor_items: [{ description: '', amount: 0 }],
  attachments: [],
};

export default function Sales() {
  const { t } = useTranslation();
  const { canCreate } = useRole();
  const companyId = getActiveCompanyId();
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({ client_name: '', invoice_number: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [paymentBillId, setPaymentBillId] = useState(null); // Receive Payment / history dialog
  const UNITS = useCompanyUnits(); // this company's own unit list
  const workflowTasks = useWorkflowTasks();
  const saveKey = useIdempotencyKey(); // one key per bill; reused if the save is retried

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);
    const [salesData, invData] = await Promise.all([
      api.SalesOrder.filter({ company_id: companyId }, '-created_date', 500),
      api.InventoryItem.filter({ company_id: companyId }),
    ]);
    setOrders(salesData);
    setInventory(invData);
    setLoading(false);
    return salesData;
  }

  async function loadClients() {
    const clientData = await api.Client.filter({ company_id: companyId });
    setClients(clientData);
  }

  async function generateInvoiceNumber(salesData, isVat = false) {
    const fyLabel = getCurrentFiscalYear();
    const shortLabel = fyLabel.replace(/\d{2}(\d{2})\/(\d{2})(\d{2})/, '$1/$3');
    const prefix = isVat ? `VAT-${shortLabel}-` : `INV-${shortLabel}-`;
    const fyOrders = (salesData || orders).filter(o => o.invoice_number?.startsWith(prefix));
    const maxSerial = fyOrders.reduce((max, o) => {
      const num = parseInt(o.invoice_number?.replace(prefix, '') || '0');
      return num > max ? num : max;
    }, 0);
    return `${prefix}${String(maxSerial + 1).padStart(3, '0')}`;
  }

  async function openNewSale() {
    const [salesData] = await Promise.all([loadData(), loadClients()]);
    const nextInvoice = await generateInvoiceNumber(salesData, false);
    setForm({
      ...EMPTY_FORM,
      pay_now: { ...EMPTY_PAY_NOW },
      invoice_number: nextInvoice,
      date_ad: new Date().toISOString().split('T')[0],
    });
    setShowNew(true);
  }

  function selectClientFromDropdown(clientId) {
    const cl = clients.find(x => x.id === clientId);
    if (cl) {
      setForm(f => ({
        ...f,
        client_id: cl.id,
        client_name: cl.name || '',
        client_contact: cl.contact_person || cl.phone || '',
        client_address: cl.address || '',
        client_pan: cl.pan_vat || '',
      }));
    }
  }

  function selectInventoryItem(index, itemId) {
    const invItem = inventory.find(i => i.id === itemId);
    if (!invItem) return;
    const items = [...form.items];
    items[index] = {
      ...items[index],
      inventory_item_id: itemId,
      description: invItem.description,
      unit: invItem.unit || UNITS[0],
      unit_price: invItem.unit_selling_price || 0,
      total: (items[index].quantity || 1) * (invItem.unit_selling_price || 0),
    };
    setForm({ ...form, items });
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
      items: [...form.items, { inventory_item_id: '', description: '', quantity: 1, unit: '', unit_price: 0, total: 0 }],
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

  async function createOrder(shouldPrint = false) {
    const entryDate = form.date_ad || new Date().toISOString().split('T')[0];
    const bsDate = adToBs(new Date(entryDate));
    const totalLabor = form.labor_items.reduce((s, li) => s + (Number(li.amount) || 0), 0);
    const itemsSubtotal = form.items.reduce((sum, i) => sum + (i.total || 0), 0);
    const subtotal = itemsSubtotal + totalLabor;
    const vatAmount = form.is_vat ? subtotal * 0.13 : 0;
    if (validatePayNow(form.pay_now, round2(subtotal + vatAmount))) {
      toast.error(t('bills.fixPayment', { defaultValue: 'Check the payment details' }));
      return;
    }

    setSaving(true);
    try {
      await api.SalesOrder.create({
        company_id: companyId,
        ...(form.task_id ? { task_id: form.task_id } : {}),
        ...(form.create_job ? { create_job: true } : {}),
        // The saved client (if still the one named) — otherwise the server links
        // the typed name to an existing client, or creates one when money is
        // still owed (a fully paid walk-in sale stays a plain name).
        client_id: partyPayload(form.client_id, form.client_name, clients).id,
        client_name: form.client_name,
        client_contact: form.client_contact,
        client_address: form.client_address,
        // API field names (client_pan / payment_type were silently dropped, so
        // every bill was saved as a CASH sale with no PAN).
        client_pan_vat: form.client_pan || undefined,
        // Udharo / received in full / part received — saved with the bill (status follows from it).
        payment: buildPayNow(form.pay_now),
        date_ad: entryDate,
        date_bs: bsDate.formatted,
        due_date: form.due_date || null,
        invoice_number: form.invoice_number,
        items: form.items.map(i => ({ ...i, unit: i.unit || UNITS[0] })),
        work_description: form.labor_items.map(li => li.description).filter(Boolean).join('; '),
        labor_charges: totalLabor,
        is_vat: form.is_vat,
        notes: form.notes,
        // Saved by the backend as a linked Sales Bill (Memo → Sales Bills).
        attachments: form.attachments,
        subtotal,
        vat_amount: vatAmount,
        total_amount: subtotal + vatAmount,
      }, { idempotencyKey: saveKey.key });
      saveKey.renew();
      toast.success(t('sales.saved', { defaultValue: 'Sale saved' }));
    } catch (err) {
      toast.error(apiErrorMessage(err, t('sales.saveFailed', { defaultValue: 'Could not save the sale' })));
      return;
    } finally {
      setSaving(false);
    }

    // Stock is deducted by the server in the same transaction as the bill.
    // (This page used to deduct it a second time from the browser.)

    setForm({
      ...EMPTY_FORM,
      pay_now: { ...EMPTY_PAY_NOW },
      date_ad: new Date().toISOString().split('T')[0],
    });
    setShowNew(false);
    loadData();

    if (shouldPrint) {
      const total = subtotal + vatAmount;
      const win = window.open('', '_blank');
      const printLabels = {
        invoiceTitle: form.is_vat ? t('sales.printTaxInvoice', { defaultValue: 'TAX INVOICE' }) : t('sales.printInvoice', { defaultValue: 'INVOICE' }),
        invoiceNo: t('sales.printInvoiceNo', { defaultValue: 'Invoice #:' }),
        date: t('sales.printDate', { defaultValue: 'Date:' }),
        due: t('sales.printDue', { defaultValue: 'Due:' }),
        client: t('sales.printClient', { defaultValue: 'Client:' }),
        panVat: t('sales.printPanVat', { defaultValue: 'PAN/VAT:' }),
        work: t('sales.printWork', { defaultValue: 'Work:' }),
        colNo: t('sales.printColNo', { defaultValue: '#' }),
        colDescription: t('sales.printColDescription', { defaultValue: 'Description' }),
        colQty: t('sales.printColQty', { defaultValue: 'Qty' }),
        colUnitPrice: t('sales.printColUnitPrice', { defaultValue: 'Unit Price' }),
        colTotal: t('sales.printColTotal', { defaultValue: 'Total' }),
        labor: t('sales.printLabor', { defaultValue: 'Labor:' }),
        vatLine: t('sales.printVatLine', { defaultValue: 'VAT (13%):' }),
        total: t('sales.printTotal', { defaultValue: 'TOTAL:' }),
        taxInvoiceFooter: t('sales.printTaxInvoiceFooter', { defaultValue: 'Tax Invoice' }),
        notes: t('sales.printNotes', { defaultValue: 'Notes:' }),
      };
      win.document.write(`<html><head><title>Invoice ${form.invoice_number}</title><style>
        body{font-family:sans-serif;padding:32px;color:#111}h1{font-size:22px;margin:0}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}
        th{background:#f5f5f5}.meta{font-size:13px;color:#555;margin-top:4px}
        .header{display:flex;justify-content:space-between;margin-bottom:24px}
      </style></head><body>
      <div class='header'>
        <div><h1>${printLabels.invoiceTitle}</h1><div class='meta'>${printLabels.invoiceNo} <b>${form.invoice_number}</b></div><div class='meta'>${printLabels.date} ${entryDate} | BS: ${bsDate.formatted}</div>${form.due_date ? `<div class='meta'>${printLabels.due} ${form.due_date}</div>` : ''}</div>
        <div style='text-align:right'><div class='meta'>${printLabels.client} <b>${form.client_name}</b></div><div class='meta'>${form.client_contact || ''}</div><div class='meta'>${form.client_address || ''}</div>${form.client_pan ? `<div class='meta'>${printLabels.panVat} ${form.client_pan}</div>` : ''}</div>
      </div>
      ${form.labor_items.some(li => li.description) ? `<div class='meta' style='margin-bottom:12px'>${printLabels.work} ${form.labor_items.map(li => li.description).filter(Boolean).join('; ')}</div>` : ''}
      <table><thead><tr><th>${printLabels.colNo}</th><th>${printLabels.colDescription}</th><th>${printLabels.colQty}</th><th>${printLabels.colUnitPrice}</th><th>${printLabels.colTotal}</th></tr></thead><tbody>
        ${form.items.map((item, i) => `<tr><td>${i + 1}</td><td>${item.description || '-'}</td><td>${item.quantity}</td><td>NPR ${(item.unit_price || 0).toLocaleString()}</td><td>NPR ${(item.total || 0).toLocaleString()}</td></tr>`).join('')}
      </tbody></table>
      <div style='margin-top:16px;text-align:right'>
        ${totalLabor > 0 ? `<div class='meta'>${printLabels.labor} NPR ${totalLabor.toLocaleString()}</div>` : ''}
        ${form.is_vat ? `<div class='meta'>${printLabels.vatLine} NPR ${vatAmount.toLocaleString()}</div>` : ''}
        <div style='font-weight:bold;font-size:15px;margin-top:8px'>${printLabels.total} NPR ${total.toLocaleString()}</div>
        ${form.is_vat ? `<div class='meta'>${printLabels.taxInvoiceFooter}</div>` : ''}
      </div>
      ${form.notes ? `<div class='meta' style='margin-top:16px;padding-top:12px;border-top:1px solid #eee'>${printLabels.notes} ${form.notes}</div>` : ''}
      </body></html>`);
      win.document.close();
      win.print();
    }
  }

  const filtered = orders.filter(o =>
    (o.client_name?.toLowerCase().includes(search.toLowerCase()) ||
     o.invoice_number?.toLowerCase().includes(search.toLowerCase())) &&
    (!colFilters.client_name || o.client_name?.toLowerCase().includes(colFilters.client_name.toLowerCase())) &&
    (!colFilters.invoice_number || (o.invoice_number || '').toLowerCase().includes(colFilters.invoice_number.toLowerCase())) &&
    (!colFilters.status || billStatusLabel(t, o).toLowerCase().includes(colFilters.status.toLowerCase()))
  );

  const totalLabor = form.labor_items.reduce((s, li) => s + (Number(li.amount) || 0), 0);
  const itemsSubtotal = form.items.reduce((sum, i) => sum + (i.total || 0), 0);
  const subtotal = itemsSubtotal + totalLabor;
  const vatAmount = form.is_vat ? subtotal * 0.13 : 0;

  const columns = [
    { key: 'task_id', label: t('workflow.jobColumn', { defaultValue: 'Job' }), render: (row) => <TaskBadge tasks={workflowTasks} taskId={row.task_id} /> },
    {
      key: 'date_ad', label: t('sales.colDate', { defaultValue: 'Date' }), render: (row) => (
        <div className="text-xs">
          <div>{formatDate(row.date_ad)}</div>
          <div className="text-muted-foreground">{row.date_bs}</div>
        </div>
      ),
    },
    { key: 'invoice_number', label: t('sales.colInvoiceNumber', { defaultValue: 'Invoice #' }), filterValue: colFilters.invoice_number, onFilterChange: v => setCol('invoice_number', v) },
    { key: 'client_name', label: t('sales.colClient', { defaultValue: 'Client' }), filterValue: colFilters.client_name, onFilterChange: v => setCol('client_name', v), render: (row) => <span className="font-medium">{row.client_name}</span> },
    { key: 'items', label: t('sales.colItems', { defaultValue: 'Items' }), render: (row) => <span>{t('sales.itemsCount', { defaultValue: `${row.items?.length || 0} items`, count: row.items?.length || 0 })}</span> },
    { key: 'is_vat', label: t('sales.colVat', { defaultValue: 'VAT' }), render: (row) => <Badge variant={row.is_vat ? 'default' : 'secondary'}>{row.is_vat ? t('sales.vatBadge', { defaultValue: 'VAT' }) : t('sales.nonVatBadge', { defaultValue: 'Non-VAT' })}</Badge> },
    { key: 'total_amount', label: t('sales.colTotal', { defaultValue: 'Total' }), render: (row) => <span className="font-semibold font-mono">NPR {Number(row.total_amount || 0).toLocaleString()}</span> },
    { key: 'paid_amount', label: t('bills.colReceived', { defaultValue: 'Received' }), render: (row) => <span className="font-mono text-muted-foreground">NPR {Number(row.paid_amount || 0).toLocaleString()}</span> },
    { key: 'due', label: t('bills.colDue', { defaultValue: 'Due' }), render: (row) => {
      const due = billDue(row);
      return <span className={`font-mono font-semibold ${due > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>NPR {due.toLocaleString()}</span>;
    }},
    { key: 'status', label: t('sales.colStatus', { defaultValue: 'Status' }), filterValue: colFilters.status, onFilterChange: v => setCol('status', v), filterPlaceholder: t('bills.statusFilterPlaceholder', { defaultValue: 'e.g. unpaid' }), render: (row) => <BillStatusBadge bill={row} /> },
    { key: 'actions', label: '', render: (row) => (
      canCreate && billDue(row) > 0 && billStatusKey(row) !== 'CANCELLED' ? (
        <Button size="sm" variant="outline" className="h-7 text-xs whitespace-nowrap" onClick={(e) => { e.stopPropagation(); setPaymentBillId(row.id); }}>
          {t('bills.receivePayment', { defaultValue: 'Receive Payment' })}
        </Button>
      ) : null
    )},
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('sales.title', { defaultValue: 'Sales' })}
        subtitle={t('sales.subtitle', { defaultValue: 'Sales orders and invoices' })}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={openNewSale}
        addLabel={t('sales.newSale', { defaultValue: 'New Sale' })}
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t('sales.emptyTitle', { defaultValue: 'No sales orders yet' })}
          description={t('sales.emptyDescription', { defaultValue: 'Create your first invoice to get started.' })}
          action={canCreate ? <Button onClick={openNewSale}>{t('sales.newSale', { defaultValue: 'New Sale' })}</Button> : null}
        />
      ) : (
        <DataTable columns={columns} data={filtered} onRowClick={(row) => setPaymentBillId(row.id)} emptyMessage={t('sales.noSearchMatch', { defaultValue: 'No sales orders match your search.' })} />
      )}

      {/* Payments: history + Receive Payment (opened from a row) */}
      <BillPaymentDialog
        kind="sales"
        billId={paymentBillId}
        open={!!paymentBillId}
        onOpenChange={(open) => { if (!open) setPaymentBillId(null); }}
        onSaved={loadData}
        canPay={canCreate}
      />

      {/* New Sale Dialog — two-column layout */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden glass-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              {t('sales.newSalesEntry', { defaultValue: 'New Sales Entry' })}
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-6 overflow-hidden" style={{ maxHeight: 'calc(90vh - 130px)' }}>

            {/* LEFT COLUMN — Client + Invoice details */}
            <div className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto pr-1">

              {/* Client Details */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('sales.clientDetails', { defaultValue: 'Client Details' })}</p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">{t('sales.selectSavedClient', { defaultValue: 'Select Saved Client' })}</Label>
                    <Select value={form.client_id || undefined} onValueChange={selectClientFromDropdown}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('sales.selectSavedClientPlaceholder', { defaultValue: 'Select saved client (or type below)' })} />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <WorkflowJobPicker
                    tasks={workflowTasks}
                    taskId={form.task_id}
                    createJob={form.create_job}
                    onTaskChange={v => setForm(f => ({ ...f, task_id: v }))}
                    onCreateJobChange={v => setForm(f => ({ ...f, create_job: v }))}
                    partyLabel={t('workflow.partyClient', { defaultValue: 'client' })}
                  />
                  <div>
                    <Label className="text-xs">{t('sales.clientNameRequired', { defaultValue: 'Client Name *' })}</Label>
                    <Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder={t('sales.clientNamePlaceholder', { defaultValue: 'Full name or business name' })} />
                  </div>
                  <div>
                    <Label className="text-xs">{t('sales.contact', { defaultValue: 'Contact' })} <span className="text-muted-foreground">({t('sales.optional', { defaultValue: 'optional' })})</span></Label>
                    <Input value={form.client_contact} onChange={e => setForm({ ...form, client_contact: e.target.value })} placeholder={t('sales.phoneNumberPlaceholder', { defaultValue: 'Phone number' })} />
                  </div>
                  <div>
                    <Label className="text-xs">{t('sales.address', { defaultValue: 'Address' })} <span className="text-muted-foreground">({t('sales.optional', { defaultValue: 'optional' })})</span></Label>
                    <Input value={form.client_address} onChange={e => setForm({ ...form, client_address: e.target.value })} placeholder={t('sales.cityAddressPlaceholder', { defaultValue: 'City / address' })} />
                  </div>
                  <div>
                    <Label className="text-xs">{t('sales.panVatNo', { defaultValue: 'PAN / VAT No.' })} <span className="text-muted-foreground">({t('sales.optional', { defaultValue: 'optional' })})</span></Label>
                    <Input value={form.client_pan} onChange={e => setForm({ ...form, client_pan: e.target.value })} placeholder={t('sales.panVatPlaceholder', { defaultValue: 'e.g. 123456789' })} />
                  </div>
                </div>
              </div>

              {/* Invoice Details */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('sales.invoiceDetails', { defaultValue: 'Invoice Details' })}</p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">{t('sales.invoiceDateRequired', { defaultValue: 'Invoice Date *' })}</Label>
                    <Input type="date" value={form.date_ad} onChange={e => setForm({ ...form, date_ad: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">{t('sales.invoiceNumber', { defaultValue: 'Invoice Number' })}</Label>
                    <Input value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">{t('sales.dueDate', { defaultValue: 'Due Date' })} <span className="text-muted-foreground">({t('sales.credit', { defaultValue: 'credit' })})</span></Label>
                    <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* VAT Toggle */}
              <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                <Switch
                  checked={form.is_vat}
                  onCheckedChange={async v => {
                    const nextInvoice = await generateInvoiceNumber(orders, v);
                    setForm({ ...form, is_vat: v, invoice_number: nextInvoice });
                  }}
                />
                <Label>{t('sales.vatBillLabel', { defaultValue: 'VAT Bill (13%)' })}</Label>
              </div>
            </div>

            {/* RIGHT COLUMN — Items + Labour + Summary + Notes */}
            <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto pl-1">

              {/* Items */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('sales.items', { defaultValue: 'Items' })}</p>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3 h-3 mr-1" />{t('sales.addItem', { defaultValue: 'Add Item' })}</Button>
                </div>
                <div className="space-y-2">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-secondary/50 rounded-lg">
                      <div className="col-span-4">
                        {idx === 0 && <Label className="text-xs">{t('sales.fromInventoryOrDescription', { defaultValue: 'From Inventory / Description' })}</Label>}
                        <Select
                          value={item.inventory_item_id || 'custom'}
                          onValueChange={v => v === 'custom' ? updateItem(idx, 'inventory_item_id', '') : selectInventoryItem(idx, v)}
                        >
                          <SelectTrigger><SelectValue placeholder={t('sales.selectItemPlaceholder', { defaultValue: 'Select item' })} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">{t('sales.customItem', { defaultValue: 'Custom Item' })}</SelectItem>
                            {inventory.map(inv => (
                              <SelectItem key={inv.id} value={inv.id}>{inv.description} ({inv.quantity} {inv.unit})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <Label className="text-xs">{t('sales.description', { defaultValue: 'Description' })}</Label>}
                        <Input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder={t('sales.namePlaceholder', { defaultValue: 'Name' })} />
                      </div>
                      <div className="col-span-1">
                        {idx === 0 && <Label className="text-xs">{t('sales.qty', { defaultValue: 'Qty' })}</Label>}
                        <SmartNumberInput value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <Label className="text-xs">{t('sales.unitPrice', { defaultValue: 'Unit Price' })}</Label>}
                        <SmartNumberInput value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <Label className="text-xs">{t('sales.total', { defaultValue: 'Total' })}</Label>}
                        <Input value={`NPR ${(item.total || 0).toLocaleString()}`} disabled className="font-mono" />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} disabled={form.items.length <= 1}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Labour Charges */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('sales.workLabourCharges', { defaultValue: 'Work / Labour Charges' })}</p>
                  <Button size="sm" variant="outline" onClick={addLaborItem}><Plus className="w-3 h-3 mr-1" />{t('sales.addRow', { defaultValue: 'Add Row' })}</Button>
                </div>
                <div className="space-y-2">
                  {form.labor_items.map((li, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-secondary/50 rounded-lg">
                      <div className="col-span-7">
                        {idx === 0 && <Label className="text-xs">{t('sales.workDescription', { defaultValue: 'Work Description' })}</Label>}
                        <Input value={li.description} onChange={e => updateLaborItem(idx, 'description', e.target.value)} placeholder={t('sales.workDescriptionPlaceholder', { defaultValue: 'e.g. Installation, Repair...' })} />
                      </div>
                      <div className="col-span-3">
                        {idx === 0 && <Label className="text-xs">{t('sales.amountNpr', { defaultValue: 'Amount (NPR)' })}</Label>}
                        <SmartNumberInput value={li.amount} onChange={e => updateLaborItem(idx, 'amount', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <Button size="icon" variant="ghost" onClick={() => removeLaborItem(idx)} disabled={form.labor_items.length <= 1}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-secondary rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('sales.itemsSubtotal', { defaultValue: 'Items Subtotal' })}</span>
                  <span className="font-mono">NPR {itemsSubtotal.toLocaleString()}</span>
                </div>
                {totalLabor > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>{t('sales.labourTotal', { defaultValue: 'Labour Total' })}</span>
                    <span className="font-mono">NPR {totalLabor.toLocaleString()}</span>
                  </div>
                )}
                {form.is_vat && (
                  <div className="flex justify-between text-sm">
                    <span>{t('sales.vatPercent', { defaultValue: 'VAT (13%)' })}</span>
                    <span className="font-mono">NPR {vatAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>{t('sales.total', { defaultValue: 'Total' })}</span>
                  <span className="font-mono">NPR {(subtotal + vatAmount).toLocaleString()}</span>
                </div>
              </div>

              {/* Payment — right next to the Total */}
              <PayNowSection kind="sales" value={form.pay_now} total={round2(subtotal + vatAmount)} onChange={pay_now => setForm(f => ({ ...f, pay_now }))} />

              {/* Notes */}
              <div>
                <Label className="text-xs">{t('sales.notesRemarks', { defaultValue: 'Notes / Remarks' })} <span className="text-muted-foreground">({t('sales.optional', { defaultValue: 'optional' })})</span></Label>
                <Input
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder={t('sales.notesPlaceholder', { defaultValue: 'Special instructions, payment terms...' })}
                />
              </div>

              {/* Attachments */}
              <div>
                <Label className="text-xs font-medium">{t('sales.attachments', { defaultValue: 'Attachments' })}</Label>
                <FileAttachmentZone
                  files={form.attachments || []}
                  onChange={(files) => setForm({ ...form, attachments: files })}
                  label={t('sales.attachmentsHint', { defaultValue: 'Attach invoices, receipts or photos' })}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>{t('sales.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={() => createOrder(false)} disabled={!form.client_name.trim() || saving || !!validatePayNow(form.pay_now, round2(subtotal + vatAmount))} variant="secondary">{t('sales.saveSale', { defaultValue: 'Save Sale' })}</Button>
            <Button onClick={() => createOrder(true)} disabled={!form.client_name.trim() || saving || !!validatePayNow(form.pay_now, round2(subtotal + vatAmount))}>{t('sales.saveAndPrint', { defaultValue: 'Save & Print' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
