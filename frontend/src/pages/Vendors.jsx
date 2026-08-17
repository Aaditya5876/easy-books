import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  Users, Building2, Phone, Mail, MapPin, Hash, Wallet, CreditCard, FileText, Truck, User, Upload
} from 'lucide-react';
import { useRole } from "@/lib/useRole";
import BulkImportDialog from '../components/shared/BulkImportDialog';
import { VENDOR_FIELDS } from '../components/shared/bulkImportFields';

const PAYMENT_TERMS = ['Immediate', 'NET-15', 'NET-30', 'NET-45', 'NET-60'];
const PAYMENT_TERM_KEYS = { 'Immediate': 'immediate', 'NET-15': 'net15', 'NET-30': 'net30', 'NET-45': 'net45', 'NET-60': 'net60' };
const EMPTY_FORM = { name: '', contact_person: '', phone: '', email: '', address: '', pan_vat: '', opening_balance: '', credit_limit: '', payment_terms: 'Immediate', notes: '' };

export default function Vendors() {
  const { t } = useTranslation();
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
  const [importOpen, setImportOpen] = useState(false);

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
    { key: 'name', label: t('vendors.vendorName', { defaultValue: 'Vendor Name' }), filterValue: colFilters.name, onFilterChange: v => setCol('name', v), render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'contact_person', label: t('vendors.contactPerson', { defaultValue: 'Contact Person' }), filterValue: colFilters.contact_person, onFilterChange: v => setCol('contact_person', v) },
    { key: 'phone', label: t('vendors.phone', { defaultValue: 'Phone' }), filterValue: colFilters.phone, onFilterChange: v => setCol('phone', v) },
    { key: 'email', label: t('vendors.email', { defaultValue: 'Email' }) },
    { key: 'address', label: t('vendors.address', { defaultValue: 'Address' }) },
    { key: 'total_purchases', label: t('vendors.totalPurchases', { defaultValue: 'Total Purchases' }), render: (row) => (
      <span className="font-mono">NPR {(row.total_purchases || 0).toLocaleString()}</span>
    )},
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('vendors.title', { defaultValue: 'Vendors' })} subtitle={t('vendors.subtitle', { defaultValue: '{{count}} vendors', count: vendors.length })} searchValue={search} onSearchChange={setSearch} onAdd={() => setShowAdd(true)} addLabel={t('vendors.addVendor', { defaultValue: 'Add Vendor' })}>
        {canEdit && (
          <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4" /> {t('vendors.import', { defaultValue: 'Import' })}
          </Button>
        )}
      </PageHeader>

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="vendors"
        title={t('vendors.importVendors', { defaultValue: 'Import Vendors' })}
        fields={VENDOR_FIELDS}
        onDone={loadData}
      />

      {vendors.length === 0 ? (
        <EmptyState icon={Users} title={t('vendors.noVendorsYet', { defaultValue: 'No vendors yet' })} description={t('vendors.noVendorsYetHint', { defaultValue: 'Add your first vendor to start tracking purchases.' })} action={<Button onClick={() => setShowAdd(true)}>{t('vendors.addVendor', { defaultValue: 'Add Vendor' })}</Button>} />
      ) : (
        <DataTable columns={columns} data={filtered} emptyMessage={t('vendors.noVendorsMatch', { defaultValue: 'No vendors match your search.' })} onRowClick={canEdit ? (row) => setEditVendor({ ...row }) : undefined} />
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="glass-dialog max-w-3xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-orange-400 to-amber-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              {t('vendors.addVendor', { defaultValue: 'Add Vendor' })}
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
                {t('vendors.vendorDetails', { defaultValue: 'Vendor Details' })}
              </h4>

              <div className="space-y-1">
                <Label className="text-xs font-medium">{t('vendors.vendorNameRequired', { defaultValue: 'Vendor Name *' })}</Label>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">{t('vendors.panVatNo', { defaultValue: 'PAN/VAT No.' })}</Label>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={form.pan_vat} onChange={e => setForm({ ...form, pan_vat: e.target.value })} placeholder={t('vendors.panVatPlaceholder', { defaultValue: 'e.g. 123456789' })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">{t('vendors.paymentTerms', { defaultValue: 'Payment Terms' })}</Label>
                <Select value={form.payment_terms} onValueChange={v => setForm({ ...form, payment_terms: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map(term => <SelectItem key={term} value={term}>{t(`vendors.paymentTerm.${PAYMENT_TERM_KEYS[term]}`, { defaultValue: term })}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">{t('vendors.notes', { defaultValue: 'Notes' })}</Label>
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
                {t('vendors.contactAndFinance', { defaultValue: 'Contact & Finance' })}
              </h4>

              <div className="space-y-1">
                <Label className="text-xs font-medium">{t('vendors.contactPerson', { defaultValue: 'Contact Person' })}</Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">{t('vendors.phone', { defaultValue: 'Phone' })}</Label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">{t('vendors.email', { defaultValue: 'Email' })}</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">{t('vendors.address', { defaultValue: 'Address' })}</Label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">{t('vendors.openingBalance', { defaultValue: 'Opening Balance' })}</Label>
                <div className="flex items-stretch">
                  <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                  <SmartNumberInput className="rounded-l-none h-9 text-sm flex-1" placeholder="0.00" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: e.target.value })} />
                </div>
                <p className="text-xs text-muted-foreground">{t('vendors.openingBalanceHint', { defaultValue: 'Amount already owed to vendor' })}</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">{t('vendors.creditLimit', { defaultValue: 'Credit Limit' })}</Label>
                <div className="flex items-stretch">
                  <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                  <SmartNumberInput className="rounded-l-none h-9 text-sm flex-1" placeholder={t('vendors.creditLimitPlaceholder', { defaultValue: 'e.g. 50000' })} value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: e.target.value })} />
                </div>
              </div>
            </motion.div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t('vendors.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={addVendor} disabled={!form.name}>{t('vendors.addVendor', { defaultValue: 'Add Vendor' })}</Button>
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
              {t('vendors.editVendor', { defaultValue: 'Edit Vendor' })}
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
                  {t('vendors.vendorDetails', { defaultValue: 'Vendor Details' })}
                </h4>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">{t('vendors.vendorNameRequired', { defaultValue: 'Vendor Name *' })}</Label>
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editVendor.name} onChange={e => setEditVendor({ ...editVendor, name: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">{t('vendors.panVatNo', { defaultValue: 'PAN/VAT No.' })}</Label>
                  <div className="relative">
                    <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editVendor.pan_vat || ''} onChange={e => setEditVendor({ ...editVendor, pan_vat: e.target.value })} placeholder={t('vendors.panVatPlaceholder', { defaultValue: 'e.g. 123456789' })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">{t('vendors.paymentTerms', { defaultValue: 'Payment Terms' })}</Label>
                  <Select value={editVendor.payment_terms} onValueChange={v => setEditVendor({ ...editVendor, payment_terms: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map(term => <SelectItem key={term} value={term}>{t(`vendors.paymentTerm.${PAYMENT_TERM_KEYS[term]}`, { defaultValue: term })}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">{t('vendors.notes', { defaultValue: 'Notes' })}</Label>
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
                  {t('vendors.contactAndFinance', { defaultValue: 'Contact & Finance' })}
                </h4>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">{t('vendors.contactPerson', { defaultValue: 'Contact Person' })}</Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editVendor.contact_person || ''} onChange={e => setEditVendor({ ...editVendor, contact_person: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">{t('vendors.phone', { defaultValue: 'Phone' })}</Label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editVendor.phone || ''} onChange={e => setEditVendor({ ...editVendor, phone: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">{t('vendors.email', { defaultValue: 'Email' })}</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editVendor.email || ''} onChange={e => setEditVendor({ ...editVendor, email: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">{t('vendors.address', { defaultValue: 'Address' })}</Label>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editVendor.address || ''} onChange={e => setEditVendor({ ...editVendor, address: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">{t('vendors.openingBalance', { defaultValue: 'Opening Balance' })}</Label>
                  <div className="flex items-stretch">
                    <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                    <SmartNumberInput className="rounded-l-none h-9 text-sm flex-1" placeholder="0.00" value={editVendor.opening_balance || ''} onChange={e => setEditVendor({ ...editVendor, opening_balance: e.target.value })} />
                  </div>
                  <p className="text-xs text-muted-foreground">{t('vendors.openingBalanceHint', { defaultValue: 'Amount already owed to vendor' })}</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">{t('vendors.creditLimit', { defaultValue: 'Credit Limit' })}</Label>
                  <div className="flex items-stretch">
                    <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                    <SmartNumberInput className="rounded-l-none h-9 text-sm flex-1" placeholder={t('vendors.creditLimitPlaceholder', { defaultValue: 'e.g. 50000' })} value={editVendor.credit_limit || ''} onChange={e => setEditVendor({ ...editVendor, credit_limit: e.target.value })} />
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditVendor(null)}>{t('vendors.cancel', { defaultValue: 'Cancel' })}</Button>
            {canEdit && <Button onClick={updateVendor} disabled={!editVendor?.name}>{t('vendors.saveChanges', { defaultValue: 'Save Changes' })}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
