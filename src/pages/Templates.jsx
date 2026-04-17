import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { FileText, Receipt, Mail, Printer, Plus } from 'lucide-react';

const TEMPLATE_TYPES = [
  { type: 'invoice', label: 'Invoice', icon: Receipt, color: 'bg-blue-500', desc: 'Generate professional invoices for clients' },
  { type: 'quotation', label: 'Quotation', icon: FileText, color: 'bg-emerald-500', desc: 'Create detailed quotations and estimates' },
  { type: 'letterhead', label: 'Letter Head', icon: Mail, color: 'bg-violet-500', desc: 'Official company letterhead templates' },
  { type: 'form', label: 'Forms', icon: FileText, color: 'bg-amber-500', desc: 'Custom business forms and documents' },
];

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
    const data = await base44.entities.Company.list();
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Generate {selectedType?.charAt(0).toUpperCase() + selectedType?.slice(1)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Company Select */}
            <div>
              <Label>Company</Label>
              <select
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
                value={form.company_id}
                onChange={e => setForm({ ...form, company_id: e.target.value })}
              >
                <option value="">Select company</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Client Info */}
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Client Name</Label><Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} /></div>
              <div><Label>Contact</Label><Input value={form.client_contact} onChange={e => setForm({ ...form, client_contact: e.target.value })} /></div>
              <div><Label>Address</Label><Input value={form.client_address} onChange={e => setForm({ ...form, client_address: e.target.value })} /></div>
            </div>

            {/* Items */}
            {(selectedType === 'invoice' || selectedType === 'quotation') && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="font-semibold">Items</Label>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Add</Button>
                </div>
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 mb-2">
                    <div className="col-span-6"><Input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Description" /></div>
                    <div className="col-span-2"><Input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)} placeholder="Qty" /></div>
                    <div className="col-span-4"><Input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} placeholder="Price" /></div>
                  </div>
                ))}
                <div className="bg-secondary rounded-lg p-3 mt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">NPR {subtotal.toLocaleString()}</span></div>
                  {form.is_vat && <div className="flex justify-between"><span>VAT 13%</span><span className="font-mono">NPR {vat.toLocaleString()}</span></div>}
                  <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span className="font-mono">NPR {(subtotal + vat).toLocaleString()}</span></div>
                </div>
              </div>
            )}

            <div><Label>Notes / Terms</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerator(false)}>Cancel</Button>
            <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-1" />Print</Button>
            <Button>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}