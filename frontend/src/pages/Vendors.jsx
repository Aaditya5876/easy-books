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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import {
  Users, Building2, Phone, Mail, MapPin, Hash, Wallet, CreditCard, FileText, Truck, User
} from 'lucide-react';
import { useRole } from "@/lib/useRole";

const PAYMENT_TERMS = ['Immediate', 'NET-15', 'NET-30', 'NET-45', 'NET-60'];
const EMPTY_FORM = { name: '', contact_person: '', phone: '', email: '', address: '', pan_vat: '', opening_balance: '', credit_limit: '', payment_terms: 'Immediate', notes: '' };

export default function Vendors() {
  const companyId = getActiveCompanyId();
  const { canEdit } = useRole();
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
        <DataTable columns={columns} data={filtered} emptyMessage="No vendors match your search." onRowClick={canEdit ? (row) => setEditVendor({ ...row }) : undefined} />
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="glass-dialog max-w-3xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-orange-400 to-amber-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Add Vendor
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 max-h-[65vh] overflow-hidden mt-2">
            {/* LEFT COLUMN */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="space-y-3 overflow-y-auto pr-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b pb-1.5 mb-2">
                <Truck className="w-3.5 h-3.5" />
                Vendor Details
              </h4>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Vendor Name *</Label>
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
                <Label className="text-xs font-medium">Payment Terms</Label>
                <Select value={form.payment_terms} onValueChange={v => setForm({ ...form, payment_terms: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Notes</Label>
                <div className="relative">
                  <FileText className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Textarea className="pl-8 text-sm" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
                </div>
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
                <p className="text-xs text-muted-foreground">Amount already owed to vendor</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Credit Limit</Label>
                <div className="flex items-stretch">
                  <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                  <SmartNumberInput className="rounded-l-none h-9 text-sm flex-1" placeholder="e.g. 50000" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: e.target.value })} />
                </div>
              </div>
            </motion.div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addVendor} disabled={!form.name}>Add Vendor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editVendor} onOpenChange={open => { if (!open) setEditVendor(null); }}>
        <DialogContent className="glass-dialog max-w-3xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-orange-400 to-amber-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Edit Vendor
            </DialogTitle>
          </DialogHeader>

          {editVendor && (
            <div className="grid grid-cols-2 gap-6 max-h-[65vh] overflow-hidden mt-2">
              {/* LEFT COLUMN */}
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="space-y-3 overflow-y-auto pr-1">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b pb-1.5 mb-2">
                  <Truck className="w-3.5 h-3.5" />
                  Vendor Details
                </h4>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Vendor Name *</Label>
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editVendor.name} onChange={e => setEditVendor({ ...editVendor, name: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">PAN/VAT No.</Label>
                  <div className="relative">
                    <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editVendor.pan_vat || ''} onChange={e => setEditVendor({ ...editVendor, pan_vat: e.target.value })} placeholder="e.g. 123456789" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Payment Terms</Label>
                  <Select value={editVendor.payment_terms} onValueChange={v => setEditVendor({ ...editVendor, payment_terms: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Notes</Label>
                  <div className="relative">
                    <FileText className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Textarea className="pl-8 text-sm" value={editVendor.notes || ''} onChange={e => setEditVendor({ ...editVendor, notes: e.target.value })} rows={3} />
                  </div>
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
                    <Input className="pl-8 h-9 text-sm" value={editVendor.contact_person || ''} onChange={e => setEditVendor({ ...editVendor, contact_person: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editVendor.phone || ''} onChange={e => setEditVendor({ ...editVendor, phone: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editVendor.email || ''} onChange={e => setEditVendor({ ...editVendor, email: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editVendor.address || ''} onChange={e => setEditVendor({ ...editVendor, address: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Opening Balance</Label>
                  <div className="flex items-stretch">
                    <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                    <SmartNumberInput className="rounded-l-none h-9 text-sm flex-1" placeholder="0.00" value={editVendor.opening_balance || ''} onChange={e => setEditVendor({ ...editVendor, opening_balance: e.target.value })} />
                  </div>
                  <p className="text-xs text-muted-foreground">Amount already owed to vendor</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Credit Limit</Label>
                  <div className="flex items-stretch">
                    <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                    <SmartNumberInput className="rounded-l-none h-9 text-sm flex-1" placeholder="e.g. 50000" value={editVendor.credit_limit || ''} onChange={e => setEditVendor({ ...editVendor, credit_limit: e.target.value })} />
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditVendor(null)}>Cancel</Button>
            {canEdit && <Button onClick={updateVendor} disabled={!editVendor?.name}>Save Changes</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
