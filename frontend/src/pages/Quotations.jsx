import { useState, useEffect } from 'react';
import { api } from '@/api/adapter';
import { quotationApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { adToBs, getCurrentFiscalYear } from '@/lib/nepaliDate';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SmartNumberInput } from "@/components/ui/smart-number-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Plus, Trash2, ArrowRight, ClipboardList } from 'lucide-react';
import { useRole } from "@/lib/useRole";

const UNITS = ['Piece', 'Set', 'Liter', 'ml', 'Kg', 'gm', 'NOS'];
const STATUSES = ['pending', 'sent', 'accepted', 'rejected', 'expired'];
const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-500',
};

const EMPTY_FORM = {
  client_name: '', client_contact: '', client_address: '', client_pan: '',
  quotation_number: '', is_vat: false, payment_type: 'cash',
  date_ad: new Date().toISOString().split('T')[0],
  valid_until: '', status: 'pending', notes: '',
  items: [{ description: '', quantity: 1, unit: 'Piece', unit_price: 0, total: 0 }],
  labor_items: [{ description: '', amount: 0 }],
};

export default function Quotations() {
  const { canEdit } = useRole();
  const companyId = getActiveCompanyId();
  const [quotations, setQuotations] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({ client_name: '', quotation_number: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showNew, setShowNew] = useState(false);
  const [converting, setConverting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editQuotation, setEditQuotation] = useState(null);

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);
    const data = await api.Quotation.filter({ company_id: companyId });
    setQuotations(data);
    setLoading(false);
    return data;
  }

  async function loadClients() {
    const clientData = await api.Client.filter({ company_id: companyId });
    setClients(clientData);
  }

  function generateQuotationNumber(existing) {
    const fyLabel = getCurrentFiscalYear();
    const shortLabel = fyLabel.replace(/\d{2}(\d{2})\/(\d{2})(\d{2})/, '$1/$3');
    const prefix = `QT-${shortLabel}-`;
    const max = (existing || quotations)
      .filter(q => q.quotation_number?.startsWith(prefix))
      .reduce((m, q) => {
        const n = parseInt(q.quotation_number?.replace(prefix, '') || '0');
        return n > m ? n : m;
      }, 0);
    return `${prefix}${String(max + 1).padStart(3, '0')}`;
  }

  async function openNew() {
    const [data] = await Promise.all([loadData(), loadClients()]);
    setForm({ ...EMPTY_FORM, date_ad: new Date().toISOString().split('T')[0], quotation_number: generateQuotationNumber(data) });
    setShowNew(true);
  }

  function openEdit(quotation) {
    loadClients();
    setEditQuotation({
      ...quotation,
      items: quotation.items?.length ? quotation.items.map(i => ({ ...i })) : [{ description: '', quantity: 1, unit: 'Piece', unit_price: 0, total: 0 }],
      labor_items: quotation.labor_items?.length ? quotation.labor_items.map(li => ({ ...li })) : [{ description: '', amount: 0 }],
    });
  }

  // ── Form helpers (Add dialog) ────────────────────────────────────────────────
  function selectClientForForm(clientId) {
    const cl = clients.find(x => x.id === clientId);
    if (cl) {
      setForm(f => ({
        ...f,
        client_name: cl.name || '',
        client_contact: cl.contact_person || cl.phone || '',
        client_address: cl.address || '',
        client_pan: cl.pan_vat || '',
      }));
    }
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
    setForm({ ...form, items: [...form.items, { description: '', quantity: 1, unit: 'Piece', unit_price: 0, total: 0 }] });
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

  // ── Edit dialog helpers ──────────────────────────────────────────────────────
  function selectClientForEdit(clientId) {
    const cl = clients.find(x => x.id === clientId);
    if (cl) {
      setEditQuotation(eq => ({
        ...eq,
        client_name: cl.name || '',
        client_contact: cl.contact_person || cl.phone || '',
        client_address: cl.address || '',
        client_pan: cl.pan_vat || '',
      }));
    }
  }

  function updateEditItem(index, field, value) {
    const items = [...editQuotation.items];
    items[index] = { ...items[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      items[index].total = (items[index].quantity || 0) * (items[index].unit_price || 0);
    }
    setEditQuotation({ ...editQuotation, items });
  }

  function addEditItem() {
    setEditQuotation({ ...editQuotation, items: [...editQuotation.items, { description: '', quantity: 1, unit: 'Piece', unit_price: 0, total: 0 }] });
  }

  function removeEditItem(index) {
    if (editQuotation.items.length <= 1) return;
    setEditQuotation({ ...editQuotation, items: editQuotation.items.filter((_, i) => i !== index) });
  }

  function addEditLaborItem() {
    setEditQuotation({ ...editQuotation, labor_items: [...editQuotation.labor_items, { description: '', amount: 0 }] });
  }

  function updateEditLaborItem(index, field, value) {
    const labor_items = [...editQuotation.labor_items];
    labor_items[index] = { ...labor_items[index], [field]: value };
    setEditQuotation({ ...editQuotation, labor_items });
  }

  function removeEditLaborItem(index) {
    if (editQuotation.labor_items.length <= 1) return;
    setEditQuotation({ ...editQuotation, labor_items: editQuotation.labor_items.filter((_, i) => i !== index) });
  }

  // ── API actions ──────────────────────────────────────────────────────────────
  async function createQuotation() {
    const entryDate = form.date_ad || new Date().toISOString().split('T')[0];
    const bsDate = adToBs(new Date(entryDate));
    const totalLabor = form.labor_items.reduce((s, li) => s + (Number(li.amount) || 0), 0);
    const itemsSubtotal = form.items.reduce((sum, i) => sum + (i.total || 0), 0);
    const subtotal = itemsSubtotal + totalLabor;
    const vatAmount = form.is_vat ? subtotal * 0.13 : 0;

    await api.Quotation.create({
      company_id: companyId,
      client_name: form.client_name,
      client_contact: form.client_contact,
      client_address: form.client_address,
      client_pan: form.client_pan,
      date_ad: entryDate,
      date_bs: bsDate.formatted,
      valid_until: form.valid_until || null,
      quotation_number: form.quotation_number,
      payment_type: form.payment_type,
      items: form.items,
      labor_items: form.labor_items,
      is_vat: form.is_vat,
      notes: form.notes,
      subtotal,
      vat_amount: vatAmount,
      total_amount: subtotal + vatAmount,
      status: form.status,
    });

    setShowNew(false);
    loadData();
  }

  async function updateQuotation() {
    if (!editQuotation) return;
    const itemsSubtotal = editQuotation.items.reduce((s, i) => s + (i.total || 0), 0);
    const labourTotal = editQuotation.labor_items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const vatAmount = editQuotation.is_vat ? (itemsSubtotal + labourTotal) * 0.13 : 0;
    await api.Quotation.update(editQuotation.id, {
      ...editQuotation,
      items_subtotal: itemsSubtotal,
      labour_total: labourTotal,
      subtotal: itemsSubtotal + labourTotal,
      vat_amount: vatAmount,
      total_amount: itemsSubtotal + labourTotal + vatAmount,
    });
    setEditQuotation(null);
    loadData();
  }

  async function convertToSale(quotation) {
    setConverting(quotation.id);
    try {
      await quotationApi.convert(quotation.id);
      await loadData();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to convert quotation to sale');
    } finally {
      setConverting(null);
    }
  }

  // ── Derived calculations ─────────────────────────────────────────────────────
  const filtered = quotations.filter(q =>
    (q.client_name?.toLowerCase().includes(search.toLowerCase()) ||
     q.quotation_number?.toLowerCase().includes(search.toLowerCase())) &&
    (!colFilters.client_name || q.client_name?.toLowerCase().includes(colFilters.client_name.toLowerCase())) &&
    (!colFilters.quotation_number || (q.quotation_number || '').toLowerCase().includes(colFilters.quotation_number.toLowerCase())) &&
    (!colFilters.status || (q.status || '').toLowerCase().includes(colFilters.status.toLowerCase()))
  );

  const totalLabor = form.labor_items.reduce((s, li) => s + (Number(li.amount) || 0), 0);
  const itemsSubtotal = form.items.reduce((sum, i) => sum + (i.total || 0), 0);
  const subtotal = itemsSubtotal + totalLabor;
  const vatAmount = form.is_vat ? subtotal * 0.13 : 0;

  const editTotalLabor = editQuotation ? editQuotation.labor_items.reduce((s, li) => s + (Number(li.amount) || 0), 0) : 0;
  const editItemsSubtotal = editQuotation ? editQuotation.items.reduce((sum, i) => sum + (i.total || 0), 0) : 0;
  const editSubtotal = editItemsSubtotal + editTotalLabor;
  const editVatAmount = editQuotation?.is_vat ? editSubtotal * 0.13 : 0;

  const columns = [
    {
      key: 'date_ad', label: 'Date', render: (row) => (
        <div className="text-xs">
          <div>{row.date_ad}</div>
          <div className="text-muted-foreground">{row.date_bs}</div>
        </div>
      ),
    },
    { key: 'quotation_number', label: 'Quote #', filterValue: colFilters.quotation_number, onFilterChange: v => setCol('quotation_number', v) },
    { key: 'client_name', label: 'Client', filterValue: colFilters.client_name, onFilterChange: v => setCol('client_name', v), render: (row) => <span className="font-medium">{row.client_name}</span> },
    {
      key: 'valid_until', label: 'Valid Until', render: (row) => row.valid_until
        ? <span className="text-xs font-mono">{row.valid_until}</span>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    { key: 'is_vat', label: 'VAT', render: (row) => <Badge variant={row.is_vat ? 'default' : 'secondary'}>{row.is_vat ? 'VAT' : 'Non-VAT'}</Badge> },
    { key: 'total_amount', label: 'Total', render: (row) => <span className="font-semibold font-mono">NPR {(row.total_amount || 0).toLocaleString()}</span> },
    {
      key: 'status', label: 'Status', filterValue: colFilters.status, onFilterChange: v => setCol('status', v), filterPlaceholder: 'e.g. pending', render: (row) => (
        <select
          value={row.status || 'pending'}
          onClick={e => e.stopPropagation()}
          onChange={async e => {
            await api.Quotation.update(row.id, { status: e.target.value });
            loadData();
          }}
          className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer outline-none ${STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-600'}`}
        >
          {STATUSES.map(s => <option key={s} value={s} className="bg-background text-foreground capitalize">{s}</option>)}
        </select>
      ),
    },
    {
      key: 'actions', label: '', render: (row) => canEdit && (row.status !== 'accepted' && row.status !== 'rejected') && (
        <Button
          size="sm"
          variant="outline"
          onClick={e => { e.stopPropagation(); convertToSale(row); }}
          disabled={converting === row.id}
          className="text-xs whitespace-nowrap"
        >
          {converting === row.id ? 'Converting...' : <><ArrowRight className="w-3 h-3 mr-1" />To Sale</>}
        </Button>
      ),
    },
  ];

  if (loading) return <PageLoader />;

  // ── Reusable dialog body renderer ────────────────────────────────────────────
  function DialogBody({ data, setData, onClientSelect, items, onUpdateItem, onAddItem, onRemoveItem, laborItems, onUpdateLabor, onAddLabor, onRemoveLabor, calcSubtotal, calcLabor, calcVat }) {
    return (
      <div className="flex gap-6 overflow-hidden" style={{ maxHeight: 'calc(90vh - 130px)' }}>

        {/* LEFT COLUMN */}
        <div className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto pr-1">

          {/* Client Details */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Client Details</p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Select Saved Client</Label>
                <Select onValueChange={onClientSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select saved client (or type below)" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Client Name *</Label>
                <Input value={data.client_name} onChange={e => setData(d => ({ ...d, client_name: e.target.value }))} placeholder="Full name or business name" />
              </div>
              <div>
                <Label className="text-xs">Contact <span className="text-muted-foreground">(optional)</span></Label>
                <Input value={data.client_contact} onChange={e => setData(d => ({ ...d, client_contact: e.target.value }))} placeholder="Phone number" />
              </div>
              <div>
                <Label className="text-xs">Address <span className="text-muted-foreground">(optional)</span></Label>
                <Input value={data.client_address} onChange={e => setData(d => ({ ...d, client_address: e.target.value }))} placeholder="City / address" />
              </div>
              <div>
                <Label className="text-xs">PAN / VAT No. <span className="text-muted-foreground">(optional)</span></Label>
                <Input value={data.client_pan} onChange={e => setData(d => ({ ...d, client_pan: e.target.value }))} placeholder="e.g. 123456789" />
              </div>
            </div>
          </div>

          {/* Quotation Details */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quotation Details</p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Date *</Label>
                <Input type="date" value={data.date_ad} onChange={e => setData(d => ({ ...d, date_ad: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Quotation Number</Label>
                <Input value={data.quotation_number} onChange={e => setData(d => ({ ...d, quotation_number: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Valid Until <span className="text-muted-foreground">(optional)</span></Label>
                <Input type="date" value={data.valid_until || ''} onChange={e => setData(d => ({ ...d, valid_until: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={data.status || 'pending'} onValueChange={v => setData(d => ({ ...d, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment</p>
            <div className="flex gap-3">
              {['cash', 'cheque', 'credit'].map(type => (
                <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`qt_payment_${data.id || 'new'}`}
                    value={type}
                    checked={data.payment_type === type}
                    onChange={() => setData(d => ({ ...d, payment_type: type }))}
                    className="accent-primary"
                  />
                  <span className="text-sm capitalize">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* VAT */}
          <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
            <Switch checked={data.is_vat} onCheckedChange={v => setData(d => ({ ...d, is_vat: v }))} />
            <Label>Include VAT (13%)</Label>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto pl-1">

          {/* Items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items</p>
              <Button size="sm" variant="outline" onClick={onAddItem}><Plus className="w-3 h-3 mr-1" />Add Item</Button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-end p-3 bg-secondary/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    {idx === 0 && <Label className="text-xs">Description</Label>}
                    <Input value={item.description} onChange={e => onUpdateItem(idx, 'description', e.target.value)} placeholder="Item or service description" />
                  </div>
                  <div style={{ width: 64 }}>
                    {idx === 0 && <Label className="text-xs">Qty</Label>}
                    <SmartNumberInput value={item.quantity} onChange={e => onUpdateItem(idx, 'quantity', parseInt(e.target.value) || 0)} />
                  </div>
                  <div style={{ width: 90 }}>
                    {idx === 0 && <Label className="text-xs">Unit</Label>}
                    <Select value={item.unit || 'Piece'} onValueChange={v => onUpdateItem(idx, 'unit', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div style={{ width: 100 }}>
                    {idx === 0 && <Label className="text-xs">Unit Price</Label>}
                    <SmartNumberInput value={item.unit_price} onChange={e => onUpdateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div style={{ width: 110 }}>
                    {idx === 0 && <Label className="text-xs">Total</Label>}
                    <Input value={`NPR ${(item.total || 0).toLocaleString()}`} disabled className="font-mono" />
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => onRemoveItem(idx)} disabled={items.length <= 1}>
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Labour */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Work / Labour Charges <span className="text-muted-foreground font-normal normal-case">(optional)</span></p>
              <Button size="sm" variant="outline" onClick={onAddLabor}><Plus className="w-3 h-3 mr-1" />Add Row</Button>
            </div>
            <div className="space-y-2">
              {laborItems.map((li, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-secondary/50 rounded-lg">
                  <div className="col-span-7">
                    {idx === 0 && <Label className="text-xs">Work Description</Label>}
                    <Input value={li.description} onChange={e => onUpdateLabor(idx, 'description', e.target.value)} placeholder="e.g. Installation, Consulting..." />
                  </div>
                  <div className="col-span-3">
                    {idx === 0 && <Label className="text-xs">Amount (NPR)</Label>}
                    <SmartNumberInput value={li.amount} onChange={e => onUpdateLabor(idx, 'amount', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button size="icon" variant="ghost" onClick={() => onRemoveLabor(idx)} disabled={laborItems.length <= 1}>
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
              <span>Items Subtotal</span>
              <span className="font-mono">NPR {calcSubtotal.toLocaleString()}</span>
            </div>
            {calcLabor > 0 && (
              <div className="flex justify-between text-sm">
                <span>Labour Total</span>
                <span className="font-mono">NPR {calcLabor.toLocaleString()}</span>
              </div>
            )}
            {data.is_vat && (
              <div className="flex justify-between text-sm">
                <span>VAT (13%)</span>
                <span className="font-mono">NPR {calcVat.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t pt-2">
              <span>Total</span>
              <span className="font-mono">NPR {(calcSubtotal + calcLabor + calcVat).toLocaleString()}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs">Notes / Terms <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              value={data.notes}
              onChange={e => setData(d => ({ ...d, notes: e.target.value }))}
              placeholder="Payment terms, validity conditions, special notes..."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Quotations"
        subtitle="Quotes & proposals for clients"
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={openNew}
        addLabel="New Quotation"
      />

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATUSES.map(s => (
          <div key={s} className="glass-card rounded-xl border p-3 text-center">
            <p className="text-xl font-bold">{quotations.filter(q => q.status === s).length}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{s}</p>
          </div>
        ))}
      </div>

      {quotations.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No quotations yet"
          description="Create your first quotation or proposal for a client."
          action={
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" />New Quotation
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage="No quotations match your filters."
          onRowClick={canEdit ? openEdit : undefined}
        />
      )}

      {/* ── Add Quotation Dialog ── */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden glass-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              New Quotation
            </DialogTitle>
          </DialogHeader>

          <DialogBody
            data={form}
            setData={setForm}
            onClientSelect={selectClientForForm}
            items={form.items}
            onUpdateItem={updateItem}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            laborItems={form.labor_items}
            onUpdateLabor={updateLaborItem}
            onAddLabor={addLaborItem}
            onRemoveLabor={removeLaborItem}
            calcSubtotal={itemsSubtotal}
            calcLabor={totalLabor}
            calcVat={vatAmount}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={createQuotation} disabled={!form.client_name}>Save Quotation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Quotation Dialog ── */}
      <Dialog open={!!editQuotation} onOpenChange={open => { if (!open) setEditQuotation(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden glass-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Edit Quotation — {editQuotation?.quotation_number}
            </DialogTitle>
          </DialogHeader>

          {editQuotation && (
            <DialogBody
              data={editQuotation}
              setData={setEditQuotation}
              onClientSelect={selectClientForEdit}
              items={editQuotation.items}
              onUpdateItem={updateEditItem}
              onAddItem={addEditItem}
              onRemoveItem={removeEditItem}
              laborItems={editQuotation.labor_items}
              onUpdateLabor={updateEditLaborItem}
              onAddLabor={addEditLaborItem}
              onRemoveLabor={removeEditLaborItem}
              calcSubtotal={editItemsSubtotal}
              calcLabor={editTotalLabor}
              calcVat={editVatAmount}
            />
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditQuotation(null)}>Cancel</Button>
            <Button onClick={updateQuotation} disabled={!editQuotation?.client_name}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
