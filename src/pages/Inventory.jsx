import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getActiveCompanyId } from '@/lib/companyContext';
import { adToBs } from '@/lib/nepaliDate';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { AlertTriangle, Package, ImagePlus, X, Trash2, Tag } from 'lucide-react';

const UNITS = ['Piece', 'Set', 'Liter', 'ml', 'Kg', 'gm', 'NOS'];

export default function Inventory() {
  const companyId = getActiveCompanyId();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ brand: '', model_no: '', description: '', application: '', qty_min: '', price_min: '', stock_location: '', date_from: '' });
  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const hasFilters = Object.values(filters).some(v => v);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    brand: '', model_no: '', description: '', application: '',
    quantity: 0, unit: 'Piece', unit_purchase_price: 0, unit_selling_price: 0,
    stock_location: '', low_stock_threshold: 5, aging_days: 90, supplier_name: '', image_url: ''
  });
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

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, image_url: file_url }));
    setUploadingImage(false);
  }

  useEffect(() => {
    if (companyId) loadItems();
  }, [companyId]);

  async function loadItems() {
    setLoading(true);
    const data = await base44.entities.InventoryItem.filter({ company_id: companyId });
    setItems(data);
    setLoading(false);
  }

  const handleDeleteClick = () => {
    if (!selectedItem) return;
    setShowPasswordDialog(true);
  };

  const handlePasswordSubmit = async () => {
    try {
      const user = await base44.auth.me();
      if (!user) {
        alert('Authentication failed');
        return;
      }
      setShowPasswordDialog(false);
      setPassword('');
      setShowConfirmDialog(true);
    } catch {
      alert('Invalid password or authentication failed');
      setPassword('');
    }
  };

  const handleUpdateClick = () => {
    if (!selectedItem) return;
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
      const user = await base44.auth.me();
      if (!user) { alert('Authentication failed'); return; }
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
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUpdateForm(f => ({ ...f, image_url: file_url }));
    setUploadingUpdateImage(false);
  }

  async function handleUpdateSubmit() {
    if (!selectedItem) return;
    await base44.entities.InventoryItem.update(selectedItem.id, {
      unit_selling_price: updateForm.unit_selling_price,
      unit_purchase_price: updateForm.unit_purchase_price,
      stock_location: updateForm.stock_location,
      image_url: updateForm.image_url,
    });
    setShowUpdateDialog(false);
    setSelectedItem(null);
    loadItems();
  }

  const handleConfirmDelete = async () => {
    if (!selectedItem) return;
    await base44.entities.InventoryItem.delete(selectedItem.id);
    setSelectedItem(null);
    setShowConfirmDialog(false);
    loadItems();
  };

  async function addItem() {
    const today = new Date().toISOString().split('T')[0];
    const bsDate = adToBs(new Date());
    await base44.entities.InventoryItem.create({
      ...form,
      company_id: companyId,
      date_of_purchase: today,
      date_of_purchase_bs: bsDate.formatted,
    });
    setForm({
      brand: '', model_no: '', description: '', application: '',
      quantity: 0, unit: 'Piece', unit_purchase_price: 0, unit_selling_price: 0,
      stock_location: '', low_stock_threshold: 5, aging_days: 90, supplier_name: '', image_url: ''
      });
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

    { key: 'brand', label: 'Brand' },
    { key: 'model_no', label: 'Model No.' },
    { key: 'description', label: 'Description', render: (row) => (
      <span className="font-medium max-w-[200px] truncate block">{row.description}</span>
    )},
    { key: 'application', label: 'Application' },
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
    { key: 'unit_selling_price', label: 'Selling Price', render: (row) => (
      <span className="font-mono">NPR {(row.unit_selling_price || 0).toLocaleString()}</span>
    )},
    { key: 'stock_location', label: 'Location' },
    { key: 'aging_days', label: 'Aging (Days)', render: (row) => {
      if (!row.date_of_purchase) return <span className="text-muted-foreground">-</span>;
      const days = Math.floor((new Date() - new Date(row.date_of_purchase)) / (1000 * 60 * 60 * 24));
      const isAged = days >= (row.aging_days || 90);
      return <span className={isAged ? 'text-red-600 font-semibold' : ''}>{days}d</span>;
    }},
  ];

  const lowStockCount = items.filter(i => (i.quantity || 0) <= (i.low_stock_threshold || 5)).length;

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
        title="Inventory"
        subtitle={`${items.length} items · ${lowStockCount} low stock alerts`}
        onAdd={() => setShowAdd(true)}
        addLabel="Add Stock"
      >
        <Button onClick={handleUpdateClick} variant="outline" className="gap-2" disabled={!selectedItem}>
          <Tag className="w-4 h-4" />
          Update
        </Button>
        <Button onClick={handleDeleteClick} variant="destructive" className="gap-2" disabled={!selectedItem}>
          <Trash2 className="w-4 h-4" />
          Delete
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

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={setSelectedItem}
        selectedId={selectedItem?.id}
        filterRow={<>
          <td className="px-2 py-1"><Input placeholder="Brand" value={filters.brand} onChange={e => setFilter('brand', e.target.value)} className="h-7 text-xs w-full" /></td>
          <td className="px-2 py-1"><Input placeholder="Model No." value={filters.model_no} onChange={e => setFilter('model_no', e.target.value)} className="h-7 text-xs w-full" /></td>
          <td className="px-2 py-1"><Input placeholder="Description" value={filters.description} onChange={e => setFilter('description', e.target.value)} className="h-7 text-xs w-full" /></td>
          <td className="px-2 py-1"><Input placeholder="Application" value={filters.application} onChange={e => setFilter('application', e.target.value)} className="h-7 text-xs w-full" /></td>
          <td className="px-2 py-1"><Input type="number" placeholder="Min Qty" value={filters.qty_min} onChange={e => setFilter('qty_min', e.target.value)} className="h-7 text-xs w-full" /></td>
          <td className="px-2 py-1"><Input type="number" placeholder="Min Price" value={filters.price_min} onChange={e => setFilter('price_min', e.target.value)} className="h-7 text-xs w-full" /></td>
          <td className="px-2 py-1"><Input placeholder="Location" value={filters.stock_location} onChange={e => setFilter('stock_location', e.target.value)} className="h-7 text-xs w-full" /></td>
          <td className="px-2 py-1"><div className="flex items-center gap-1">
           <Input type="number" placeholder="Min aging days" value={filters.date_from} onChange={e => setFilter('date_from', e.target.value)} className="h-7 text-xs w-full" />
            {hasFilters && <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => setFilters({ brand: '', model_no: '', description: '', application: '', qty_min: '', price_min: '', stock_location: '', date_from: '' })}>✕</Button>}
          </div></td>
        </>}
        emptyMessage="No inventory items yet. Click 'Add Stock' to add items."
      />

      {/* Update Password Verification Dialog */}
      <Dialog open={showUpdatePasswordDialog} onOpenChange={setShowUpdatePasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Your Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter your account password to proceed with updating.</p>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={updatePassword}
                onChange={e => setUpdatePassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUpdatePasswordSubmit()}
                placeholder="Enter your password"
                autoFocus
              />
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Item — {selectedItem?.description}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item Image</Label>
              {updateForm.image_url ? (
                <div className="relative w-24 h-24 mt-1">
                  <img src={updateForm.image_url} alt="preview" className="w-24 h-24 rounded-lg object-cover border" />
                  <button type="button" onClick={() => setUpdateForm(f => ({ ...f, image_url: '' }))} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="mt-1 flex items-center gap-2 cursor-pointer border border-dashed rounded-lg p-3 hover:bg-muted transition-colors">
                  <ImagePlus className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{uploadingUpdateImage ? 'Uploading...' : 'Click to upload image'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpdateImageUpload} disabled={uploadingUpdateImage} />
                </label>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Purchase Price (NPR)</Label>
                <Input type="number" value={updateForm.unit_purchase_price} onChange={e => setUpdateForm(f => ({ ...f, unit_purchase_price: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Selling Price (NPR)</Label>
                <Input type="number" value={updateForm.unit_selling_price} onChange={e => setUpdateForm(f => ({ ...f, unit_selling_price: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <Label>Stock Location</Label>
              <Input value={updateForm.stock_location} onChange={e => setUpdateForm(f => ({ ...f, stock_location: e.target.value }))} placeholder="e.g. Shelf A" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateSubmit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Verification Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Your Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter your account password to proceed with deletion.</p>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
                placeholder="Enter your password"
                autoFocus
              />
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
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Are you sure you want to delete <span className="font-semibold">{selectedItem?.description}</span>?</p>
            <p className="text-xs text-red-600">This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>No, Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>Yes, Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item Image</Label>
              {form.image_url ? (
                <div className="relative w-24 h-24 mt-1">
                  <img src={form.image_url} alt="preview" className="w-24 h-24 rounded-lg object-cover border" />
                  <button type="button" onClick={() => setForm(f => ({ ...f, image_url: '' }))} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="mt-1 flex items-center gap-2 cursor-pointer border border-dashed rounded-lg p-3 hover:bg-muted transition-colors">
                  <ImagePlus className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{uploadingImage ? 'Uploading...' : 'Click to upload image'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                </label>
              )}
            </div>
            <div>
              <Label>Description *</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Brand</Label>
                <Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div>
                <Label>Model No.</Label>
                <Input value={form.model_no} onChange={e => setForm({ ...form, model_no: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Application</Label>
              <Input value={form.application} onChange={e => setForm({ ...form, application: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Quantity</Label>
                <Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value === '' ? '' : parseFloat(e.target.value) })} />
              </div>
              <div>
                <Label>Unit</Label>
                {!form.unit || UNITS.includes(form.unit) ? (
                  <Select value={form.unit} onValueChange={v => {
                    if (v === '__custom__') setForm({ ...form, unit: '__custom__' });
                    else setForm({ ...form, unit: v });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      <SelectItem value="__custom__">Custom...</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-1">
                    <Input value={form.unit === '__custom__' ? '' : form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="Enter custom unit" autoFocus />
                    <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setForm({ ...form, unit: 'Piece' })}>↩</Button>
                  </div>
                )}
              </div>
              <div>
                <Label>Low Stock Alert</Label>
                <Input type="number" value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: parseInt(e.target.value) || 5 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Purchase Price (NPR)</Label>
                <Input type="number" value={form.unit_purchase_price} onChange={e => setForm({ ...form, unit_purchase_price: e.target.value === '' ? '' : parseFloat(e.target.value) })} />
              </div>
              <div>
                <Label>Selling Price (NPR)</Label>
                <Input type="number" value={form.unit_selling_price} onChange={e => setForm({ ...form, unit_selling_price: e.target.value === '' ? '' : parseFloat(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Stock Location</Label>
                <Input value={form.stock_location} onChange={e => setForm({ ...form, stock_location: e.target.value })} />
              </div>
              <div>
                <Label>Supplier Name</Label>
                <Input value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Aging Alert (Days)</Label>
              <Input type="number" value={form.aging_days} onChange={e => setForm({ ...form, aging_days: parseInt(e.target.value) || 90 })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date of Expiry</Label>
                <Input type="date" value={form.expiry_date || ''} onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
              </div>
              <div>
                <Label>Expiry Alert (Days Before)</Label>
                <Input type="number" placeholder="e.g. 30" value={form.expiry_alert_days || ''} onChange={e => setForm({ ...form, expiry_alert_days: parseInt(e.target.value) || '' })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addItem} disabled={!form.description}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}