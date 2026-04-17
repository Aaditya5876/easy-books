import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

const CRM_STATUSES = ['lead', 'prospect', 'active', 'inactive'];

export default function Clients() {
  const companyId = getActiveCompanyId();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({ name: '', contact_person: '', crm_status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '', pan_vat: '', crm_status: 'active', notes: '' });

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);
    const data = await base44.entities.Client.filter({ company_id: companyId });
    setClients(data);
    setLoading(false);
  }

  async function addClient() {
    await base44.entities.Client.create({ ...form, company_id: companyId });
    setForm({ name: '', contact_person: '', phone: '', email: '', address: '', pan_vat: '', crm_status: 'active', notes: '' });
    setShowAdd(false);
    loadData();
  }

  const filtered = clients.filter(c =>
    (c.name?.toLowerCase().includes(search.toLowerCase()) ||
     c.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
     c.phone?.includes(search)) &&
    (!colFilters.name || c.name?.toLowerCase().includes(colFilters.name.toLowerCase())) &&
    (!colFilters.contact_person || c.contact_person?.toLowerCase().includes(colFilters.contact_person.toLowerCase())) &&
    (!colFilters.crm_status || c.crm_status?.toLowerCase().includes(colFilters.crm_status.toLowerCase()))
  );

  const statusColors = {
    lead: 'bg-blue-100 text-blue-700',
    prospect: 'bg-amber-100 text-amber-700',
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-600',
  };

  const columns = [
    { key: 'name', label: 'Client Name', filterValue: colFilters.name, onFilterChange: v => setCol('name', v), render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'contact_person', label: 'Contact', filterValue: colFilters.contact_person, onFilterChange: v => setCol('contact_person', v) },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'crm_status', label: 'CRM Status', filterValue: colFilters.crm_status, onFilterChange: v => setCol('crm_status', v), filterPlaceholder: 'e.g. active', render: (row) => (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[row.crm_status] || ''}`}>
        {row.crm_status}
      </span>
    )},
    { key: 'total_sales', label: 'Total Sales', render: (row) => (
      <span className="font-mono">NPR {(row.total_sales || 0).toLocaleString()}</span>
    )},
  ];

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Clients" subtitle={`${clients.length} clients · CRM Overview`} searchValue={search} onSearchChange={setSearch} onAdd={() => setShowAdd(true)} addLabel="Add Client" />

      {/* CRM Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CRM_STATUSES.map(status => (
          <div key={status} className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold">{clients.filter(c => c.crm_status === status).length}</p>
            <p className="text-xs text-muted-foreground capitalize mt-1">{status}</p>
          </div>
        ))}
      </div>

      <DataTable columns={columns} data={filtered} emptyMessage="No clients yet. Clients are auto-created from sales entries." />

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Client Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>PAN/VAT No.</Label><Input value={form.pan_vat} onChange={e => setForm({ ...form, pan_vat: e.target.value })} /></div>
            <div>
              <Label>CRM Status</Label>
              <Select value={form.crm_status} onValueChange={v => setForm({ ...form, crm_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRM_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addClient} disabled={!form.name}>Add Client</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}