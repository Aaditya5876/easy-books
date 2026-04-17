import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getActiveCompanyId } from '@/lib/companyContext';
import { adToBs } from '@/lib/nepaliDate';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Plus, Trash2 } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

const UNITS = ['Piece', 'Set', 'Liter', 'ml', 'Kg', 'gm', 'NOS'];

export default function Purchase() {
  const companyId = getActiveCompanyId();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({ vendor_name: '', order_number: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    vendor_name: '', vendor_contact: '', vendor_address: '',
    order_number: '', ordered_by: '',
    payment_type: 'cash',
    is_vat: false,
    items: [{ description: '', quantity: 1, unit: 'Piece', unit_price: 0, total: 0 }],
    labor_items: [{ description: '', amount: 0 }]
  });

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);
    const data = await base44.entities.PurchaseOrder.filter({ company_id: companyId }, '-created_date', 50);
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
      items: [...form.items, { description: '', quantity: 1, unit: 'Piece', unit_price: 0, total: 0 }]
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

  async function createOrder() {
    const today = new Date().toISOString().split('T')[0];
    const bsDate = adToBs(new Date());
    const laborTotal = form.labor_items.reduce((s, li) => s + (li.amount || 0), 0);
    const subtotal = form.items.reduce((sum, i) => sum + (i.total || 0), 0) + laborTotal;
    const vatAmount = form.is_vat ? subtotal * 0.13 : 0;

    await base44.entities.PurchaseOrder.create({
      company_id: companyId,
      vendor_name: form.vendor_name,
      vendor_contact: form.vendor_contact,
      vendor_address: form.vendor_address,
      date_ad: today,
      date_bs: bsDate.formatted,
      order_number: form.order_number,
      ordered_by: form.ordered_by,
      items: form.items,
      work_description: form.labor_items.map(li => li.description).filter(Boolean).join(', '),
      payment_type: form.payment_type,
      is_vat: form.is_vat,
      subtotal,
      vat_amount: vatAmount,
      total_amount: subtotal + vatAmount,
      status: 'confirmed',
    });

    // Auto-create vendor if not exists
    const existingVendors = await base44.entities.Vendor.filter({ company_id: companyId, name: form.vendor_name });
    if (existingVendors.length === 0 && form.vendor_name) {
      await base44.entities.Vendor.create({
        company_id: companyId,
        name: form.vendor_name,
        phone: form.vendor_contact,
        address: form.vendor_address,
      });
    }

    // Update inventory for purchased items
    for (const item of form.items) {
      if (item.description) {
        await base44.entities.InventoryItem.create({
          company_id: companyId,
          description: item.description,
          quantity: item.quantity || 0,
          unit: item.unit || 'Piece',
          unit_purchase_price: item.unit_price || 0,
          date_of_purchase: today,
          date_of_purchase_bs: bsDate.formatted,
          supplier_name: form.vendor_name,
        });
      }
    }

    setForm({
      vendor_name: '', vendor_contact: '', vendor_address: '',
      order_number: '', ordered_by: '',
      payment_type: 'cash',
      is_vat: false,
      items: [{ description: '', quantity: 1, unit: 'Piece', unit_price: 0, total: 0 }],
      labor_items: [{ description: '', amount: 0 }]
    });
    setShowNew(false);
    loadData();
  }

  const filtered = orders.filter(o =>
    (o.vendor_name?.toLowerCase().includes(search.toLowerCase()) ||
     o.order_number?.toLowerCase().includes(search.toLowerCase())) &&
    (!colFilters.vendor_name || o.vendor_name?.toLowerCase().includes(colFilters.vendor_name.toLowerCase())) &&
    (!colFilters.order_number || (o.order_number || '').toLowerCase().includes(colFilters.order_number.toLowerCase())) &&
    (!colFilters.status || (o.status || '').toLowerCase().includes(colFilters.status.toLowerCase()))
  );

  const totalLabor = form.labor_items.reduce((s, li) => s + (li.amount || 0), 0);
  const subtotal = form.items.reduce((sum, i) => sum + (i.total || 0), 0) + totalLabor;
  const vatAmount = form.is_vat ? subtotal * 0.13 : 0;

  const columns = [
    { key: 'date_ad', label: 'Date', render: (row) => (
      <div className="text-xs">
        <div>{row.date_ad}</div>
        <div className="text-muted-foreground">{row.date_bs}</div>
      </div>
    )},
    { key: 'order_number', label: 'Order #', filterValue: colFilters.order_number, onFilterChange: v => setCol('order_number', v) },
    { key: 'vendor_name', label: 'Vendor', filterValue: colFilters.vendor_name, onFilterChange: v => setCol('vendor_name', v), render: (row) => (
      <span className="font-medium">{row.vendor_name}</span>
    )},
    { key: 'items', label: 'Items', render: (row) => (
      <span className="text-muted-foreground">{row.items?.length || 0} items</span>
    )},
    { key: 'payment_type', label: 'Payment', render: (row) => (
      <Badge variant="outline" className="capitalize">{row.payment_type || 'cash'}</Badge>
    )},
    { key: 'is_vat', label: 'VAT', render: (row) => (
      <Badge variant={row.is_vat ? 'default' : 'secondary'}>{row.is_vat ? 'VAT' : 'Non-VAT'}</Badge>
    )},
    { key: 'total_amount', label: 'Total', render: (row) => (
      <span className="font-semibold font-mono">NPR {(row.total_amount || 0).toLocaleString()}</span>
    )},
    { key: 'status', label: 'Status', filterValue: colFilters.status, onFilterChange: v => setCol('status', v), filterPlaceholder: 'e.g. confirmed', render: (row) => (
      <Badge variant={row.status === 'confirmed' ? 'default' : 'secondary'}>{row.status}</Badge>
    )},
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Purchase"
        subtitle="Purchase orders and bills"
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setShowNew(true)}
        addLabel="New Purchase"
      />

      <DataTable columns={columns} data={filtered} emptyMessage="No purchase orders yet" />

      {/* New Purchase Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Vendor Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Vendor Name *</Label>
                <Input value={form.vendor_name} onChange={e => setForm({ ...form, vendor_name: e.target.value })} />
              </div>
              <div>
                <Label>Contact</Label>
                <Input value={form.vendor_contact} onChange={e => setForm({ ...form, vendor_contact: e.target.value })} />
              </div>
              <div>
                <Label>Address</Label>
                <Input value={form.vendor_address} onChange={e => setForm({ ...form, vendor_address: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Order Number</Label>
                <Input value={form.order_number} onChange={e => setForm({ ...form, order_number: e.target.value })} />
              </div>
              <div>
                <Label>Ordered By</Label>
                <Input value={form.ordered_by} onChange={e => setForm({ ...form, ordered_by: e.target.value })} />
              </div>
            </div>

            {/* Payment Type */}
            <div className="flex items-center gap-4">
              <Label className="text-sm font-semibold shrink-0">Payment Type</Label>
              <div className="flex gap-3">
                {['cash', 'cheque', 'credit'].map(type => (
                  <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="payment_type"
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
              <Switch checked={form.is_vat} onCheckedChange={v => setForm({ ...form, is_vat: v })} />
              <Label>VAT Bill (13%)</Label>
            </div>

            {/* Items */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-sm font-semibold">Items</Label>
                <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Add Item</Button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-end p-3 bg-secondary/50 rounded-lg">
                    <div style={{width: 220, minWidth: 80, resize: 'horizontal', overflow: 'hidden'}}>
                      {idx === 0 && <Label className="text-xs">Description</Label>}
                      <Input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Item description" />
                    </div>
                    <div style={{width: 70, minWidth: 50, resize: 'horizontal', overflow: 'hidden'}}>
                      {idx === 0 && <Label className="text-xs">Qty</Label>}
                      <Input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)} />
                    </div>
                    <div style={{width: 100, minWidth: 70, resize: 'horizontal', overflow: 'hidden'}}>
                      {idx === 0 && <Label className="text-xs">Unit</Label>}
                      {(!item.unit || UNITS.includes(item.unit)) ? (
                        <Select value={item.unit || 'Piece'} onValueChange={v => v === '__custom__' ? updateItem(idx, 'unit', '') : updateItem(idx, 'unit', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            <SelectItem value="__custom__">Custom...</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex gap-1">
                          <Input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} placeholder="Unit" autoFocus />
                          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => updateItem(idx, 'unit', 'Piece')}>↩</Button>
                        </div>
                      )}
                    </div>
                    <div style={{width: 120, minWidth: 70, resize: 'horizontal', overflow: 'hidden'}}>
                      {idx === 0 && <Label className="text-xs">Buy Price</Label>}
                      <Input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div style={{width: 120, minWidth: 70, resize: 'horizontal', overflow: 'hidden'}}>
                      {idx === 0 && <Label className="text-xs">Sell Price</Label>}
                      <Input type="number" value={item.unit_selling_price || ''} onChange={e => updateItem(idx, 'unit_selling_price', parseFloat(e.target.value) || 0)} placeholder="0" />
                    </div>
                    <div style={{width: 140, minWidth: 80, resize: 'horizontal', overflow: 'hidden'}}>
                      {idx === 0 && <Label className="text-xs">Total</Label>}
                      <Input value={`NPR ${(item.total || 0).toLocaleString()}`} disabled className="font-mono" />
                    </div>
                    <div style={{width: 36}} className="flex justify-end">
                      <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} disabled={form.items.length <= 1}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-sm font-semibold">Work / Labour Charges</Label>
                <Button size="sm" variant="outline" onClick={addLaborItem}><Plus className="w-3 h-3 mr-1" />Add Row</Button>
              </div>
              {form.labor_items.map((li, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-secondary/50 rounded-lg mb-2">
                  <div className="col-span-7">
                    {idx === 0 && <Label className="text-xs">Work Description</Label>}
                    <Input value={li.description} onChange={e => updateLaborItem(idx, 'description', e.target.value)} placeholder="e.g. Installation, Repair..." />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={createOrder} disabled={!form.vendor_name}>Save Purchase</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}