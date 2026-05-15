import { useState, useEffect } from 'react';
import { api, apiAuth } from '@/api/adapter';
import { inventoryApi, companyApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { adToBs } from '@/lib/nepaliDate';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { AlertTriangle, Package, ImagePlus, X, Trash2, Tag, ArrowUpDown, History } from 'lucide-react';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';

const UNITS = ['Piece', 'Set', 'Liter', 'ml', 'Kg', 'gm', 'NOS'];

// Which optional field groups to show per business type
const FIELDS = {
  RETAIL:       { brand: false, modelNo: false, application: false, expiry: false, aging: false, location: true },
  PHARMACY:     { brand: true,  modelNo: false, application: true,  expiry: true,  aging: false, location: true },
  ELECTRONICS:  { brand: true,  modelNo: true,  application: false, expiry: false, aging: true,  location: true },
  FOOD_BEVERAGE:{ brand: false, modelNo: false, application: false, expiry: true,  aging: false, location: false },
  SERVICES:     { brand: false, modelNo: false, application: false, expiry: false, aging: false, location: false },
  MANUFACTURING:{ brand: true,  modelNo: true,  application: true,  expiry: false, aging: true,  location: true },
  OTHER:        { brand: true,  modelNo: true,  application: true,  expiry: true,  aging: true,  location: true },
};

const BUSINESS_LABELS = {
  brand: 'Brand',
  modelNo: 'Model / Part Number',
  application: 'Usage / Purpose',
  expiry: 'Expiry Information',
  aging: 'Aging Alert (Days)',
  location: 'Stock Location',
};

const PLACEHOLDERS = {
  RETAIL:        { item_name: 'e.g. Sugar, Salt, Soap', description: 'Additional details', brand: 'e.g. Sunkoshi, Dabur', application: 'e.g. Daily use', supplier_name: 'e.g. Sunrise Traders' },
  PHARMACY:      { item_name: 'e.g. Paracetamol 500mg, Amoxicillin', description: 'Dosage form, strength', brand: 'e.g. Cipla, Sun Pharma', application: 'e.g. Pain relief, Antibiotic', supplier_name: 'e.g. Mediline Pharma' },
  ELECTRONICS:   { item_name: 'e.g. USB Cable, Power Bank', description: 'Specifications', brand: 'e.g. Samsung, Xiaomi', model_no: 'e.g. USB-C-3.0-BLK', application: 'e.g. Charging, Display', supplier_name: 'e.g. Digital World' },
  FOOD_BEVERAGE: { item_name: 'e.g. Masala Tea, Milk Tea, Coffee', description: 'e.g. Served hot, 250ml', brand: '', model_no: '', application: '', supplier_name: 'e.g. Nepal Tea Estate' },
  SERVICES:      { item_name: 'e.g. Consultation, Design Package', description: 'Scope of service', brand: '', model_no: '', application: 'e.g. IT Support, Accounting', supplier_name: 'e.g. TechVision Pvt. Ltd.' },
  MANUFACTURING: { item_name: 'e.g. Raw Steel, Cotton Yarn', description: 'Grade or specification', brand: 'e.g. SAIL, Birla', model_no: 'e.g. IS:2062 Grade A', application: 'e.g. Structural frames, Weaving', supplier_name: 'e.g. Industrial Supply Co.' },
  OTHER:         { item_name: 'e.g. Item name', description: 'Additional details or notes', brand: 'e.g. Brand name', model_no: 'e.g. Model or part number', application: 'e.g. Usage or purpose', supplier_name: 'e.g. Supplier name' },
};

function getFields(businessType) {
  return FIELDS[businessType?.toUpperCase()] ?? FIELDS.OTHER;
}

const EMPTY_FORM = {
  item_name: '', brand: '', model_no: '', description: '', application: '',
  quantity: '', unit: 'Piece', unit_purchase_price: '', unit_selling_price: '',
  stock_location: '', low_stock_threshold: '5', aging_days: '90',
  supplier_name: '', image_url: '', expiry_date: '', expiry_alert_days: '',
};

export default function Inventory() {
  const companyId = getActiveCompanyId();
  const [items, setItems] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ brand: '', model_no: '', description: '', application: '', qty_min: '', price_min: '', stock_location: '', date_from: '' });
  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const hasFilters = Object.values(filters).some(v => v);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateForm, setUpdateForm] = useState({ unit_selling_price: 0, unit_purchase_price: 0, stock_location: '', image_url: '' });
  const [uploadingUpdateImage, setUploadingUpdateImage] = useState(false);
  const [showUpdatePasswordDialog, setShowUpdatePasswordDialog] = useState(false);
  const [updatePassword, setUpdatePassword] = useState('');
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjForm, setAdjForm] = useState({ type: 'ADDITION', quantity: '', reason: '' });
  const [adjSubmitting, setAdjSubmitting] = useState(false);
  const [showAdjLogDialog, setShowAdjLogDialog] = useState(false);
  const [adjLog, setAdjLog] = useState([]);
  const [showExtraFields, setShowExtraFields] = useState(false);

  const isOtherType = company?.business_type?.toUpperCase() === 'OTHER';
  const f = isOtherType && !showExtraFields
    ? { brand: false, modelNo: false, application: false, expiry: false, aging: false, location: false }
    : getFields(company?.business_type);
  const p = PLACEHOLDERS[company?.business_type?.toUpperCase()] ?? PLACEHOLDERS.OTHER;

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setForm(prev => ({ ...prev, image_url: URL.createObjectURL(file) }));
    setUploadingImage(false);
  }

  useEffect(() => {
    if (companyId) loadItems();
  }, [companyId]);

  async function loadItems() {
    setLoading(true);
    const [data, companyRes] = await Promise.all([
      api.InventoryItem.filter({ company_id: companyId }),
      companyApi.get(companyId).catch(() => null),
    ]);
    setItems(data);
    setCompany(companyRes?.data ?? null);
    setLoading(false);
  }

  const handleDeleteClick = () => {
    if (!selectedItem) return;
    setShowPasswordDialog(true);
  };

  const handlePasswordSubmit = async () => {
    try {
      await apiAuth.me();
      setShowPasswordDialog(false);
      setPassword('');
      setShowConfirmDialog(true);
    } catch {
      alert('Invalid password or authentication failed');
      setPassword('');
    }
  };

  const handleUpdateClick = () => {
    if (!selectedItem) { alert('Please select an item from the table first by clicking on a row.'); return; }
    setUpdateForm({
      unit_selling_price: selectedItem.unit_selling_price || 0,
      unit_purchase_price: selectedItem.unit_purchase_price || 0,
      stock_location: selectedItem.stock_location || '',
      image_url: selectedItem.image_url || '',
    });
    setShowUpdatePasswordDialog(true);
  };

  const handleUpdatePasswordSubmit = async () => {
    try {
      await apiAuth.me();
      setShowUpdatePasswordDialog(false);
      setUpdatePassword('');
      setShowUpdateDialog(true);
    } catch {
      alert('Invalid password or authentication failed');
      setUpdatePassword('');
    }
  };

  async function handleUpdateImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingUpdateImage(true);
    setUpdateForm(prev => ({ ...prev, image_url: URL.createObjectURL(file) }));
    setUploadingUpdateImage(false);
  }

  async function handleUpdateSubmit() {
    if (!selectedItem) return;
    const payload = {};
    if (updateForm.unit_selling_price !== '') payload.unit_selling_price = updateForm.unit_selling_price;
    if (updateForm.unit_purchase_price !== '') payload.unit_purchase_price = updateForm.unit_purchase_price;
    if (updateForm.stock_location) payload.stock_location = updateForm.stock_location;
    if (updateForm.image_url) payload.image_url = updateForm.image_url;
    if (Object.keys(payload).length === 0) { alert('Update at least one field before saving.'); return; }
    await api.InventoryItem.update(selectedItem.id, payload);
    setShowUpdateDialog(false);
    setSelectedItem(null);
    loadItems();
  }

  const handleConfirmDelete = async () => {
    if (!selectedItem) return;
    await api.InventoryItem.delete(selectedItem.id);
    setSelectedItem(null);
    setShowConfirmDialog(false);
    loadItems();
  };

  async function handleAdjustClick() {
    if (!selectedItem) { alert('Please select an item from the table first.'); return; }
    setAdjForm({ type: 'ADDITION', quantity: '', reason: '' });
    setShowAdjustDialog(true);
  }

  async function submitAdjustment() {
    if (!adjForm.quantity || !adjForm.reason.trim()) return;
    setAdjSubmitting(true);
    try {
      await inventoryApi.adjust(selectedItem.id, {
        adjustmentType: adjForm.type,
        quantity: parseFloat(adjForm.quantity),
        reason: adjForm.reason.trim(),
      });
      setShowAdjustDialog(false);
      setSelectedItem(null);
      loadItems();
    } catch (err) {
      alert(err?.response?.data?.message || 'Adjustment failed');
    } finally {
      setAdjSubmitting(false);
    }
  }

  async function handleViewLog() {
    if (!selectedItem) { alert('Please select an item from the table first.'); return; }
    try {
      const res = await inventoryApi.getAdjustments(selectedItem.id);
      const data = res?.data?.data ?? res?.data ?? [];
      setAdjLog(Array.isArray(data) ? data : []);
      setShowAdjLogDialog(true);
    } catch {
      setAdjLog([]);
      setShowAdjLogDialog(true);
    }
  }

  async function addItem() {
    const today = new Date().toISOString().split('T')[0];
    const bsDate = adToBs(new Date());
    await api.InventoryItem.create({
      ...form,
      company_id: companyId,
      date_of_purchase: today,
      date_of_purchase_bs: bsDate.formatted,
      quantity: form.quantity === '' ? 0 : parseFloat(form.quantity),
      unit_purchase_price: form.unit_purchase_price === '' ? 0 : parseFloat(form.unit_purchase_price),
      unit_selling_price: form.unit_selling_price === '' ? 0 : parseFloat(form.unit_selling_price),
      low_stock_threshold: form.low_stock_threshold === '' ? 5 : parseInt(form.low_stock_threshold),
      aging_days: form.aging_days === '' ? 90 : parseInt(form.aging_days),
      expiry_alert_days: form.expiry_alert_days === '' ? null : parseInt(form.expiry_alert_days),
    });
    setForm(EMPTY_FORM);
    setShowAdd(false);
    loadItems();
  }

  const filtered = items.filter(i =>
    (!filters.brand || i.brand?.toLowerCase().includes(filters.brand.toLowerCase())) &&
    (!filters.model_no || i.model_no?.toLowerCase().includes(filters.model_no.toLowerCase())) &&
    (!filters.description || i.description?.toLowerCase().includes(filters.description.toLowerCase())) &&
    (!filters.application || i.application?.toLowerCase().includes(filters.application.toLowerCase())) &&
    (!filters.qty_min || (i.quantity || 0) >= parseFloat(filters.qty_min)) &&
    (!filters.price_min || (i.unit_selling_price || 0) >= parseFloat(filters.price_min)) &&
    (!filters.stock_location || i.stock_location?.toLowerCase().includes(filters.stock_location.toLowerCase())) &&
    (!filters.date_from || (() => {
      if (!i.date_of_purchase) return false;
      const agingDays = Math.floor((new Date() - new Date(i.date_of_purchase)) / (1000 * 60 * 60 * 24));
      return agingDays >= parseFloat(filters.date_from);
    })())
  );

  const columns = [
    { key: 'item_name', label: 'Name', render: (row) => <span className="font-medium max-w-[200px] truncate block">{row.item_name || '—'}</span> },
    ...(f.brand ? [{ key: 'brand', label: 'Brand' }] : []),
    ...(f.modelNo ? [{ key: 'model_no', label: 'Model No.' }] : []),
    { key: 'description', label: 'Details', render: (row) => <span className="max-w-[200px] truncate block text-sm">{row.description || '—'}</span> },
    ...(f.application ? [{ key: 'application', label: 'Usage' }] : []),
    { key: 'quantity', label: 'Qty', render: (row) => {
      const isLow = (row.quantity || 0) <= (row.low_stock_threshold || 5);
      return (
        <div className="flex items-center gap-1.5">
          <span className={isLow ? 'text-red-600 font-semibold' : 'font-medium'}>{row.quantity || 0}</span>
          <span className="text-xs text-muted-foreground">{row.unit}</span>
          {isLow && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
        </div>
      );
    }},
    { key: 'unit_selling_price', label: 'Selling Price', render: (row) => <span className="font-mono">NPR {(row.unit_selling_price || 0).toLocaleString()}</span> },
    ...(f.location ? [{ key: 'stock_location', label: 'Location' }] : []),
    ...(f.aging ? [{ key: 'aging_days', label: 'Aging', render: (row) => {
      if (!row.date_of_purchase) return <span className="text-muted-foreground">-</span>;
      const days = Math.floor((new Date() - new Date(row.date_of_purchase)) / (1000 * 60 * 60 * 24));
      const isAged = days >= (row.aging_days || 90);
      return <span className={isAged ? 'text-red-600 font-semibold' : ''}>{days}d</span>;
    }}] : []),
  ];

  const lowStockCount = items.filter(i => (i.quantity || 0) <= (i.low_stock_threshold || 5)).length;

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Inventory"
        subtitle={`${items.length} items · ${lowStockCount} low stock alerts`}
        onAdd={() => { setShowExtraFields(false); setShowAdd(true); }}
        addLabel="Add Stock"
      >
        <Button onClick={handleAdjustClick} variant="outline" className="gap-2" disabled={!selectedItem}>
          <ArrowUpDown className="w-4 h-4" />Adjust Stock
        </Button>
        <Button onClick={handleViewLog} variant="ghost" className="gap-2" disabled={!selectedItem}>
          <History className="w-4 h-4" />Log
        </Button>
        <Button onClick={handleUpdateClick} variant="outline" className="gap-2">
          <Tag className="w-4 h-4" />Update
        </Button>
        <Button onClick={handleDeleteClick} variant="destructive" className="gap-2" disabled={!selectedItem}>
          <Trash2 className="w-4 h-4" />Delete
        </Button>
      </PageHeader>

      {lowStockCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">{lowStockCount} item(s) are running low on stock</p>
            <p className="text-xs text-red-600">Review your inventory and reorder as needed</p>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState icon={Package} title="No inventory items yet" description="Add your first stock item to start tracking your inventory." action={<Button onClick={() => { setShowExtraFields(false); setShowAdd(true); }}>Add Stock</Button>} />
      ) : (
      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={setSelectedItem}
        selectedId={selectedItem?.id}
        filterRow={<>
          {f.brand && <td className="px-2 py-1"><Input placeholder="Brand" value={filters.brand} onChange={e => setFilter('brand', e.target.value)} className="h-7 text-xs w-full" /></td>}
          {f.modelNo && <td className="px-2 py-1"><Input placeholder="Model No." value={filters.model_no} onChange={e => setFilter('model_no', e.target.value)} className="h-7 text-xs w-full" /></td>}
          <td className="px-2 py-1"><Input placeholder="Description" value={filters.description} onChange={e => setFilter('description', e.target.value)} className="h-7 text-xs w-full" /></td>
          {f.application && <td className="px-2 py-1"><Input placeholder="Usage" value={filters.application} onChange={e => setFilter('application', e.target.value)} className="h-7 text-xs w-full" /></td>}
          <td className="px-2 py-1"><Input type="number" placeholder="Min Qty" value={filters.qty_min} onChange={e => setFilter('qty_min', e.target.value)} className="h-7 text-xs w-full" /></td>
          <td className="px-2 py-1"><Input type="number" placeholder="Min Price" value={filters.price_min} onChange={e => setFilter('price_min', e.target.value)} className="h-7 text-xs w-full" /></td>
          {f.location && <td className="px-2 py-1"><Input placeholder="Location" value={filters.stock_location} onChange={e => setFilter('stock_location', e.target.value)} className="h-7 text-xs w-full" /></td>}
          {f.aging && <td className="px-2 py-1"><div className="flex items-center gap-1">
            <Input type="number" placeholder="Min aging days" value={filters.date_from} onChange={e => setFilter('date_from', e.target.value)} className="h-7 text-xs w-full" />
            {hasFilters && <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => setFilters({ brand: '', model_no: '', description: '', application: '', qty_min: '', price_min: '', stock_location: '', date_from: '' })}>✕</Button>}
          </div></td>}
        </>}
        emptyMessage="No inventory items yet. Click 'Add Stock' to add items."
      />
      )}

      {/* Update Password Dialog */}
      <Dialog open={showUpdatePasswordDialog} onOpenChange={setShowUpdatePasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Verify Your Account</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter your account password to proceed with updating.</p>
            <div>
              <Label>Password</Label>
              <Input type="password" value={updatePassword} onChange={e => setUpdatePassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUpdatePasswordSubmit()} placeholder="Enter your password" autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUpdatePasswordDialog(false); setUpdatePassword(''); }}>Cancel</Button>
            <Button onClick={handleUpdatePasswordSubmit}>Verify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Price/Location/Image Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              Update Item — {selectedItem?.item_name || selectedItem?.description}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[calc(85vh-120px)] py-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Product Image</Label>
              {updateForm.image_url ? (
                <div className="relative w-24 h-24">
                  <img src={updateForm.image_url} alt="preview" className="w-24 h-24 rounded-lg object-cover border shadow-sm" />
                  <button type="button" onClick={() => setUpdateForm(f => ({ ...f, image_url: '' }))}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center shadow-md">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  <ImagePlus className="w-5 h-5 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground text-center">Upload image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpdateImageUpload} disabled={uploadingUpdateImage} />
                </label>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Purchase Price (NPR)</Label>
                <Input type="number" value={updateForm.unit_purchase_price}
                  onChange={e => setUpdateForm(f => ({ ...f, unit_purchase_price: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium">Selling Price (NPR)</Label>
                <Input type="number" value={updateForm.unit_selling_price}
                  onChange={e => setUpdateForm(f => ({ ...f, unit_selling_price: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00" className="mt-1" />
              </div>
            </div>
            {f.location && (
              <div>
                <Label className="text-sm font-medium">Stock Location</Label>
                <Input value={updateForm.stock_location}
                  onChange={e => setUpdateForm(f => ({ ...f, stock_location: e.target.value }))}
                  placeholder="e.g. Shelf A-3" className="mt-1" />
              </div>
            )}
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateSubmit} className="gap-2"><Tag className="w-4 h-4" />Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Verify Your Account</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter your account password to proceed with deletion.</p>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()} placeholder="Enter your password" autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPasswordDialog(false); setPassword(''); }}>Cancel</Button>
            <Button onClick={handlePasswordSubmit}>Verify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirm Deletion</DialogTitle></DialogHeader>
          <p className="text-sm">Are you sure you want to delete <span className="font-semibold">{selectedItem?.item_name || selectedItem?.description}</span>?</p>
          <p className="text-xs text-red-600 mt-1">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>No, Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>Yes, Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" />
              Adjust Stock — {selectedItem?.item_name || selectedItem?.description}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-secondary rounded-lg px-4 py-2 text-sm flex justify-between">
              <span className="text-muted-foreground">Current Quantity</span>
              <span className="font-semibold">{selectedItem?.quantity ?? 0} {selectedItem?.unit}</span>
            </div>
            <div>
              <Label>Adjustment Type</Label>
              <Select value={adjForm.type} onValueChange={v => setAdjForm({ ...adjForm, type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADDITION">Addition — add to current stock</SelectItem>
                  <SelectItem value="SUBTRACTION">Subtraction — remove from current stock</SelectItem>
                  <SelectItem value="RECOUNT">Recount — set exact quantity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                {adjForm.type === 'RECOUNT' ? 'New Quantity' : 'Quantity to ' + (adjForm.type === 'ADDITION' ? 'Add' : 'Remove')} *
              </Label>
              <Input
                type="number"
                className="mt-1"
                placeholder="0"
                value={adjForm.quantity}
                onChange={e => setAdjForm({ ...adjForm, quantity: e.target.value })}
              />
              {adjForm.quantity && adjForm.type !== 'RECOUNT' && (
                <p className="text-xs text-muted-foreground mt-1">
                  New quantity will be:{' '}
                  <strong>
                    {adjForm.type === 'ADDITION'
                      ? (selectedItem?.quantity || 0) + parseFloat(adjForm.quantity || 0)
                      : Math.max(0, (selectedItem?.quantity || 0) - parseFloat(adjForm.quantity || 0))}
                  </strong>{' '}{selectedItem?.unit}
                </p>
              )}
            </div>
            <div>
              <Label>Reason *</Label>
              <Textarea
                className="mt-1"
                rows={2}
                placeholder="e.g. Physical stock count, damaged goods, returned items..."
                value={adjForm.reason}
                onChange={e => setAdjForm({ ...adjForm, reason: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>Cancel</Button>
            <Button
              onClick={submitAdjustment}
              disabled={adjSubmitting || !adjForm.quantity || !adjForm.reason.trim()}
            >
              {adjSubmitting ? 'Saving...' : 'Save Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment Log Dialog */}
      <Dialog open={showAdjLogDialog} onOpenChange={setShowAdjLogDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Adjustment Log — {selectedItem?.item_name || selectedItem?.description}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {adjLog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No adjustments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {adjLog.map((entry, idx) => (
                  <div key={entry.id ?? idx} className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg text-sm">
                    <span className={`shrink-0 font-bold text-xs px-2 py-0.5 rounded-full ${
                      entry.adjustmentType === 'ADDITION' ? 'bg-green-100 text-green-700' :
                      entry.adjustmentType === 'SUBTRACTION' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {entry.adjustmentType === 'ADDITION' ? '+' : entry.adjustmentType === 'SUBTRACTION' ? '−' : '⟳'}
                      {entry.quantity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{entry.reason}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Before: {entry.quantityBefore} → After: {entry.quantityAfter}
                        {entry.createdAt && ` · ${new Date(entry.createdAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjLogDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAdd} onOpenChange={(v) => { setShowAdd(v); if (!v) setShowExtraFields(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Add New Inventory Item
            </DialogTitle>
            {company?.business_type && (
              <p className="text-xs text-muted-foreground">
                Fields shown for <span className="font-medium">
                  {({ RETAIL: 'Retail', PHARMACY: 'Pharmacy', ELECTRONICS: 'Electronics', FOOD_BEVERAGE: 'Tea Shop / Bakery', SERVICES: 'Services', MANUFACTURING: 'Manufacturing', OTHER: 'Other' })[company.business_type] || company.business_type}
                </span> businesses.
                Change in <a href="/settings" className="text-primary underline">Settings</a> to adjust.
              </p>
            )}
          </DialogHeader>

          <div className="flex gap-6 max-h-[calc(90vh-120px)] overflow-hidden">
            {/* Image column */}
            <div className="w-32 shrink-0">
              <Label className="text-sm font-medium mb-2 block">Image</Label>
              {form.image_url ? (
                <div className="relative">
                  <img src={form.image_url} alt="preview" className="w-32 h-32 rounded-lg object-cover border shadow-sm" />
                  <button type="button" onClick={() => setForm(f => ({ ...f, image_url: '' }))}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center shadow-md">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  <ImagePlus className="w-6 h-6 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground text-center">Click to upload</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                </label>
              )}
            </div>

            {/* Form fields */}
            <div className="flex-1 overflow-y-auto pr-2 max-h-[calc(90vh-160px)] space-y-4">

              {/* Basic — always shown */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium border-b pb-1">Basic Information</h4>
                <div>
                  <Label className="text-sm">Item Name *</Label>
                  <Input value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })}
                    placeholder={p.item_name} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder={p.description} className="mt-1" />
                </div>

                {/* Brand — business-type conditional */}
                {f.brand && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Brand <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}
                        placeholder={p.brand || 'e.g. Brand name'} className="mt-1" />
                    </div>
                    {f.modelNo && (
                      <div>
                        <Label className="text-sm">Model / Part No. <span className="text-muted-foreground text-xs">(optional)</span></Label>
                        <Input value={form.model_no} onChange={e => setForm({ ...form, model_no: e.target.value })}
                          placeholder={p.model_no || 'e.g. USB-C-3.0'} className="mt-1" />
                      </div>
                    )}
                  </div>
                )}

                {/* Application / Usage — pharmacy & manufacturing */}
                {f.application && (
                  <div>
                    <Label className="text-sm">Usage / Purpose <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input value={form.application} onChange={e => setForm({ ...form, application: e.target.value })}
                      placeholder={p.application || 'e.g. Usage or purpose'} className="mt-1" />
                  </div>
                )}

                {/* Expand toggle for OTHER business type */}
                {isOtherType && !showExtraFields && (
                  <button
                    type="button"
                    onClick={() => setShowExtraFields(true)}
                    className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                  >
                    + Show additional fields (brand, model, usage, expiry…)
                  </button>
                )}
              </div>

              {/* Quantity & Pricing — always shown */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium border-b pb-1">Quantity & Pricing</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-sm">Quantity</Label>
                    <Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="0" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-sm">Unit</Label>
                    {!form.unit || UNITS.includes(form.unit) ? (
                      <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v === '__custom__' ? '__custom__' : v })}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select unit" /></SelectTrigger>
                        <SelectContent>
                          {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          <SelectItem value="__custom__">Custom...</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex gap-2 mt-1">
                        <Input value={form.unit === '__custom__' ? '' : form.unit}
                          onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="Custom unit" autoFocus />
                        <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, unit: 'Piece' })}>↩</Button>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm">Low Stock Alert</Label>
                    <Input type="number" value={form.low_stock_threshold}
                      onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })} placeholder="5" className="mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Purchase Price (NPR)</Label>
                    <Input type="number" value={form.unit_purchase_price}
                      onChange={e => setForm({ ...form, unit_purchase_price: e.target.value })} placeholder="0.00" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-sm">Selling Price (NPR)</Label>
                    <Input type="number" value={form.unit_selling_price}
                      onChange={e => setForm({ ...form, unit_selling_price: e.target.value })} placeholder="0.00" className="mt-1" />
                  </div>
                </div>
              </div>

              {/* Storage & Supplier — conditional on business type */}
              {(f.location || true) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium border-b pb-1">Storage & Supplier</h4>
                  <div className={`grid gap-3 ${f.location ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {f.location && (
                      <div>
                        <Label className="text-sm">Stock Location <span className="text-muted-foreground text-xs">(optional)</span></Label>
                        <Input value={form.stock_location} onChange={e => setForm({ ...form, stock_location: e.target.value })}
                          placeholder="e.g. Shelf A-3" className="mt-1" />
                      </div>
                    )}
                    <div>
                      <Label className="text-sm">Supplier Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Input value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })}
                        placeholder={p.supplier_name || 'e.g. ABC Traders'} className="mt-1" />
                    </div>
                  </div>
                  {f.aging && (
                    <div>
                      <Label className="text-sm">Aging Alert (Days) <span className="text-muted-foreground text-xs">(flag slow-moving stock)</span></Label>
                      <Input type="number" value={form.aging_days} onChange={e => setForm({ ...form, aging_days: e.target.value })} placeholder="90" className="mt-1" />
                    </div>
                  )}
                </div>
              )}

              {/* Expiry — only for pharmacy & food */}
              {f.expiry && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium border-b pb-1">Expiry Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Expiry Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Input type="date" value={form.expiry_date || ''} onChange={e => setForm({ ...form, expiry_date: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">Alert Before Expiry (Days)</Label>
                      <Input type="number" placeholder="30" value={form.expiry_alert_days || ''}
                        onChange={e => setForm({ ...form, expiry_alert_days: e.target.value })} className="mt-1" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addItem} disabled={!form.item_name} className="gap-2">
              <Package className="w-4 h-4" />Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
