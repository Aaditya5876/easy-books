import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/api/adapter';
import { getActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SmartNumberInput } from "@/components/ui/smart-number-input";
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
import {
  UserCheck, Building2, Phone, Mail, MapPin, Hash, Wallet, CreditCard, FileText, Truck, User, Upload
} from 'lucide-react';
import { useRole } from "@/lib/useRole";
import BulkImportDialog from '../components/shared/BulkImportDialog';
import { CLIENT_FIELDS } from '../components/shared/bulkImportFields';

const CRM_STATUSES = ['lead', 'prospect', 'active', 'inactive'];
const PAYMENT_TERMS = ['Immediate', 'NET-15', 'NET-30', 'NET-45', 'NET-60'];
const EMPTY_FORM = { name: '', contact_person: '', phone: '', email: '', address: '', pan_vat: '', crm_status: 'active', opening_balance: '', credit_limit: '', payment_terms: 'Immediate', notes: '' };

export default function Clients() {
  const companyId = getActiveCompanyId();
  const { canEdit } = useRole();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({ name: '', contact_person: '', crm_status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editClient, setEditClient] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

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
      <PageHeader title="Clients" subtitle={`${clients.length} clients · CRM Overview`} searchValue={search} onSearchChange={setSearch} onAdd={() => setShowAdd(true)} addLabel="Add Client">
        {canEdit && (
          <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4" /> Import
          </Button>
        )}
      </PageHeader>

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="clients"
        title="Import Clients"
        fields={CLIENT_FIELDS}
        onDone={loadData}
      />

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
        <DataTable columns={columns} data={filtered} emptyMessage="No clients match your search." onRowClick={canEdit ? (row) => setEditClient({ ...row }) : undefined} />
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="glass-dialog max-w-3xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-rose-400 to-pink-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              Add Client
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 max-h-[65vh] overflow-hidden mt-2">
            {/* LEFT COLUMN */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="space-y-3 overflow-y-auto pr-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b pb-1.5 mb-2">
                <UserCheck className="w-3.5 h-3.5" />
                Client Details
              </h4>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Client Name *</Label>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">PAN/VAT No.</Label>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={form.pan_vat} onChange={e => setForm({ ...form, pan_vat: e.target.value })} placeholder="e.g. 123456789" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">CRM Status</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {CRM_STATUSES.map(s => (
                    <button key={s} type="button"
                      onClick={() => setForm({ ...form, crm_status: s })}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all capitalize
                        ${form.crm_status === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Payment Terms</Label>
                <Select value={form.payment_terms} onValueChange={v => setForm({ ...form, payment_terms: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </motion.div>

            {/* RIGHT COLUMN */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut', delay: 0.06 }}
              className="space-y-3 overflow-y-auto pr-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b pb-1.5 mb-2">
                <User className="w-3.5 h-3.5" />
                Contact &amp; Finance
              </h4>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Contact Person</Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Opening Balance</Label>
                <div className="flex items-stretch">
                  <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                  <SmartNumberInput className="rounded-l-none h-9 text-sm flex-1" placeholder="0.00" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: e.target.value })} />
                </div>
                <p className="text-xs text-muted-foreground">Amount client already owes you</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Credit Limit</Label>
                <div className="flex items-stretch">
                  <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                  <SmartNumberInput className="rounded-l-none h-9 text-sm flex-1" placeholder="e.g. 100000" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Notes</Label>
                <div className="relative">
                  <FileText className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Textarea className="pl-8 text-sm" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
                </div>
              </div>
            </motion.div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addClient} disabled={!form.name}>Add Client</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editClient} onOpenChange={open => { if (!open) setEditClient(null); }}>
        <DialogContent className="glass-dialog max-w-3xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-rose-400 to-pink-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              Edit Client
            </DialogTitle>
          </DialogHeader>

          {editClient && (
            <div className="grid grid-cols-2 gap-6 max-h-[65vh] overflow-hidden mt-2">
              {/* LEFT COLUMN */}
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="space-y-3 overflow-y-auto pr-1">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b pb-1.5 mb-2">
                  <UserCheck className="w-3.5 h-3.5" />
                  Client Details
                </h4>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Client Name *</Label>
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editClient.name} onChange={e => setEditClient({ ...editClient, name: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">PAN/VAT No.</Label>
                  <div className="relative">
                    <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editClient.pan_vat || ''} onChange={e => setEditClient({ ...editClient, pan_vat: e.target.value })} placeholder="e.g. 123456789" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">CRM Status</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {CRM_STATUSES.map(s => (
                      <button key={s} type="button"
                        onClick={() => setEditClient({ ...editClient, crm_status: s })}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all capitalize
                          ${editClient.crm_status === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Payment Terms</Label>
                  <Select value={editClient.payment_terms} onValueChange={v => setEditClient({ ...editClient, payment_terms: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>

              {/* RIGHT COLUMN */}
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut', delay: 0.06 }}
                className="space-y-3 overflow-y-auto pr-1">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b pb-1.5 mb-2">
                  <User className="w-3.5 h-3.5" />
                  Contact &amp; Finance
                </h4>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Contact Person</Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editClient.contact_person || ''} onChange={e => setEditClient({ ...editClient, contact_person: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editClient.phone || ''} onChange={e => setEditClient({ ...editClient, phone: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editClient.email || ''} onChange={e => setEditClient({ ...editClient, email: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editClient.address || ''} onChange={e => setEditClient({ ...editClient, address: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Opening Balance</Label>
                  <div className="flex items-stretch">
                    <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                    <SmartNumberInput className="rounded-l-none h-9 text-sm flex-1" placeholder="0.00" value={editClient.opening_balance || ''} onChange={e => setEditClient({ ...editClient, opening_balance: e.target.value })} />
                  </div>
                  <p className="text-xs text-muted-foreground">Amount client already owes you</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Credit Limit</Label>
                  <div className="flex items-stretch">
                    <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                    <SmartNumberInput className="rounded-l-none h-9 text-sm flex-1" placeholder="e.g. 100000" value={editClient.credit_limit || ''} onChange={e => setEditClient({ ...editClient, credit_limit: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Notes</Label>
                  <div className="relative">
                    <FileText className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Textarea className="pl-8 text-sm" value={editClient.notes || ''} onChange={e => setEditClient({ ...editClient, notes: e.target.value })} rows={3} />
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClient(null)}>Cancel</Button>
            {canEdit && <Button onClick={updateClient} disabled={!editClient?.name}>Save Changes</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
