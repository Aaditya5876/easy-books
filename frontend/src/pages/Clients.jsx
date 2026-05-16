import { useState, useEffect } from 'react';
import { api } from '@/api/adapter';
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
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import { UserCheck } from 'lucide-react';

const CRM_STATUSES = ['lead', 'prospect', 'active', 'inactive'];
const PAYMENT_TERMS = ['Immediate', 'NET-15', 'NET-30', 'NET-45', 'NET-60'];
const EMPTY_FORM = { name: '', contact_person: '', phone: '', email: '', address: '', pan_vat: '', crm_status: 'active', opening_balance: '', credit_limit: '', payment_terms: 'Immediate', notes: '' };

export default function Clients() {
  const companyId = getActiveCompanyId();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({ name: '', contact_person: '', crm_status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editClient, setEditClient] = useState(null);

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);
    const data = await api.Client.filter({ company_id: companyId });
    setClients(data);
    setLoading(false);
  }

  async function addClient() {
    await api.Client.create({
      ...form,
      company_id: companyId,
      opening_balance: form.opening_balance ? parseFloat(form.opening_balance) : 0,
      credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : null,
    });
    setForm(EMPTY_FORM);
    setShowAdd(false);
    loadData();
  }

  async function updateClient() {
    await api.Client.update(editClient.id, {
      ...editClient,
      opening_balance: parseFloat(editClient.opening_balance) || 0,
      credit_limit: editClient.credit_limit ? parseFloat(editClient.credit_limit) : null,
    });
    setEditClient(null);
    loadData();
  }

  const statusColors = {
    lead: 'bg-blue-100 text-blue-700',
    prospect: 'bg-amber-100 text-amber-700',
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-600',
  };

  const filtered = clients.filter(c =>
    (c.name?.toLowerCase().includes(search.toLowerCase()) ||
     c.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
     c.phone?.includes(search)) &&
    (!colFilters.name || c.name?.toLowerCase().includes(colFilters.name.toLowerCase())) &&
    (!colFilters.contact_person || c.contact_person?.toLowerCase().includes(colFilters.contact_person.toLowerCase())) &&
    (!colFilters.crm_status || c.crm_status?.toLowerCase().includes(colFilters.crm_status.toLowerCase()))
  );

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

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Clients" subtitle={`${clients.length} clients · CRM Overview`} searchValue={search} onSearchChange={setSearch} onAdd={() => setShowAdd(true)} addLabel="Add Client" />

      {/* CRM Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CRM_STATUSES.map(status => (
          <div key={status} className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{clients.filter(c => c.crm_status === status).length}</p>
            <p className="text-xs text-muted-foreground capitalize mt-1">{status}</p>
          </div>
        ))}
      </div>

      {clients.length === 0 ? (
        <EmptyState icon={UserCheck} title="No clients yet" description="Add your first client to start managing your sales relationships." action={<Button onClick={() => setShowAdd(true)}>Add Client</Button>} />
      ) : (
        <DataTable columns={columns} data={filtered} emptyMessage="No clients match your search." onRowClick={(row) => setEditClient({ ...row })} />
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md glass-card">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                Add Client
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Client Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>PAN/VAT No. <span className="text-muted-foreground text-xs">(optional)</span></Label><Input value={form.pan_vat} onChange={e => setForm({ ...form, pan_vat: e.target.value })} placeholder="e.g. 123456789" /></div>
            <div>
              <Label>CRM Status</Label>
              <Select value={form.crm_status} onValueChange={v => setForm({ ...form, crm_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRM_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 mt-2">Financial Details</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Opening Balance (NPR) <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="number" placeholder="0.00" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: e.target.value })} />
                <p className="text-xs text-muted-foreground mt-1">Amount client already owes you</p>
              </div>
              <div>
                <Label>Credit Limit (NPR) <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="number" placeholder="e.g. 100000" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: e.target.value })} />
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
            <Button onClick={addClient} disabled={!form.name}>Add Client</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editClient} onOpenChange={open => { if (!open) setEditClient(null); }}>
        <DialogContent className="max-w-md glass-card">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                Edit Client
              </div>
            </DialogTitle>
          </DialogHeader>
          {editClient && (
            <div className="space-y-3">
              <div><Label>Client Name *</Label><Input value={editClient.name} onChange={e => setEditClient({ ...editClient, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contact Person</Label><Input value={editClient.contact_person || ''} onChange={e => setEditClient({ ...editClient, contact_person: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={editClient.phone || ''} onChange={e => setEditClient({ ...editClient, phone: e.target.value })} /></div>
              </div>
              <div><Label>Email</Label><Input value={editClient.email || ''} onChange={e => setEditClient({ ...editClient, email: e.target.value })} /></div>
              <div><Label>Address</Label><Input value={editClient.address || ''} onChange={e => setEditClient({ ...editClient, address: e.target.value })} /></div>
              <div><Label>PAN/VAT No. <span className="text-muted-foreground text-xs">(optional)</span></Label><Input value={editClient.pan_vat || ''} onChange={e => setEditClient({ ...editClient, pan_vat: e.target.value })} placeholder="e.g. 123456789" /></div>
              <div>
                <Label>CRM Status</Label>
                <Select value={editClient.crm_status} onValueChange={v => setEditClient({ ...editClient, crm_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CRM_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 mt-2">Financial Details</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Opening Balance (NPR) <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input type="number" placeholder="0.00" value={editClient.opening_balance || ''} onChange={e => setEditClient({ ...editClient, opening_balance: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Amount client already owes you</p>
                </div>
                <div>
                  <Label>Credit Limit (NPR) <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input type="number" placeholder="e.g. 100000" value={editClient.credit_limit || ''} onChange={e => setEditClient({ ...editClient, credit_limit: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Payment Terms</Label>
                <Select value={editClient.payment_terms} onValueChange={v => setEditClient({ ...editClient, payment_terms: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label><Textarea value={editClient.notes || ''} onChange={e => setEditClient({ ...editClient, notes: e.target.value })} rows={2} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClient(null)}>Cancel</Button>
            <Button onClick={updateClient} disabled={!editClient?.name}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
