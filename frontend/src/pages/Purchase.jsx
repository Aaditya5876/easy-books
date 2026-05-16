import { useState, useEffect } from 'react';
import { api } from '@/api/adapter';
import { memoApi } from '@/api';
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
import { Plus, Trash2, ShoppingCart, User, FileText } from 'lucide-react';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { SmartNumberInput } from "@/components/ui/smart-number-input";
import { FileAttachmentZone } from "@/components/ui/file-attachment-zone";

const UNITS = ['Piece', 'Set', 'Liter', 'ml', 'Kg', 'gm', 'NOS'];

const EMPTY_FORM = {
  vendor_name: '', vendor_contact: '', vendor_address: '', vendor_pan: '',
  order_number: '', ordered_by: '',
  date_ad: new Date().toISOString().split('T')[0],
  due_date: '',
  payment_type: 'cash',
  is_vat: false,
  notes: '',
  items: [{ description: '', quantity: 1, unit: 'Piece', unit_price: 0, total: 0 }],
  labor_items: [{ description: '', amount: 0 }],
  attachments: [],
};

export default function Purchase() {
  const companyId = getActiveCompanyId();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({ vendor_name: '', order_number: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showNew, setShowNew] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });

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
    const entryDate = form.date_ad || new Date().toISOString().split('T')[0];
    const bsDate = adToBs(new Date(entryDate));
    const laborTotal = form.labor_items.reduce((s, li) => s + (li.amount || 0), 0);
    const subtotal = form.items.reduce((sum, i) => sum + (i.total || 0), 0) + laborTotal;
    const vatAmount = form.is_vat ? subtotal * 0.13 : 0;

    await api.PurchaseOrder.create({
      company_id: companyId,
      vendor_name: form.vendor_name,
      vendor_contact: form.vendor_contact,
      vendor_address: form.vendor_address,
      vendor_pan: form.vendor_pan,
      date_ad: entryDate,
      date_bs: bsDate.formatted,
      due_date: form.due_date || null,
      order_number: form.order_number,
      ordered_by: form.ordered_by,
      items: form.items,
      work_description: form.labor_items.map(li => li.description).filter(Boolean).join(', '),
      payment_type: form.payment_type,
      is_vat: form.is_vat,
      notes: form.notes,
      subtotal,
      vat_amount: vatAmount,
      total_amount: subtotal + vatAmount,
      status: 'confirmed',
    });

    // Auto-create vendor if not exists
    const existingVendors = await api.Vendor.filter({ company_id: companyId, name: form.vendor_name });
    if (existingVendors.length === 0 && form.vendor_name) {
      await api.Vendor.create({
        company_id: companyId,
        name: form.vendor_name,
        phone: form.vendor_contact,
        address: form.vendor_address,
      });
    }

    // Update inventory for purchased items
    for (const item of form.items) {
      if (item.description) {
        await api.InventoryItem.create({
          company_id: companyId,
          description: item.description,
          quantity: item.quantity || 0,
          unit: item.unit || 'Piece',
          unit_purchase_price: item.unit_price || 0,
          date_of_purchase: entryDate,
          date_of_purchase_bs: bsDate.formatted,
          supplier_name: form.vendor_name,
        });
      }
    }

    if (form.attachments?.length > 0) {
      await memoApi.create({
        companyId,
        title: `Purchase Bill - ${form.vendor_name || 'Unknown Vendor'} - ${form.order_number || new Date().toLocaleDateString()}`,
        type: 'purchase_bill',
        content: `Auto-saved from Purchase entry. Order: ${form.order_number}`,
        files: form.attachments,
      }).catch(() => {}); // silent fail if memo fails
    }

    setForm({ ...EMPTY_FORM, date_ad: new Date().toISOString().split('T')[0] });
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
  const itemsSubtotal = form.items.reduce((sum, i) => sum + (i.total || 0), 0);
  const subtotal = itemsSubtotal + totalLabor;
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

  if (loading) return <PageLoader />;

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

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No purchase orders yet"
          description="Add your first purchase order to track your expenses."
          action={<Button onClick={() => setShowNew(true)}>New Purchase</Button>}
        />
      ) : (
        <DataTable columns={columns} data={filtered} emptyMessage="No purchase orders match your search." />
      )}

      {/* New Purchase Dialog */}
      <Dialog open={showNew} onOpenChange={open => { setShowNew(open); if (!open) setForm({ ...EMPTY_FORM, date_ad: new Date().toISOString().split('T')[0] }); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden glass-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              New Purchase Entry
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 overflow-hidden">
            {/* ── Left column: bill header ── */}
            <div className="space-y-3 overflow-y-auto max-h-[calc(85vh-180px)] pr-1">

              {/* Vendor Details section */}
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 flex items-center gap-1">
                <User className="w-3 h-3" /> Vendor Details
              </h4>

              {/* Saved vendor picker */}
              {vendors.length > 0 && (
                <div>
                  <Label className="text-xs">Select Saved Vendor</Label>
                  <Select onValueChange={v => {
                    const vend = vendors.find(x => x.id === v);
                    if (vend) setForm(f => ({
                      ...f,
                      vendor_name: vend.name || '',
                      vendor_contact: vend.contact_person || vend.phone || '',
                      vendor_address: vend.address || '',
                      vendor_pan: vend.pan_vat || ''
                    }));
                  }}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select saved vendor (or type below)" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label className="text-xs">Vendor Name *</Label>
                <Input
                  className="h-8 text-sm"
                  value={form.vendor_name}
                  onChange={e => setForm({ ...form, vendor_name: e.target.value })}
                  placeholder="Vendor / Supplier name"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Contact <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    className="h-8 text-sm"
                    value={form.vendor_contact}
                    onChange={e => setForm({ ...form, vendor_contact: e.target.value })}
                    placeholder="Phone / email"
                  />
                </div>
                <div>
                  <Label className="text-xs">PAN / VAT <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    className="h-8 text-sm"
                    value={form.vendor_pan}
                    onChange={e => setForm({ ...form, vendor_pan: e.target.value })}
                    placeholder="e.g. 123456789"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Address <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  className="h-8 text-sm"
                  value={form.vendor_address}
                  onChange={e => setForm({ ...form, vendor_address: e.target.value })}
                  placeholder="Vendor address"
                />
              </div>

              {/* Bill Details section */}
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 mt-2 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Bill Details
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Bill Date *</Label>
                  <Input
                    type="date"
                    className="h-8 text-sm"
                    value={form.date_ad}
                    onChange={e => setForm({ ...form, date_ad: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Due Date <span className="text-muted-foreground">(credit)</span></Label>
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
                  <Label className="text-xs">Order / Bill No. <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    className="h-8 text-sm"
                    value={form.order_number}
                    onChange={e => setForm({ ...form, order_number: e.target.value })}
                    placeholder="Vendor's bill #"
                  />
                </div>
                <div>
                  <Label className="text-xs">Ordered By <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    className="h-8 text-sm"
                    value={form.ordered_by}
                    onChange={e => setForm({ ...form, ordered_by: e.target.value })}
                    placeholder="Your staff name"
                  />
                </div>
              </div>

              {/* Payment Type */}
              <div>
                <Label className="text-xs font-semibold">Payment Type</Label>
                <div className="flex gap-4 mt-1">
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
              <div className="flex items-center gap-3 p-2.5 bg-secondary rounded-lg">
                <Switch checked={form.is_vat} onCheckedChange={v => setForm({ ...form, is_vat: v })} />
                <Label className="text-sm">VAT Bill (13%)</Label>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs">Notes <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  className="h-8 text-sm"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Remarks, special instructions..."
                />
              </div>

              {/* Attachments */}
              <div>
                <Label className="text-xs font-medium">Attachments</Label>
                <FileAttachmentZone
                  files={form.attachments || []}
                  onChange={(files) => setForm({ ...form, attachments: files })}
                  label="Attach bills, receipts or photos"
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
                    Items
                  </h4>
                  <Button size="sm" variant="outline" className="h-7 text-xs ml-2" onClick={addItem}>
                    <Plus className="w-3 h-3 mr-1" />Add Item
                  </Button>
                </div>

                {/* Header row */}
                <div className="grid grid-cols-12 gap-1 text-xs font-medium text-muted-foreground px-1 mb-1">
                  <div className="col-span-5">Description</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-2">Buy Price</div>
                  <div className="col-span-1"></div>
                </div>

                <div className="space-y-1">
                  {form.items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1 items-center">
                      <div className="col-span-5">
                        <Input
                          placeholder="Item description"
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
                            value={item.unit || 'Piece'}
                            onValueChange={v => v === '__custom__' ? updateItem(i, 'unit', '') : updateItem(i, 'unit', v)}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                              <SelectItem value="__custom__">Custom...</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex gap-1">
                            <Input
                              value={item.unit}
                              onChange={e => updateItem(i, 'unit', e.target.value)}
                              placeholder="Unit"
                              className="h-8 text-xs"
                              autoFocus
                            />
                            <Button type="button" variant="outline" size="sm" className="h-8 px-1 shrink-0 text-xs" onClick={() => updateItem(i, 'unit', 'Piece')}>↩</Button>
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
                    Work / Labour Charges
                  </h4>
                  <Button size="sm" variant="outline" className="h-7 text-xs ml-2" onClick={addLaborItem}>
                    <Plus className="w-3 h-3 mr-1" />Add Row
                  </Button>
                </div>

                <div className="space-y-1">
                  {form.labor_items.map((li, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                      <div className="col-span-8">
                        <Input
                          value={li.description}
                          onChange={e => updateLaborItem(idx, 'description', e.target.value)}
                          placeholder="e.g. Installation, Repair..."
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-3">
                        <SmartNumberInput
                          value={li.amount}
                          onChange={e => updateLaborItem(idx, 'amount', parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                          placeholder="Amount"
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
                  <span className="text-muted-foreground">Items Subtotal</span>
                  <span className="font-mono">NPR {itemsSubtotal.toLocaleString()}</span>
                </div>
                {totalLabor > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Labour Total</span>
                    <span className="font-mono">NPR {totalLabor.toLocaleString()}</span>
                  </div>
                )}
                {form.is_vat && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">VAT (13%)</span>
                    <span className="font-mono">NPR {vatAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total</span>
                  <span className="font-mono">NPR {(subtotal + vatAmount).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={createOrder} disabled={!form.vendor_name}>Save Purchase</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
