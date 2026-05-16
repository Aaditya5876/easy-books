import { useState, useEffect } from 'react';
import { api } from '@/api/adapter';
import { getActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { FileText, Receipt, Mail, Printer, Plus, Building2, User, Phone, MapPin } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { motion } from 'framer-motion';

const TEMPLATE_TYPES = [
  { type: 'invoice',    label: 'Invoice',     icon: Receipt,  color: 'bg-blue-500',    desc: 'Generate professional invoices for clients' },
  { type: 'quotation',  label: 'Quotation',   icon: FileText, color: 'bg-emerald-500', desc: 'Create detailed quotations and estimates' },
  { type: 'letterhead', label: 'Letter Head', icon: Mail,     color: 'bg-violet-500',  desc: 'Official company letterhead templates' },
  { type: 'form',       label: 'Forms',       icon: FileText, color: 'bg-amber-500',   desc: 'Custom business forms and documents' },
];

const STRIPE_COLORS = {
  invoice:    'from-blue-400 to-indigo-500',
  quotation:  'from-emerald-400 to-teal-500',
  letterhead: 'from-violet-400 to-purple-500',
  form:       'from-amber-400 to-orange-500',
};

const TYPE_ICON_COLORS = {
  invoice:    'text-blue-500',
  quotation:  'text-emerald-500',
  letterhead: 'text-violet-500',
  form:       'text-amber-500',
};

export default function Templates() {
  const companyId = getActiveCompanyId();
  const [companies, setCompanies] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [form, setForm] = useState({
    company_id: '', client_name: '', client_address: '', client_contact: '',
    items: [{ description: '', quantity: 1, unit_price: 0 }],
    notes: '', is_vat: false
  });

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    const data = await api.Company.list();
    setCompanies(data);
  }

  function openGenerator(type) {
    setSelectedType(type);
    setShowGenerator(true);
    setForm({
      company_id: companyId || '', client_name: '', client_address: '', client_contact: '',
      items: [{ description: '', quantity: 1, unit_price: 0 }],
      notes: '', is_vat: false
    });
  }

  function addItem() {
    setForm({ ...form, items: [...form.items, { description: '', quantity: 1, unit_price: 0 }] });
  }

  function updateItem(idx, field, value) {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, items });
  }

  function handlePrint() {
    window.print();
  }

  const subtotal = form.items.reduce((sum, i) => sum + (i.quantity || 0) * (i.unit_price || 0), 0);
  const vat = form.is_vat ? subtotal * 0.13 : 0;
  const selectedCompany = companies.find(c => c.id === form.company_id);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Templates" subtitle="Invoice, quotation and document templates" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TEMPLATE_TYPES.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.type}
              onClick={() => openGenerator(t.type)}
              className="bg-card rounded-xl border border-border p-6 text-left hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <div className={`w-12 h-12 rounded-xl ${t.color} text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-foreground">{t.label}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
              {companies.length > 0 && (
                <p className="text-xs text-primary mt-2">{companies.length} company templates</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Template Generator Dialog */}
      <Dialog open={showGenerator} onOpenChange={setShowGenerator}>
        <DialogContent className="glass-dialog max-w-4xl overflow-hidden">
          <div className={`h-1 bg-gradient-to-r ${STRIPE_COLORS[selectedType] || STRIPE_COLORS.invoice} -mx-6 -mt-6 mb-4`} />
          <DialogHeader className="mb-2">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              {selectedType && (() => {
                const t = TEMPLATE_TYPES.find(x => x.type === selectedType);
                const Icon = t?.icon;
                return Icon ? <Icon className={`w-4 h-4 ${TYPE_ICON_COLORS[selectedType]}`} /> : null;
              })()}
              Generate {selectedType ? selectedType.charAt(0).toUpperCase() + selectedType.slice(1) : ''}
            </DialogTitle>
          </DialogHeader>

          <motion.div
            className="overflow-y-auto max-h-[65vh] pr-1 space-y-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
          >
            {/* Two-column: company+client / notes+options */}
            <div className="grid grid-cols-2 gap-6">
              {/* Left: Company + Client */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />Company &amp; Client
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Company</Label>
                  <div className="relative">
                    <Building2 className="input-icon" />
                    <Select value={form.company_id} onValueChange={v => setForm({ ...form, company_id: v })}>
                      <SelectTrigger className="pl-8 h-9 text-sm"><SelectValue placeholder="Select company" /></SelectTrigger>
                      <SelectContent>
                        {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Client Name</Label>
                  <div className="relative">
                    <User className="input-icon" />
                    <Input className="pl-8 h-9 text-sm" placeholder="Full name" value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Contact</Label>
                  <div className="relative">
                    <Phone className="input-icon" />
                    <Input className="pl-8 h-9 text-sm" placeholder="Phone / Email" value={form.client_contact} onChange={e => setForm({ ...form, client_contact: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Address</Label>
                  <div className="relative">
                    <MapPin className="input-icon" />
                    <Input className="pl-8 h-9 text-sm" placeholder="City / Address" value={form.client_address} onChange={e => setForm({ ...form, client_address: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Right: Notes + VAT */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />Notes &amp; Options
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Notes / Terms</Label>
                  <Textarea
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    rows={6}
                    className="text-sm resize-none"
                    placeholder="Payment terms, delivery notes…"
                  />
                </div>
                {(selectedType === 'invoice' || selectedType === 'quotation') && (
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                      checked={form.is_vat}
                      onChange={e => setForm({ ...form, is_vat: e.target.checked })}
                    />
                    <span className="text-sm font-medium">Include VAT (13%)</span>
                  </label>
                )}
              </div>
            </div>

            {/* Line Items — invoice / quotation only */}
            {(selectedType === 'invoice' || selectedType === 'quotation') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Line Items</p>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addItem}>
                    <Plus className="w-3 h-3 mr-1" />Add Row
                  </Button>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-12 gap-2 px-1">
                    <span className="col-span-6 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Description</span>
                    <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Qty</span>
                    <span className="col-span-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Unit Price</span>
                  </div>
                  {form.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2">
                      <div className="col-span-6">
                        <Input className="h-8 text-sm" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder={`Item ${idx + 1}`} />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" className="h-8 text-sm" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)} placeholder="1" />
                      </div>
                      <div className="col-span-4 flex items-stretch">
                        <span className="inline-flex items-center px-2 bg-muted text-[10px] font-medium border border-r-0 border-input rounded-l-md text-muted-foreground select-none">NPR</span>
                        <Input type="number" className="rounded-l-none h-8 flex-1 text-sm" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} placeholder="0.00" />
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-border/50 pt-2 space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span><span className="font-mono font-medium">NPR {subtotal.toLocaleString()}</span>
                    </div>
                    {form.is_vat && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>VAT 13%</span><span className="font-mono font-medium">NPR {vat.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border/50">
                      <span>Total</span><span className="font-mono text-base">NPR {(subtotal + vat).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          <DialogFooter className="pt-3 mt-2 border-t border-border/50">
            <Button variant="outline" size="sm" onClick={() => setShowGenerator(false)}>Cancel</Button>
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 mr-1" />Print</Button>
            <Button size="sm">Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}