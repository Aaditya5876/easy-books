import { useState, useEffect } from 'react';
import { api } from '@/api/adapter';
import { getActiveCompanyId } from '@/lib/companyContext';
import { adToBs, getCurrentFiscalYear } from '@/lib/nepaliDate';
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
import { Plus, Trash2, ArrowRight } from 'lucide-react';

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
  valid_until: '',
  notes: '',
  status: 'pending',
  items: [{ description: '', quantity: 1, unit: 'Piece', unit_price: 0, total: 0 }],
  labor_items: [{ description: '', amount: 0 }],
};

export default function Quotations() {
  const companyId = getActiveCompanyId();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({ client_name: '', quotation_number: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showNew, setShowNew] = useState(false);
  const [converting, setConverting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

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
    const data = await loadData();
    setForm({ ...EMPTY_FORM, date_ad: new Date().toISOString().split('T')[0], quotation_number: generateQuotationNumber(data) });
    setShowNew(true);
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

  async function createQuotation() {
    const entryDate = form.date_ad || new Date().toISOString().split('T')[0];
    const bsDate = adToBs(new Date(entryDate));
    const totalLabor = form.labor_items.reduce((s, li) => s + (li.amount || 0), 0);
    const subtotal = form.items.reduce((sum, i) => sum + (i.total || 0), 0) + totalLabor;
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

  async function convertToSale(quotation) {
    setConverting(quotation.id);
    try {
      const today = new Date().toISOString().split('T')[0];
      const bsDate = adToBs(new Date());
      const existingSales = await api.SalesOrder.filter({ company_id: companyId });
      const fyLabel = getCurrentFiscalYear();
      const shortLabel = fyLabel.replace(/\d{2}(\d{2})\/(\d{2})(\d{2})/, '$1/$3');
      const prefix = quotation.is_vat ? `VAT-${shortLabel}-` : `INV-${shortLabel}-`;
      const maxSerial = existingSales
        .filter(o => o.invoice_number?.startsWith(prefix))
        .reduce((m, o) => {
          const n = parseInt(o.invoice_number?.replace(prefix, '') || '0');
          return n > m ? n : m;
        }, 0);
      const invoiceNumber = `${prefix}${String(maxSerial + 1).padStart(3, '0')}`;
      const laborTotal = (quotation.labor_items || []).reduce((s, li) => s + (li.amount || 0), 0);

      await api.SalesOrder.create({
        company_id: companyId,
        client_name: quotation.client_name,
        client_contact: quotation.client_contact,
        client_address: quotation.client_address,
        client_pan: quotation.client_pan,
        date_ad: today,
        date_bs: bsDate.formatted,
        invoice_number: invoiceNumber,
        payment_type: quotation.payment_type || 'cash',
        items: quotation.items || [],
        work_description: (quotation.labor_items || []).map(li => li.description).filter(Boolean).join('; '),
        labor_charges: laborTotal,
        is_vat: quotation.is_vat,
        notes: quotation.notes,
        subtotal: quotation.subtotal,
        vat_amount: quotation.vat_amount,
        total_amount: quotation.total_amount,
        status: 'confirmed',
      });

      await api.Quotation.update(quotation.id, { status: 'accepted' });
      loadData();
    } finally {
      setConverting(null);
    }
  }

  const filtered = quotations.filter(q =>
    (q.client_name?.toLowerCase().includes(search.toLowerCase()) ||
     q.quotation_number?.toLowerCase().includes(search.toLowerCase())) &&
    (!colFilters.client_name || q.client_name?.toLowerCase().includes(colFilters.client_name.toLowerCase())) &&
    (!colFilters.quotation_number || (q.quotation_number || '').toLowerCase().includes(colFilters.quotation_number.toLowerCase())) &&
    (!colFilters.status || (q.status || '').toLowerCase().includes(colFilters.status.toLowerCase()))
  );

  const totalLabor = form.labor_items.reduce((s, li) => s + (li.amount || 0), 0);
  const subtotal = form.items.reduce((sum, i) => sum + (i.total || 0), 0) + totalLabor;
  const vatAmount = form.is_vat ? subtotal * 0.13 : 0;

  const columns = [
    { key: 'date_ad', label: 'Date', render: (row) => (
      <div className="text-xs"><div>{row.date_ad}</div><div className="text-muted-foreground">{row.date_bs}</div></div>
    )},
    { key: 'quotation_number', label: 'Quote #', filterValue: colFilters.quotation_number, onFilterChange: v => setCol('quotation_number', v) },
    { key: 'client_name', label: 'Client', filterValue: colFilters.client_name, onFilterChange: v => setCol('client_name', v), render: (row) => <span className="font-medium">{row.client_name}</span> },
    { key: 'valid_until', label: 'Valid Until', render: (row) => row.valid_until
      ? <span className="text-xs font-mono">{row.valid_until}</span>
      : <span className="text-muted-foreground text-xs">—</span>
    },
    { key: 'is_vat', label: 'VAT', render: (row) => <Badge variant={row.is_vat ? 'default' : 'secondary'}>{row.is_vat ? 'VAT' : 'Non-VAT'}</Badge> },
    { key: 'total_amount', label: 'Total', render: (row) => <span className="font-semibold font-mono">NPR {(row.total_amount || 0).toLocaleString()}</span> },
    { key: 'status', label: 'Status', filterValue: colFilters.status, onFilterChange: v => setCol('status', v), filterPlaceholder: 'e.g. pending', render: (row) => (
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
    )},
    { key: 'actions', label: '', render: (row) => (row.status !== 'accepted' && row.status !== 'rejected') && (
      <Button
        size="sm"
        variant="outline"
        onClick={e => { e.stopPropagation(); convertToSale(row); }}
        disabled={converting === row.id}
        className="text-xs whitespace-nowrap"
      >
        {converting === row.id ? 'Converting...' : <><ArrowRight className="w-3 h-3 mr-1" />To Sale</>}
      </Button>
    )},
  ];

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

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

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATUSES.map(s => (
          <div key={s} className="bg-card rounded-xl border p-3 text-center">
            <p className="text-xl font-bold">{quotations.filter(q => q.status === s).length}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{s}</p>
          </div>
        ))}
      </div>

      <DataTable columns={columns} data={filtered} emptyMessage="No quotations yet. Click 'New Quotation' to create one." />

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Quotation</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>Client Name *</Label><Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} /></div>
              <div><Label>Contact <span className="text-muted-foreground text-xs">(optional)</span></Label><Input value={form.client_contact} onChange={e => setForm({ ...form, client_contact: e.target.value })} /></div>
              <div><Label>Address <span className="text-muted-foreground text-xs">(optional)</span></Label><Input value={form.client_address} onChange={e => setForm({ ...form, client_address: e.target.value })} /></div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><Label>Date *</Label><Input type="date" value={form.date_ad} onChange={e => setForm({ ...form, date_ad: e.target.value })} /></div>
              <div><Label>Valid Until <span className="text-muted-foreground text-xs">(optional)</span></Label><Input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} /></div>
              <div><Label>Quotation No.</Label><Input value={form.quotation_number} onChange={e => setForm({ ...form, quotation_number: e.target.value })} /></div>
              <div><Label>Client PAN/VAT <span className="text-muted-foreground text-xs">(optional)</span></Label><Input value={form.client_pan} onChange={e => setForm({ ...form, client_pan: e.target.value })} placeholder="e.g. 123456789" /></div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
              <Switch checked={form.is_vat} onCheckedChange={v => setForm({ ...form, is_vat: v })} />
              <Label>Include VAT (13%)</Label>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-sm font-semibold">Items</Label>
                <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Add Item</Button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-end p-3 bg-secondary/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      {idx === 0 && <Label className="text-xs">Description</Label>}
                      <Input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Item or service description" />
                    </div>
                    <div style={{width: 70}}>
                      {idx === 0 && <Label className="text-xs">Qty</Label>}
                      <Input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)} />
                    </div>
                    <div style={{width: 90}}>
                      {idx === 0 && <Label className="text-xs">Unit</Label>}
                      <Select value={item.unit || 'Piece'} onValueChange={v => updateItem(idx, 'unit', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div style={{width: 110}}>
                      {idx === 0 && <Label className="text-xs">Unit Price</Label>}
                      <Input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div style={{width: 120}}>
                      {idx === 0 && <Label className="text-xs">Total</Label>}
                      <Input value={`NPR ${(item.total || 0).toLocaleString()}`} disabled className="font-mono" />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} disabled={form.items.length <= 1}>
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-sm font-semibold">Work / Labour Charges <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <Button size="sm" variant="outline" onClick={addLaborItem}><Plus className="w-3 h-3 mr-1" />Add Row</Button>
              </div>
              {form.labor_items.map((li, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-secondary/50 rounded-lg mb-2">
                  <div className="col-span-7">
                    {idx === 0 && <Label className="text-xs">Work Description</Label>}
                    <Input value={li.description} onChange={e => updateLaborItem(idx, 'description', e.target.value)} placeholder="e.g. Installation, Consulting..." />
                  </div>
                  <div className="col-span-3">
                    {idx === 0 && <Label className="text-xs">Amount (NPR)</Label>}
                    <Input type="number" value={li.amount} onChange={e => updateLaborItem(idx, 'amount', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button size="icon" variant="ghost" onClick={() => removeLaborItem(idx)} disabled={form.labor_items.length <= 1}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-secondary rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm"><span>Items Subtotal</span><span className="font-mono">NPR {form.items.reduce((s, i) => s + (i.total || 0), 0).toLocaleString()}</span></div>
              {totalLabor > 0 && <div className="flex justify-between text-sm"><span>Labour Total</span><span className="font-mono">NPR {totalLabor.toLocaleString()}</span></div>}
              {form.is_vat && <div className="flex justify-between text-sm"><span>VAT (13%)</span><span className="font-mono">NPR {vatAmount.toLocaleString()}</span></div>}
              <div className="flex justify-between font-bold border-t pt-2"><span>Total</span><span className="font-mono">NPR {(subtotal + vatAmount).toLocaleString()}</span></div>
            </div>

            <div>
              <Label>Notes / Terms <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Payment terms, validity conditions, special notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={createQuotation} disabled={!form.client_name}>Save Quotation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
