import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
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

export default function Vendors() {
  const companyId = getActiveCompanyId();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({ name: '', contact_person: '', phone: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '', pan_vat: '', notes: '' });

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);
    const data = await base44.entities.Vendor.filter({ company_id: companyId });
    setVendors(data);
    setLoading(false);
  }

  async function addVendor() {
    await base44.entities.Vendor.create({ ...form, company_id: companyId });
    setForm({ name: '', contact_person: '', phone: '', email: '', address: '', pan_vat: '', notes: '' });
    setShowAdd(false);
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

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Vendors" subtitle={`${vendors.length} vendors`} searchValue={search} onSearchChange={setSearch} onAdd={() => setShowAdd(true)} addLabel="Add Vendor" />
      <DataTable columns={columns} data={filtered} emptyMessage="No vendors yet. Vendors are auto-created from purchase entries." />
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Vendor Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>PAN/VAT No.</Label><Input value={form.pan_vat} onChange={e => setForm({ ...form, pan_vat: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addVendor} disabled={!form.name}>Add Vendor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}