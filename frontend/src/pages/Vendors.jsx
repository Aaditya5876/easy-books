import { useState, useEffect } from 'react';
import { api } from '@/api/adapter';
import { getActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import { Users } from 'lucide-react';

const PAYMENT_TERMS = ['Immediate', 'NET-15', 'NET-30', 'NET-45', 'NET-60'];
const EMPTY_FORM = { name: '', contact_person: '', phone: '', email: '', address: '', pan_vat: '', opening_balance: '', credit_limit: '', payment_terms: 'Immediate', notes: '' };

export default function Vendors() {
  const companyId = getActiveCompanyId();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({ name: '', contact_person: '', phone: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editVendor, setEditVendor] = useState(null);

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);
    const data = await api.Vendor.filter({ company_id: companyId });
    setVendors(data);
    setLoading(false);
  }

  async function addVendor() {
    await api.Vendor.create({
      ...form,
      company_id: companyId,
      opening_balance: form.opening_balance ? parseFloat(form.opening_balance) : 0,
      credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : null,
    });
    setForm(EMPTY_FORM);
    setShowAdd(false);
    loadData();
  }

  async function updateVendor() {
    await api.Vendor.update(editVendor.id, {
      ...editVendor,
      opening_balance: parseFloat(editVendor.opening_balance) || 0,
      credit_limit: editVendor.credit_limit ? parseFloat(editVendor.credit_limit) : null,
    });
    setEditVendor(null);
    loadData();
  }

  const filtered = vendors.filter(v =>
    (v.name?.toLowerCase().includes(search.toLowerCase()) ||
     v.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
     v.phone?.includes(search)) &&
    (!colFilters.name || v.name?.toLowerCase().includes(colFilters.name.toLowerCase())) &&
    (!colFilters.contact_person || v.contact_person?.toLowerCase().includes(colFilters.contact_person.toLowerCase())) &&
    (!colFilters.phone || (v.phone || '').includes(colFilters.phone))
  );

  const columns = [
    { key: 'name', label: 'Vendor Name', filterValue: colFilters.name, onFilterChange: v => setCol('name', v), render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'contact_person', label: 'Contact Person', filterValue: colFilters.contact_person, onFilterChange: v => setCol('contact_person', v) },
    { key: 'phone', label: 'Phone', filterValue: colFilters.phone, onFilterChange: v => setCol('phone', v) },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address' },
    { key: 'total_purchases', label: 'Total Purchases', render: (row) => (
      <span className="font-mono">NPR {(row.total_purchases || 0).toLocaleString()}</span>
    )},
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Vendors" subtitle={`${vendors.length} vendors`} searchValue={search} onSearchChange={setSearch} onAdd={() => setShowAdd(true)} addLabel="Add Vendor" />

      {vendors.length === 0 ? (
        <EmptyState icon={Users} title="No vendors yet" description="Add your first vendor to start tracking purchases." action={<Button onClick={() => setShowAdd(true)}>Add Vendor</Button>} />
      ) : (
        <DataTable columns={columns} data={filtered} emptyMessage="No vendors match your search." onRowClick={(row) => setEditVendor({ ...row })} />
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md glass-card">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Add Vendor
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Vendor Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>PAN/VAT No. <span className="text-muted-foreground text-xs">(optional)</span></Label><Input value={form.pan_vat} onChange={e => setForm({ ...form, pan_vat: e.target.value })} placeholder="e.g. 123456789" /></div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 mt-2">Financial Details</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Opening Balance (NPR) <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="number" placeholder="0.00" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: e.target.value })} />
                <p className="text-xs text-muted-foreground mt-1">Amount already owed to vendor</p>
              </div>
              <div>
                <Label>Credit Limit (NPR) <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="number" placeholder="e.g. 50000" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Payment Terms</Label>
              <Select value={form.payment_terms} onValueChange={v => setForm({ ...form, payment_terms: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addVendor} disabled={!form.name}>Add Vendor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editVendor} onOpenChange={open => { if (!open) setEditVendor(null); }}>
        <DialogContent className="max-w-md glass-card">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Edit Vendor
              </div>
            </DialogTitle>
          </DialogHeader>
          {editVendor && (
            <div className="space-y-3">
              <div><Label>Vendor Name *</Label><Input value={editVendor.name} onChange={e => setEditVendor({ ...editVendor, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contact Person</Label><Input value={editVendor.contact_person || ''} onChange={e => setEditVendor({ ...editVendor, contact_person: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={editVendor.phone || ''} onChange={e => setEditVendor({ ...editVendor, phone: e.target.value })} /></div>
              </div>
              <div><Label>Email</Label><Input value={editVendor.email || ''} onChange={e => setEditVendor({ ...editVendor, email: e.target.value })} /></div>
              <div><Label>Address</Label><Input value={editVendor.address || ''} onChange={e => setEditVendor({ ...editVendor, address: e.target.value })} /></div>
              <div><Label>PAN/VAT No. <span className="text-muted-foreground text-xs">(optional)</span></Label><Input value={editVendor.pan_vat || ''} onChange={e => setEditVendor({ ...editVendor, pan_vat: e.target.value })} placeholder="e.g. 123456789" /></div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 mt-2">Financial Details</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Opening Balance (NPR) <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input type="number" placeholder="0.00" value={editVendor.opening_balance || ''} onChange={e => setEditVendor({ ...editVendor, opening_balance: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Amount already owed to vendor</p>
                </div>
                <div>
                  <Label>Credit Limit (NPR) <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input type="number" placeholder="e.g. 50000" value={editVendor.credit_limit || ''} onChange={e => setEditVendor({ ...editVendor, credit_limit: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Payment Terms</Label>
                <Select value={editVendor.payment_terms} onValueChange={v => setEditVendor({ ...editVendor, payment_terms: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label><Textarea value={editVendor.notes || ''} onChange={e => setEditVendor({ ...editVendor, notes: e.target.value })} rows={2} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditVendor(null)}>Cancel</Button>
            <Button onClick={updateVendor} disabled={!editVendor?.name}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
