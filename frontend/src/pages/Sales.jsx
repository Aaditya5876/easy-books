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
import { Plus, Trash2, Receipt } from 'lucide-react';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';

const UNITS = ['Piece', 'Set', 'Liter', 'ml', 'Kg', 'gm', 'NOS'];

const EMPTY_FORM = {
  client_name: '', client_contact: '', client_address: '', client_pan: '',
  invoice_number: '', is_vat: false, payment_type: 'cash',
  date_ad: new Date().toISOString().split('T')[0],
  due_date: '',
  notes: '',
  items: [{ inventory_item_id: '', description: '', quantity: 1, unit: 'Piece', unit_price: 0, total: 0 }],
  labor_items: [{ description: '', amount: 0 }],
};

export default function Sales() {
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
      unit: invItem.unit || 'Piece',
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
      items: [...form.items, { inventory_item_id: '', description: '', quantity: 1, unit: 'Piece', unit_price: 0, total: 0 }],
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

    await api.SalesOrder.create({
      company_id: companyId,
      client_name: form.client_name,
      client_contact: form.client_contact,
      client_address: form.client_address,
      client_pan: form.client_pan,
      date_ad: entryDate,
      date_bs: bsDate.formatted,
      due_date: form.due_date || null,
      invoice_number: form.invoice_number,
      payment_type: form.payment_type,
      items: form.items,
      work_description: form.labor_items.map(li => li.description).filter(Boolean).join('; '),
      labor_charges: totalLabor,
      is_vat: form.is_vat,
      notes: form.notes,
      subtotal,
      vat_amount: vatAmount,
      total_amount: subtotal + vatAmount,
      status: 'confirmed',
    });

    // Auto-create client if not exists
    const existingClients = await api.Client.filter({ company_id: companyId, name: form.client_name });
    if (existingClients.length === 0 && form.client_name) {
      await api.Client.create({
        company_id: companyId,
        name: form.client_name,
        phone: form.client_contact,
        address: form.client_address,
        crm_status: 'active',
      });
    }

    // Deduct inventory
    for (const item of form.items) {
      if (item.inventory_item_id) {
        const invItem = inventory.find(i => i.id === item.inventory_item_id);
        if (invItem) {
          await api.InventoryItem.update(item.inventory_item_id, {
            quantity: Math.max(0, (invItem.quantity || 0) - (item.quantity || 0)),
          });
        }
      }
    }

    setForm({
      ...EMPTY_FORM,
      date_ad: new Date().toISOString().split('T')[0],
    });
    setShowNew(false);
    loadData();

    if (shouldPrint) {
      const total = subtotal + vatAmount;
      const win = window.open('', '_blank');
      win.document.write(`<html><head><title>Invoice ${form.invoice_number}</title><style>
        body{font-family:sans-serif;padding:32px;color:#111}h1{font-size:22px;margin:0}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}
        th{background:#f5f5f5}.meta{font-size:13px;color:#555;margin-top:4px}
        .header{display:flex;justify-content:space-between;margin-bottom:24px}
      </style></head><body>
      <div class='header'>
        <div><h1>${form.is_vat ? 'TAX INVOICE' : 'INVOICE'}</h1><div class='meta'>Invoice #: <b>${form.invoice_number}</b></div><div class='meta'>Date: ${entryDate} | BS: ${bsDate.formatted}</div>${form.due_date ? `<div class='meta'>Due: ${form.due_date}</div>` : ''}</div>
        <div style='text-align:right'><div class='meta'>Client: <b>${form.client_name}</b></div><div class='meta'>${form.client_contact || ''}</div><div class='meta'>${form.client_address || ''}</div>${form.client_pan ? `<div class='meta'>PAN/VAT: ${form.client_pan}</div>` : ''}</div>
      </div>
      ${form.labor_items.some(li => li.description) ? `<div class='meta' style='margin-bottom:12px'>Work: ${form.labor_items.map(li => li.description).filter(Boolean).join('; ')}</div>` : ''}
      <table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>
        ${form.items.map((item, i) => `<tr><td>${i + 1}</td><td>${item.description || '-'}</td><td>${item.quantity}</td><td>NPR ${(item.unit_price || 0).toLocaleString()}</td><td>NPR ${(item.total || 0).toLocaleString()}</td></tr>`).join('')}
      </tbody></table>
      <div style='margin-top:16px;text-align:right'>
        ${totalLabor > 0 ? `<div class='meta'>Labor: NPR ${totalLabor.toLocaleString()}</div>` : ''}
        ${form.is_vat ? `<div class='meta'>VAT (13%): NPR ${vatAmount.toLocaleString()}</div>` : ''}
        <div style='font-weight:bold;font-size:15px;margin-top:8px'>TOTAL: NPR ${total.toLocaleString()}</div>
        ${form.is_vat ? `<div class='meta'>Tax Invoice</div>` : ''}
      </div>
      ${form.notes ? `<div class='meta' style='margin-top:16px;padding-top:12px;border-top:1px solid #eee'>Notes: ${form.notes}</div>` : ''}
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
    (!colFilters.status || (o.status || '').toLowerCase().includes(colFilters.status.toLowerCase()))
  );

  const totalLabor = form.labor_items.reduce((s, li) => s + (Number(li.amount) || 0), 0);
  const itemsSubtotal = form.items.reduce((sum, i) => sum + (i.total || 0), 0);
  const subtotal = itemsSubtotal + totalLabor;
  const vatAmount = form.is_vat ? subtotal * 0.13 : 0;

  const columns = [
    {
      key: 'date_ad', label: 'Date', render: (row) => (
        <div className="text-xs">
          <div>{row.date_ad}</div>
          <div className="text-muted-foreground">{row.date_bs}</div>
        </div>
      ),
    },
    { key: 'invoice_number', label: 'Invoice #', filterValue: colFilters.invoice_number, onFilterChange: v => setCol('invoice_number', v) },
    { key: 'client_name', label: 'Client', filterValue: colFilters.client_name, onFilterChange: v => setCol('client_name', v), render: (row) => <span className="font-medium">{row.client_name}</span> },
    { key: 'items', label: 'Items', render: (row) => <span>{row.items?.length || 0} items</span> },
    { key: 'payment_type', label: 'Payment', render: (row) => <Badge variant="outline" className="capitalize">{row.payment_type || 'cash'}</Badge> },
    { key: 'is_vat', label: 'VAT', render: (row) => <Badge variant={row.is_vat ? 'default' : 'secondary'}>{row.is_vat ? 'VAT' : 'Non-VAT'}</Badge> },
    { key: 'total_amount', label: 'Total', render: (row) => <span className="font-semibold font-mono">NPR {(row.total_amount || 0).toLocaleString()}</span> },
    { key: 'status', label: 'Status', filterValue: colFilters.status, onFilterChange: v => setCol('status', v), filterPlaceholder: 'e.g. confirmed', render: (row) => <Badge>{row.status}</Badge> },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Sales"
        subtitle="Sales orders and invoices"
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={openNewSale}
        addLabel="New Sale"
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No sales orders yet"
          description="Create your first invoice to get started."
          action={<Button onClick={openNewSale}>New Sale</Button>}
        />
      ) : (
        <DataTable columns={columns} data={filtered} emptyMessage="No sales orders match your search." />
      )}

      {/* New Sale Dialog — two-column layout */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden glass-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              New Sales Entry
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-6 overflow-hidden" style={{ maxHeight: 'calc(90vh - 130px)' }}>

            {/* LEFT COLUMN — Client + Invoice details */}
            <div className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto pr-1">

              {/* Client Details */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Client Details</p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Select Saved Client</Label>
                    <Select onValueChange={selectClientFromDropdown}>
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
                    <Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder="Full name or business name" />
                  </div>
                  <div>
                    <Label className="text-xs">Contact <span className="text-muted-foreground">(optional)</span></Label>
                    <Input value={form.client_contact} onChange={e => setForm({ ...form, client_contact: e.target.value })} placeholder="Phone number" />
                  </div>
                  <div>
                    <Label className="text-xs">Address <span className="text-muted-foreground">(optional)</span></Label>
                    <Input value={form.client_address} onChange={e => setForm({ ...form, client_address: e.target.value })} placeholder="City / address" />
                  </div>
                  <div>
                    <Label className="text-xs">PAN / VAT No. <span className="text-muted-foreground">(optional)</span></Label>
                    <Input value={form.client_pan} onChange={e => setForm({ ...form, client_pan: e.target.value })} placeholder="e.g. 123456789" />
                  </div>
                </div>
              </div>

              {/* Invoice Details */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Invoice Details</p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Invoice Date *</Label>
                    <Input type="date" value={form.date_ad} onChange={e => setForm({ ...form, date_ad: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Invoice Number</Label>
                    <Input value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Due Date <span className="text-muted-foreground">(credit)</span></Label>
                    <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Payment Type */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment</p>
                <div className="flex gap-3">
                  {['cash', 'cheque', 'credit'].map(type => (
                    <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="sale_payment_type"
                        value={type}
                        checked={form.payment_type === type}
                        onChange={() => setForm({ ...form, payment_type: type })}
                        className="accent-primary"
                      />
                      <span className="text-sm capitalize">{type}</span>
                    </label>
                  ))}
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
                <Label>VAT Bill (13%)</Label>
              </div>
            </div>

            {/* RIGHT COLUMN — Items + Labour + Summary + Notes */}
            <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto pl-1">

              {/* Items */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items</p>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Add Item</Button>
                </div>
                <div className="space-y-2">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-secondary/50 rounded-lg">
                      <div className="col-span-4">
                        {idx === 0 && <Label className="text-xs">From Inventory / Description</Label>}
                        <Select
                          value={item.inventory_item_id || 'custom'}
                          onValueChange={v => v === 'custom' ? updateItem(idx, 'inventory_item_id', '') : selectInventoryItem(idx, v)}
                        >
                          <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">Custom Item</SelectItem>
                            {inventory.map(inv => (
                              <SelectItem key={inv.id} value={inv.id}>{inv.description} ({inv.quantity} {inv.unit})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <Label className="text-xs">Description</Label>}
                        <Input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Name" />
                      </div>
                      <div className="col-span-1">
                        {idx === 0 && <Label className="text-xs">Qty</Label>}
                        <Input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <Label className="text-xs">Unit Price</Label>}
                        <Input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <Label className="text-xs">Total</Label>}
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
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Work / Labour Charges</p>
                  <Button size="sm" variant="outline" onClick={addLaborItem}><Plus className="w-3 h-3 mr-1" />Add Row</Button>
                </div>
                <div className="space-y-2">
                  {form.labor_items.map((li, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-secondary/50 rounded-lg">
                      <div className="col-span-7">
                        {idx === 0 && <Label className="text-xs">Work Description</Label>}
                        <Input value={li.description} onChange={e => updateLaborItem(idx, 'description', e.target.value)} placeholder="e.g. Installation, Repair..." />
                      </div>
                      <div className="col-span-3">
                        {idx === 0 && <Label className="text-xs">Amount (NPR)</Label>}
                        <Input type="number" value={li.amount} onChange={e => updateLaborItem(idx, 'amount', parseFloat(e.target.value) || 0)} />
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
                  <span>Items Subtotal</span>
                  <span className="font-mono">NPR {itemsSubtotal.toLocaleString()}</span>
                </div>
                {totalLabor > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Labour Total</span>
                    <span className="font-mono">NPR {totalLabor.toLocaleString()}</span>
                  </div>
                )}
                {form.is_vat && (
                  <div className="flex justify-between text-sm">
                    <span>VAT (13%)</span>
                    <span className="font-mono">NPR {vatAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total</span>
                  <span className="font-mono">NPR {(subtotal + vatAmount).toLocaleString()}</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs">Notes / Remarks <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Special instructions, payment terms..."
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={() => createOrder(false)} disabled={!form.client_name} variant="secondary">Save Sale</Button>
            <Button onClick={() => createOrder(true)} disabled={!form.client_name}>Save &amp; Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
