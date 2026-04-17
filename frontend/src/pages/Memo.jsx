import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getActiveCompanyId } from '@/lib/companyContext';
import { adToBs } from '@/lib/nepaliDate';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { ExternalLink, Upload, ImageIcon, Loader2 } from 'lucide-react';

const CATEGORIES = [
  { value: 'quotation', label: 'Quotations' },
  { value: 'purchase_bill', label: 'Purchase Bills' },
  { value: 'sales_bill', label: 'Sales Bills' },
  { value: 'job_card', label: 'Job Cards' },
  { value: 'order_slip', label: 'Order Slips' },
  { value: 'extra_work', label: 'Extra Work / Pending' },
  { value: 'supporting_doc', label: 'Supporting Documents' },
];

const REMARKS = ['Quoted', 'Work-done', 'Cancelled', 'Revised', 'Billed'];

export default function Memo() {
  const companyId = getActiveCompanyId();
  const [documents, setDocuments] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('quotation');
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState({ client_name: '', reference_id: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: '', category: 'quotation', client_name: '', client_contact: '', client_address: '', description: '', status: 'Quoted', document_url: '', amount: '', date_ad: new Date().toISOString().split('T')[0]
  });
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, document_url: file_url }));
    setUploading(false);
  }

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);
    const [docs, quots] = await Promise.all([
      base44.entities.MemoDocument.filter({ company_id: companyId }),
      base44.entities.Quotation.filter({ company_id: companyId }),
    ]);
    setDocuments(docs);
    setQuotations(quots);
    setLoading(false);
  }

  async function addDocument() {
    if (!form.client_name.trim()) {
      alert('Client name is required');
      return;
    }
    try {
      const bsDate = adToBs(new Date(form.date_ad));
      await base44.entities.MemoDocument.create({
        category: form.category,
        client_name: form.client_name,
        client_contact: form.client_contact,
        client_address: form.client_address,
        description: form.description,
        document_url: form.document_url,
        reference_id: form.reference_id,
        amount: form.amount ? parseFloat(form.amount) : null,
        date_ad: form.date_ad,
        date_bs: bsDate.formatted,
        status: form.status || null,
        company_id: companyId,
      });
      setForm({ title: '', category: 'quotation', client_name: '', client_contact: '', client_address: '', description: '', status: 'Quoted', document_url: '', amount: '', date_ad: new Date().toISOString().split('T')[0] });
      setShowAdd(false);
      await loadData();
    } catch (error) {
      console.error('Error creating document:', error);
      alert('Error saving document: ' + error.message);
    }
  }

  async function uploadDocument(file) {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  }

  const remarkColors = {
    Quoted: 'bg-blue-100 text-blue-700',
    'Work-done': 'bg-green-100 text-green-700',
    Cancelled: 'bg-red-100 text-red-700',
    Revised: 'bg-amber-100 text-amber-700',
    Billed: 'bg-purple-100 text-purple-700',
  };

  const filteredDocs = documents.filter(d => {
    if (d.category !== activeTab) return false;
    const matchesSearch = d.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.description?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (colFilters.client_name && !d.client_name?.toLowerCase().includes(colFilters.client_name.toLowerCase())) return false;
    if (colFilters.reference_id && !(d.reference_id || '').toLowerCase().includes(colFilters.reference_id.toLowerCase())) return false;
    if (colFilters.status && !(d.status || '').toLowerCase().includes(colFilters.status.toLowerCase())) return false;
    return true;
  });

  const filteredQuotations = filteredDocs; // quotation tab uses MemoDocument with category='quotation'

  async function updateRemark(id, remark) {
    await base44.entities.MemoDocument.update(id, { status: remark });
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: remark } : d));
  }

  const quotationColumns = [
    { key: 'date_ad', label: 'Date', render: (row) => (
      <div className="text-xs"><div>{row.date_ad}</div><div className="text-muted-foreground">{row.date_bs}</div></div>
    )},
    { key: 'reference_id', label: 'Reference #', filterValue: colFilters.reference_id, onFilterChange: v => setCol('reference_id', v), render: (row) => <span className="text-sm font-mono">{row.reference_id || '-'}</span> },
    { key: 'client_name', label: 'Client', filterValue: colFilters.client_name, onFilterChange: v => setCol('client_name', v), render: (row) => <span className="font-medium">{row.client_name}</span> },
    { key: 'client_contact', label: 'Contact' },
    { key: 'amount', label: 'Amount', render: (row) => <span className="font-mono">{row.amount ? `NPR ${(row.amount).toLocaleString()}` : '-'}</span> },
    { key: 'status', label: 'Remark', filterValue: colFilters.status, onFilterChange: v => setCol('status', v), filterPlaceholder: 'e.g. Quoted', render: (row) => (
      <select
        value={row.status || ''}
        onChange={e => { e.stopPropagation(); updateRemark(row.id, e.target.value); }}
        onClick={e => e.stopPropagation()}
        className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer outline-none ${remarkColors[row.status] || 'bg-gray-100 text-gray-600'}`}
      >
        <option value="">— select —</option>
        {REMARKS.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
    )},
    { key: 'document_url', label: 'Doc', render: (row) => row.document_url ? (
      <a href={row.document_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />View</a>
    ) : '-' },
  ];

  const docColumns = [
    { key: 'date_ad', label: 'Date', render: (row) => (
      <div className="text-xs"><div>{row.date_ad}</div><div className="text-muted-foreground">{row.date_bs}</div></div>
    )},
    { key: 'reference_id', label: 'Reference #', filterValue: colFilters.reference_id, onFilterChange: v => setCol('reference_id', v), render: (row) => <span className="text-sm font-mono">{row.reference_id || '-'}</span> },
    { key: 'client_name', label: 'Client', filterValue: colFilters.client_name, onFilterChange: v => setCol('client_name', v) },
    { key: 'description', label: 'Description', render: (row) => <span className="text-sm truncate max-w-[200px] block">{row.description}</span> },
    { key: 'amount', label: 'Amount', render: (row) => <span className="font-mono">{row.amount ? `NPR ${(row.amount).toLocaleString()}` : '-'}</span> },
    { key: 'document_url', label: 'Document', render: (row) => row.document_url ? (
      <a href={row.document_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />View</a>
    ) : '-' },
  ];

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Memo" subtitle="Document records and scanned files" searchValue={search} onSearchChange={setSearch} onAdd={() => setShowAdd(true)} addLabel="Add Document" onDelete={() => { if (!selectedDoc) { alert('Please select a document to delete'); return; } setShowDeleteDialog(true); }} deleteLabel="Delete Selected" />

      {activeTab === 'quotation' && (
      <div className="grid grid-cols-5 gap-3">
        {REMARKS.map(remark => (
          <div key={remark} className="bg-card rounded-xl border p-3 text-center">
            <p className="text-xl font-bold">{documents.filter(q => q.category === 'quotation' && q.status === remark).length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{remark}</p>
          </div>
        ))}
      </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          {CATEGORIES.map(c => (
            <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={activeTab} className="mt-4">
          {activeTab === 'quotation' ? (
            <DataTable columns={quotationColumns} data={filteredQuotations} emptyMessage="No quotations yet" />
          ) : (
            <DataTable columns={docColumns} data={filteredDocs} emptyMessage={`No ${CATEGORIES.find(c => c.value === activeTab)?.label || 'documents'} yet`} onRowClick={setSelectedDoc} />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Document?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{selectedDoc?.client_name}</strong>? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              await base44.entities.MemoDocument.delete(selectedDoc.id);
              setSelectedDoc(null);
              setShowDeleteDialog(false);
              await loadData();
            }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Add Document Record</DialogTitle></DialogHeader>
          <div className="overflow-y-auto flex-1 pr-1 space-y-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.date_ad} onChange={e => setForm({ ...form, date_ad: e.target.value })} />
              {form.date_ad && (
                <p className="text-xs text-muted-foreground mt-1">BS: {adToBs(new Date(form.date_ad)).formatted}</p>
              )}
            </div>
            <div>
              <Label>Reference Number</Label>
              <Input placeholder="e.g., REF-001" value={form.reference_id || ''} onChange={e => setForm({ ...form, reference_id: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Client Details</Label>
              <Input placeholder="Client Name" value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} />
              <Input placeholder="Contact / Phone" value={form.client_contact} onChange={e => setForm({ ...form, client_contact: e.target.value })} />
              <Input placeholder="Address" value={form.client_address} onChange={e => setForm({ ...form, client_address: e.target.value })} />
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div><Label>Amount</Label><Input type="number" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
            <div>
              <Label>Attach File / Image</Label>
              <div className="flex items-center gap-2 mt-1">
                <label className="flex items-center gap-2 cursor-pointer border border-input rounded-md px-3 py-2 text-sm hover:bg-secondary transition-colors">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  {uploading ? 'Uploading...' : 'Choose File'}
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
                {form.document_url && (
                  <a href={form.document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />View
                  </a>
                )}
              </div>
            </div>
            {form.category === 'quotation' && (
              <div>
                <Label>Remark</Label>
                <Select value={form.status || ''} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue placeholder="Select remark..." /></SelectTrigger>
                  <SelectContent>
                    {REMARKS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addDocument}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}