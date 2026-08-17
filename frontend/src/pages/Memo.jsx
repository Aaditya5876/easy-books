import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/adapter';
import { getActiveCompanyId } from '@/lib/companyContext';
import { adToBs } from '@/lib/nepaliDate';
import { formatDate } from '@/lib/utils';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { ExternalLink, FileText, Calendar, Hash, User, Phone, Building2, Layers, Tag, Link2, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORY_CONFIG = {
  quotation: {
    label: 'Quotation',
    fields: ['client_name', 'client_contact', 'valid_until', 'status', 'amount'],
    statusOptions: ['Quoted', 'Work-done', 'Cancelled', 'Revised', 'Billed'],
  },
  purchase_bill: {
    label: 'Purchase Bill',
    fields: ['vendor_name', 'vendor_contact', 'bill_number', 'vendor_pan', 'amount', 'file'],
  },
  sales_bill: {
    label: 'Sales Bill',
    fields: ['client_name', 'client_contact', 'invoice_number', 'amount', 'file'],
  },
  job_card: {
    label: 'Job Card',
    fields: ['client_name', 'client_contact', 'assigned_to', 'start_date', 'end_date', 'description'],
  },
  order_slip: {
    label: 'Order Slip',
    fields: ['client_name', 'client_contact', 'delivery_date', 'description', 'amount'],
  },
  extra_work: {
    label: 'Extra Work / Pending',
    fields: ['client_name', 'client_contact', 'due_date', 'description', 'amount'],
  },
  supporting_doc: {
    label: 'Supporting Document',
    fields: ['doc_type', 'linked_reference', 'description', 'file'],
  },
};

const CATEGORIES = [
  { value: 'quotation',      label: 'Quotations',              labelKey: 'memo.categoryQuotations' },
  { value: 'purchase_bill',  label: 'Purchase Bills',          labelKey: 'memo.categoryPurchaseBills' },
  { value: 'sales_bill',     label: 'Sales Bills',             labelKey: 'memo.categorySalesBills' },
  { value: 'job_card',       label: 'Job Cards',                labelKey: 'memo.categoryJobCards' },
  { value: 'order_slip',     label: 'Order Slips',             labelKey: 'memo.categoryOrderSlips' },
  { value: 'extra_work',     label: 'Extra Work / Pending',     labelKey: 'memo.categoryExtraWork' },
  { value: 'supporting_doc', label: 'Supporting Documents',     labelKey: 'memo.categorySupportingDocuments' },
];

const REMARKS = ['Quoted', 'Work-done', 'Cancelled', 'Revised', 'Billed'];

// Translation keys for remark values (the underlying values stay in English since
// they are persisted as the `status` field; only the displayed label is translated)
const REMARK_LABEL_KEYS = {
  Quoted:      'memo.remarkQuoted',
  'Work-done': 'memo.remarkWorkDone',
  Cancelled:   'memo.remarkCancelled',
  Revised:     'memo.remarkRevised',
  Billed:      'memo.remarkBilled',
};

const today = new Date().toISOString().split('T')[0];

const EMPTY_FORM = {
  category: 'purchase_bill',
  date_ad: today,
  reference_id: '',
  // shared client fields
  client_name: '', client_contact: '', client_address: '',
  // vendor fields (purchase_bill)
  vendor_name: '', vendor_contact: '', vendor_pan: '',
  // bill/invoice numbers
  bill_number: '', invoice_number: '',
  // job card
  assigned_to: '', start_date: '', end_date: '',
  // order/extra work
  delivery_date: '', due_date: '',
  // supporting doc
  doc_type: '', linked_reference: '',
  // quotation
  valid_until: '', status: '',
  // common
  description: '', amount: '', document_url: '',
};

// ─── Remark colour map ────────────────────────────────────────────────────────
const remarkColors = {
  Quoted:      'bg-blue-100 text-blue-700',
  'Work-done': 'bg-green-100 text-green-700',
  Cancelled:   'bg-red-100 text-red-700',
  Revised:     'bg-amber-100 text-amber-700',
  Billed:      'bg-purple-100 text-purple-700',
};

// ─── Small helper: section divider label ─────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 mt-1">
      {children}
    </h4>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Memo() {
  const { t } = useTranslation();
  const companyId = getActiveCompanyId();
  const remarkLabel = (r) => t(REMARK_LABEL_KEYS[r] || '', { defaultValue: r });
  const categories = CATEGORIES.map(c => ({ ...c, label: t(c.labelKey, { defaultValue: c.label }) }));
  const [documents, setDocuments]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState('quotation');
  const [search, setSearch]               = useState('');
  const [colFilters, setColFilters]       = useState({ client_name: '', reference_id: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showAdd, setShowAdd]             = useState(false);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [selectedDoc, setSelectedDoc]     = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // keep form.category in sync when tab changes so Add opens on the right category
  useEffect(() => {
    setForm(f => ({ ...f, category: activeTab }));
  }, [activeTab]);

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);
    const docs = await api.Memo.filter({ company_id: companyId });
    setDocuments(docs);
    setLoading(false);
  }

  // ── Add document ────────────────────────────────────────────────────────────
  async function addDocument() {
    const cat = form.category;
    // Basic required-field guard
    if (cat === 'purchase_bill' && !form.vendor_name?.trim()) {
      alert(t('memo.vendorNameRequiredAlert', { defaultValue: 'Vendor name is required' }));
      return;
    }
    if (cat !== 'purchase_bill' && cat !== 'supporting_doc' && !form.client_name?.trim()) {
      alert(t('memo.clientNameRequiredAlert', { defaultValue: 'Client name is required' }));
      return;
    }

    try {
      const bsDate = adToBs(new Date(form.date_ad));

      // Build reference_id from the right sub-field
      let ref = form.reference_id || '';
      if (cat === 'purchase_bill') ref = form.bill_number || '';
      if (cat === 'sales_bill')    ref = form.invoice_number || '';

      await api.Memo.create({
        category:        cat,
        date_ad:         form.date_ad,
        date_bs:         bsDate.formatted,
        reference_id:    ref,
        // client
        client_name:     form.client_name,
        client_contact:  form.client_contact,
        client_address:  form.client_address,
        // vendor
        vendor_name:     form.vendor_name,
        vendor_contact:  form.vendor_contact,
        vendor_pan:      form.vendor_pan,
        // job card
        assigned_to:     form.assigned_to,
        start_date:      form.start_date || null,
        end_date:        form.end_date   || null,
        // dates
        delivery_date:   form.delivery_date || null,
        due_date:        form.due_date      || null,
        valid_until:     form.valid_until   || null,
        // supporting doc
        doc_type:        form.doc_type,
        linked_reference: form.linked_reference,
        // common
        description:     form.description,
        amount:          form.amount ? parseFloat(form.amount) : null,
        document_url:    form.document_url,
        status:          form.status || null,
        company_id:      companyId,
      });

      setForm({ ...EMPTY_FORM, category: cat, date_ad: today });
      setShowAdd(false);
      await loadData();
    } catch (error) {
      console.error('Error creating document:', error);
      alert(t('memo.errorSavingDocument', { defaultValue: 'Error saving document: ' }) + error.message);
    }
  }

  // ── Status update (quotation rows) ─────────────────────────────────────────
  async function updateRemark(id, remark) {
    await api.Memo.update(id, { status: remark });
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: remark } : d));
  }

  // ── Filtered rows ───────────────────────────────────────────────────────────
  const filteredDocs = documents.filter(d => {
    if (d.category !== activeTab) return false;
    const hay = `${d.client_name} ${d.vendor_name} ${d.description}`.toLowerCase();
    if (!hay.includes(search.toLowerCase())) return false;
    if (colFilters.client_name  && !(d.client_name || '').toLowerCase().includes(colFilters.client_name.toLowerCase())) return false;
    if (colFilters.reference_id && !(d.reference_id || '').toLowerCase().includes(colFilters.reference_id.toLowerCase())) return false;
    if (colFilters.status       && !(d.status || '').toLowerCase().includes(colFilters.status.toLowerCase())) return false;
    return true;
  });

  // ── Column definitions ──────────────────────────────────────────────────────
  const quotationColumns = [
    { key: 'date_ad', label: t('memo.colDate', { defaultValue: 'Date' }), render: (row) => (
      <div className="text-xs">
        <div>{formatDate(row.date_ad)}</div>
        <div className="text-muted-foreground">{row.date_bs}</div>
      </div>
    )},
    { key: 'reference_id', label: t('memo.colReferenceNo', { defaultValue: 'Reference #' }),
      filterValue: colFilters.reference_id, onFilterChange: v => setCol('reference_id', v),
      render: (row) => <span className="text-sm font-mono">{row.reference_id || '-'}</span> },
    { key: 'client_name', label: t('memo.colClient', { defaultValue: 'Client' }),
      filterValue: colFilters.client_name, onFilterChange: v => setCol('client_name', v),
      render: (row) => <span className="font-medium">{row.client_name}</span> },
    { key: 'client_contact', label: t('memo.colContact', { defaultValue: 'Contact' }) },
    { key: 'amount', label: t('memo.colAmount', { defaultValue: 'Amount' }),
      render: (row) => <span className="font-mono">{row.amount ? `NPR ${row.amount.toLocaleString()}` : '-'}</span> },
    { key: 'status', label: t('memo.colRemark', { defaultValue: 'Remark' }),
      filterValue: colFilters.status, onFilterChange: v => setCol('status', v),
      filterPlaceholder: t('memo.filterRemarkPlaceholder', { defaultValue: 'e.g. Quoted' }),
      render: (row) => (
        <select
          value={row.status || ''}
          onChange={e => { e.stopPropagation(); updateRemark(row.id, e.target.value); }}
          onClick={e => e.stopPropagation()}
          className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer outline-none ${remarkColors[row.status] || 'bg-gray-100 text-gray-600'}`}
        >
          <option value="">{t('memo.selectPlaceholderDash', { defaultValue: '— select —' })}</option>
          {REMARKS.map(r => <option key={r} value={r}>{remarkLabel(r)}</option>)}
        </select>
      )},
    { key: 'document_url', label: t('memo.colDoc', { defaultValue: 'Doc' }),
      render: (row) => row.document_url ? (
        <a href={row.document_url} target="_blank" rel="noopener noreferrer"
           className="text-primary hover:underline flex items-center gap-1">
          <ExternalLink className="w-3 h-3" />{t('memo.view', { defaultValue: 'View' })}
        </a>
      ) : '-' },
  ];

  const purchaseBillColumns = [
    { key: 'date_ad', label: t('memo.colDate', { defaultValue: 'Date' }), render: (row) => (
      <div className="text-xs"><div>{formatDate(row.date_ad)}</div><div className="text-muted-foreground">{row.date_bs}</div></div>
    )},
    { key: 'reference_id', label: t('memo.colBillNo', { defaultValue: 'Bill #' }),
      filterValue: colFilters.reference_id, onFilterChange: v => setCol('reference_id', v),
      render: (row) => <span className="text-sm font-mono">{row.reference_id || '-'}</span> },
    { key: 'vendor_name', label: t('memo.colVendor', { defaultValue: 'Vendor' }),
      filterValue: colFilters.client_name, onFilterChange: v => setCol('client_name', v),
      render: (row) => <span className="font-medium">{row.vendor_name || '-'}</span> },
    { key: 'vendor_contact', label: t('memo.colContact', { defaultValue: 'Contact' }),
      render: (row) => row.vendor_contact || '-' },
    { key: 'vendor_pan', label: t('memo.colPan', { defaultValue: 'PAN' }),
      render: (row) => <span className="font-mono">{row.vendor_pan || '-'}</span> },
    { key: 'amount', label: t('memo.colAmount', { defaultValue: 'Amount' }),
      render: (row) => <span className="font-mono">{row.amount ? `NPR ${row.amount.toLocaleString()}` : '-'}</span> },
    { key: 'document_url', label: t('memo.colDocument', { defaultValue: 'Document' }),
      render: (row) => row.document_url ? (
        <a href={row.document_url} target="_blank" rel="noopener noreferrer"
           className="text-primary hover:underline flex items-center gap-1">
          <ExternalLink className="w-3 h-3" />{t('memo.view', { defaultValue: 'View' })}
        </a>
      ) : '-' },
  ];

  const salesBillColumns = [
    { key: 'date_ad', label: t('memo.colDate', { defaultValue: 'Date' }), render: (row) => (
      <div className="text-xs"><div>{formatDate(row.date_ad)}</div><div className="text-muted-foreground">{row.date_bs}</div></div>
    )},
    { key: 'reference_id', label: t('memo.colInvoiceNo', { defaultValue: 'Invoice #' }),
      filterValue: colFilters.reference_id, onFilterChange: v => setCol('reference_id', v),
      render: (row) => <span className="text-sm font-mono">{row.reference_id || '-'}</span> },
    { key: 'client_name', label: t('memo.colClient', { defaultValue: 'Client' }),
      filterValue: colFilters.client_name, onFilterChange: v => setCol('client_name', v),
      render: (row) => <span className="font-medium">{row.client_name}</span> },
    { key: 'client_contact', label: t('memo.colContact', { defaultValue: 'Contact' }) },
    { key: 'amount', label: t('memo.colAmount', { defaultValue: 'Amount' }),
      render: (row) => <span className="font-mono">{row.amount ? `NPR ${row.amount.toLocaleString()}` : '-'}</span> },
    { key: 'document_url', label: t('memo.colDocument', { defaultValue: 'Document' }),
      render: (row) => row.document_url ? (
        <a href={row.document_url} target="_blank" rel="noopener noreferrer"
           className="text-primary hover:underline flex items-center gap-1">
          <ExternalLink className="w-3 h-3" />{t('memo.view', { defaultValue: 'View' })}
        </a>
      ) : '-' },
  ];

  const jobCardColumns = [
    { key: 'date_ad', label: t('memo.colDate', { defaultValue: 'Date' }), render: (row) => (
      <div className="text-xs"><div>{formatDate(row.date_ad)}</div><div className="text-muted-foreground">{row.date_bs}</div></div>
    )},
    { key: 'client_name', label: t('memo.colClient', { defaultValue: 'Client' }),
      filterValue: colFilters.client_name, onFilterChange: v => setCol('client_name', v),
      render: (row) => <span className="font-medium">{row.client_name}</span> },
    { key: 'client_contact', label: t('memo.colContact', { defaultValue: 'Contact' }) },
    { key: 'assigned_to', label: t('memo.assignedTo', { defaultValue: 'Assigned To' }),
      render: (row) => row.assigned_to || '-' },
    { key: 'start_date', label: t('memo.colStart', { defaultValue: 'Start' }), render: (row) => row.start_date ? formatDate(row.start_date) : '-' },
    { key: 'end_date',   label: t('memo.colEnd', { defaultValue: 'End' }),   render: (row) => row.end_date   ? formatDate(row.end_date)   : '-' },
    { key: 'description', label: t('memo.colDescription', { defaultValue: 'Description' }),
      render: (row) => <span className="text-sm truncate max-w-[200px] block">{row.description || '-'}</span> },
  ];

  const orderSlipColumns = [
    { key: 'date_ad', label: t('memo.colDate', { defaultValue: 'Date' }), render: (row) => (
      <div className="text-xs"><div>{formatDate(row.date_ad)}</div><div className="text-muted-foreground">{row.date_bs}</div></div>
    )},
    { key: 'client_name', label: t('memo.colClient', { defaultValue: 'Client' }),
      filterValue: colFilters.client_name, onFilterChange: v => setCol('client_name', v),
      render: (row) => <span className="font-medium">{row.client_name}</span> },
    { key: 'client_contact', label: t('memo.colContact', { defaultValue: 'Contact' }) },
    { key: 'delivery_date', label: t('memo.deliveryDate', { defaultValue: 'Delivery Date' }), render: (row) => row.delivery_date ? formatDate(row.delivery_date) : '-' },
    { key: 'description', label: t('memo.colDescription', { defaultValue: 'Description' }),
      render: (row) => <span className="text-sm truncate max-w-[200px] block">{row.description || '-'}</span> },
    { key: 'amount', label: t('memo.colAmount', { defaultValue: 'Amount' }),
      render: (row) => <span className="font-mono">{row.amount ? `NPR ${row.amount.toLocaleString()}` : '-'}</span> },
  ];

  const extraWorkColumns = [
    { key: 'date_ad', label: t('memo.colDate', { defaultValue: 'Date' }), render: (row) => (
      <div className="text-xs"><div>{formatDate(row.date_ad)}</div><div className="text-muted-foreground">{row.date_bs}</div></div>
    )},
    { key: 'client_name', label: t('memo.colClient', { defaultValue: 'Client' }),
      filterValue: colFilters.client_name, onFilterChange: v => setCol('client_name', v),
      render: (row) => <span className="font-medium">{row.client_name}</span> },
    { key: 'client_contact', label: t('memo.colContact', { defaultValue: 'Contact' }) },
    { key: 'due_date', label: t('memo.dueDate', { defaultValue: 'Due Date' }), render: (row) => row.due_date ? formatDate(row.due_date) : '-' },
    { key: 'description', label: t('memo.colDescription', { defaultValue: 'Description' }),
      render: (row) => <span className="text-sm truncate max-w-[200px] block">{row.description || '-'}</span> },
    { key: 'amount', label: t('memo.colAmount', { defaultValue: 'Amount' }),
      render: (row) => <span className="font-mono">{row.amount ? `NPR ${row.amount.toLocaleString()}` : '-'}</span> },
  ];

  const supportingDocColumns = [
    { key: 'date_ad', label: t('memo.colDate', { defaultValue: 'Date' }), render: (row) => (
      <div className="text-xs"><div>{formatDate(row.date_ad)}</div><div className="text-muted-foreground">{row.date_bs}</div></div>
    )},
    { key: 'doc_type', label: t('memo.colType', { defaultValue: 'Type' }),
      render: (row) => row.doc_type ? <span className="capitalize">{row.doc_type}</span> : '-' },
    { key: 'linked_reference', label: t('memo.colLinkedRef', { defaultValue: 'Linked Ref' }),
      render: (row) => <span className="font-mono">{row.linked_reference || '-'}</span> },
    { key: 'description', label: t('memo.colDescription', { defaultValue: 'Description' }),
      render: (row) => <span className="text-sm truncate max-w-[200px] block">{row.description || '-'}</span> },
    { key: 'document_url', label: t('memo.colFile', { defaultValue: 'File' }),
      render: (row) => row.document_url ? (
        <a href={row.document_url} target="_blank" rel="noopener noreferrer"
           className="text-primary hover:underline flex items-center gap-1">
          <ExternalLink className="w-3 h-3" />{t('memo.view', { defaultValue: 'View' })}
        </a>
      ) : '-' },
  ];

  const columnsByTab = {
    quotation:      quotationColumns,
    purchase_bill:  purchaseBillColumns,
    sales_bill:     salesBillColumns,
    job_card:       jobCardColumns,
    order_slip:     orderSlipColumns,
    extra_work:     extraWorkColumns,
    supporting_doc: supportingDocColumns,
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const f = (key, placeholder, type = 'text', Icon = null) => {
    const input = (
      <Input
        type={type}
        placeholder={placeholder}
        value={form[key]}
        className={`h-9 text-sm${Icon ? ' pl-8' : ''}`}
        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
      />
    );
    if (!Icon) return input;
    return (
      <div className="relative">
        <Icon className="input-icon" />
        {input}
      </div>
    );
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('memo.title', { defaultValue: 'Memo' })}
        subtitle={t('memo.subtitle', { defaultValue: 'Document records and scanned files' })}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setShowAdd(true)}
        addLabel={t('memo.addDocument', { defaultValue: 'Add Document' })}
        onDelete={() => {
          if (!selectedDoc) { alert(t('memo.selectDocumentToDelete', { defaultValue: 'Please select a document to delete' })); return; }
          setShowDeleteDialog(true);
        }}
        deleteLabel={t('memo.deleteSelected', { defaultValue: 'Delete Selected' })}
      />

      {/* Quotation summary tiles */}
      {activeTab === 'quotation' && (
        <div className="grid grid-cols-5 gap-3">
          {REMARKS.map(remark => (
            <div key={remark} className="bg-card rounded-xl border p-3 text-center">
              <p className="text-xl font-bold">
                {documents.filter(q => q.category === 'quotation' && q.status === remark).length}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{remarkLabel(remark)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab navigation */}
      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setColFilters({ client_name: '', reference_id: '', status: '' }); }}>
        <TabsList className="flex-wrap">
          {categories.map(c => (
            <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={activeTab} className="mt-4">
          {filteredDocs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t('memo.noDocumentsYet', { defaultValue: 'No documents yet' })}
              description={t('memo.addFirstDocumentDescription', { defaultValue: 'Add your first document record for this category.' })}
              action={
                <Button onClick={() => setShowAdd(true)}>
                  <Plus className="w-4 h-4 mr-2" />{t('memo.addFirstRecord', { defaultValue: 'Add First Record' })}
                </Button>
              }
            />
          ) : (
            <DataTable
              columns={columnsByTab[activeTab]}
              data={filteredDocs}
              emptyMessage={t('memo.noCategoryYet', {
                category: categories.find(c => c.value === activeTab)?.label || t('memo.documents', { defaultValue: 'documents' }),
                defaultValue: 'No {{category}} yet',
              })}
              onRowClick={setSelectedDoc}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* ── Delete dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('memo.deleteDocumentTitle', { defaultValue: 'Delete Document?' })}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('memo.deleteConfirmPrefix', { defaultValue: 'Are you sure you want to delete' })}{' '}
            <strong>{selectedDoc?.client_name || selectedDoc?.vendor_name || t('memo.thisDocument', { defaultValue: 'this document' })}</strong>?{' '}
            {t('memo.actionCannotBeUndone', { defaultValue: 'This action cannot be undone.' })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>{t('memo.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button variant="destructive" onClick={async () => {
              await api.Memo.delete(selectedDoc.id);
              setSelectedDoc(null);
              setShowDeleteDialog(false);
              await loadData();
            }}>{t('memo.delete', { defaultValue: 'Delete' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Document dialog ────────────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={open => {
        setShowAdd(open);
        if (!open) setForm({ ...EMPTY_FORM, category: activeTab, date_ad: today });
      }}>
        <DialogContent className="glass-dialog max-w-3xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-400 to-fuchsia-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader className="mb-1">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <FileText className="w-4 h-4 text-violet-500" />
              {t('memo.addDocumentRecord', { defaultValue: 'Add Document Record' })}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 max-h-[65vh] overflow-hidden mt-2">
            {/* ── Left column: Document Info ── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="space-y-3 overflow-y-auto pr-1"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />{t('memo.documentInfo', { defaultValue: 'Document Info' })}
              </p>

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('memo.category', { defaultValue: 'Category' })}</Label>
                <div className="relative">
                  <Layers className="input-icon" />
                  <Select value={form.category} onValueChange={v => setForm(prev => ({ ...prev, category: v }))}>
                    <SelectTrigger className="pl-8 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('memo.dateRequired', { defaultValue: 'Date *' })}</Label>
                <div className="relative">
                  <Calendar className="input-icon" />
                  <Input
                    type="date"
                    className="pl-8 h-9 text-sm"
                    value={form.date_ad}
                    onChange={e => setForm(prev => ({ ...prev, date_ad: e.target.value }))}
                  />
                </div>
                {form.date_ad && (
                  <p className="text-xs text-muted-foreground">{t('memo.bsDatePrefix', { defaultValue: 'BS:' })} {adToBs(new Date(form.date_ad)).formatted}</p>
                )}
              </div>

              {/* Reference number */}
              {['purchase_bill', 'sales_bill', 'quotation'].includes(form.category) && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {form.category === 'purchase_bill' ? t('memo.billNumber', { defaultValue: 'Bill Number' }) : form.category === 'sales_bill' ? t('memo.invoiceNumber', { defaultValue: 'Invoice Number' }) : t('memo.referenceNo', { defaultValue: 'Reference No.' })}
                  </Label>
                  {f(
                    form.category === 'purchase_bill' ? 'bill_number' : form.category === 'sales_bill' ? 'invoice_number' : 'reference_id',
                    form.category === 'purchase_bill' ? t('memo.billNumberPlaceholder', { defaultValue: 'e.g. BILL-001' }) : form.category === 'sales_bill' ? t('memo.invoiceNumberPlaceholder', { defaultValue: 'e.g. INV-001' }) : t('memo.referenceNoPlaceholder', { defaultValue: 'e.g. QT-001' }),
                    'text', Hash
                  )}
                </div>
              )}

              {/* Amount with NPR prefix */}
              {!['job_card', 'supporting_doc'].includes(form.category) && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('memo.amount', { defaultValue: 'Amount' })}</Label>
                  <div className="flex items-stretch">
                    <span className="inline-flex items-center px-3 bg-muted text-xs font-medium border border-r-0 border-input rounded-l-md text-muted-foreground select-none">
                      NPR
                    </span>
                    <Input
                      type="number"
                      placeholder="0.00"
                      className="rounded-l-none h-9 flex-1 text-sm"
                      value={form.amount}
                      onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </motion.div>

            {/* ── Right column: Party / Vendor / Document Details ── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.06 }}
              className="space-y-3 overflow-y-auto pr-1"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                {form.category === 'purchase_bill' ? (
                  <><Building2 className="w-3.5 h-3.5" />{t('memo.vendorDetails', { defaultValue: 'Vendor Details' })}</>
                ) : form.category === 'supporting_doc' ? (
                  <><Link2 className="w-3.5 h-3.5" />{t('memo.documentDetails', { defaultValue: 'Document Details' })}</>
                ) : (
                  <><User className="w-3.5 h-3.5" />{t('memo.partyDetails', { defaultValue: 'Party Details' })}</>
                )}
              </p>

              {/* Vendor fields (purchase_bill) */}
              {form.category === 'purchase_bill' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t('memo.vendorNameRequired', { defaultValue: 'Vendor Name *' })}</Label>
                    {f('vendor_name', t('memo.vendorSupplierNamePlaceholder', { defaultValue: 'Vendor / Supplier name' }), 'text', Building2)}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t('memo.vendorContact', { defaultValue: 'Vendor Contact' })}</Label>
                    {f('vendor_contact', t('memo.phoneEmailPlaceholder', { defaultValue: 'Phone / Email' }), 'text', Phone)}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t('memo.vendorPan', { defaultValue: 'Vendor PAN' })}</Label>
                    {f('vendor_pan', t('memo.panNumberPlaceholder', { defaultValue: 'PAN number' }), 'text', Hash)}
                  </div>
                </>
              )}

              {/* Client fields */}
              {['quotation', 'sales_bill', 'job_card', 'order_slip', 'extra_work'].includes(form.category) && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t('memo.clientNameRequired', { defaultValue: 'Client Name *' })}</Label>
                    {f('client_name', t('memo.fullNamePlaceholder', { defaultValue: 'Full name' }), 'text', User)}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t('memo.contact', { defaultValue: 'Contact' })}</Label>
                    {f('client_contact', t('memo.phoneEmailPlaceholder', { defaultValue: 'Phone / Email' }), 'text', Phone)}
                  </div>
                </>
              )}

              {/* Job card extra fields */}
              {form.category === 'job_card' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t('memo.assignedTo', { defaultValue: 'Assigned To' })}</Label>
                    {f('assigned_to', t('memo.teamMemberNamePlaceholder', { defaultValue: 'Team member name' }), 'text', User)}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">{t('memo.startDate', { defaultValue: 'Start Date' })}</Label>
                      {f('start_date', '', 'date', Calendar)}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">{t('memo.endDate', { defaultValue: 'End Date' })}</Label>
                      {f('end_date', '', 'date', Calendar)}
                    </div>
                  </div>
                </>
              )}

              {/* Order slip: delivery date */}
              {form.category === 'order_slip' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('memo.deliveryDate', { defaultValue: 'Delivery Date' })}</Label>
                  {f('delivery_date', '', 'date', Calendar)}
                </div>
              )}

              {/* Extra work: due date */}
              {form.category === 'extra_work' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('memo.dueDate', { defaultValue: 'Due Date' })}</Label>
                  {f('due_date', '', 'date', Calendar)}
                </div>
              )}

              {/* Quotation: valid until + status */}
              {form.category === 'quotation' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t('memo.validUntil', { defaultValue: 'Valid Until' })}</Label>
                    {f('valid_until', '', 'date', Calendar)}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t('memo.status', { defaultValue: 'Status' })}</Label>
                    <Select value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v }))}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t('memo.selectStatusPlaceholder', { defaultValue: 'Select status…' })} /></SelectTrigger>
                      <SelectContent>
                        {CATEGORY_CONFIG.quotation.statusOptions.map(s => (
                          <SelectItem key={s} value={s}>{remarkLabel(s)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Supporting doc fields */}
              {form.category === 'supporting_doc' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t('memo.documentType', { defaultValue: 'Document Type' })}</Label>
                    <div className="relative">
                      <Tag className="input-icon" />
                      <Select value={form.doc_type} onValueChange={v => setForm(prev => ({ ...prev, doc_type: v }))}>
                        <SelectTrigger className="pl-8 h-9 text-sm"><SelectValue placeholder={t('memo.selectTypePlaceholder', { defaultValue: 'Select type' })} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contract">{t('memo.docTypeContract', { defaultValue: 'Contract' })}</SelectItem>
                          <SelectItem value="receipt">{t('memo.docTypeReceipt', { defaultValue: 'Receipt' })}</SelectItem>
                          <SelectItem value="certificate">{t('memo.docTypeCertificate', { defaultValue: 'Certificate' })}</SelectItem>
                          <SelectItem value="other">{t('memo.docTypeOther', { defaultValue: 'Other' })}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t('memo.linkedReference', { defaultValue: 'Linked Reference' })}</Label>
                    {f('linked_reference', t('memo.linkedReferencePlaceholder', { defaultValue: 'e.g. INV-001 or BILL-005' }), 'text', Link2)}
                  </div>
                </>
              )}

              {/* Description (non purchase_bill / sales_bill) */}
              {!['purchase_bill', 'sales_bill'].includes(form.category) && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    {t('memo.description', { defaultValue: 'Description' })}
                  </Label>
                  <Textarea
                    value={form.description}
                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="text-sm resize-none"
                    placeholder={t('memo.shortNotesPlaceholder', { defaultValue: 'Short notes…' })}
                  />
                </div>
              )}

              {/* File upload */}
              {['purchase_bill', 'sales_bill', 'supporting_doc'].includes(form.category) && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {t('memo.attachFile', { defaultValue: 'Attach File' })} <span className="text-muted-foreground font-normal">{t('memo.optional', { defaultValue: '(optional)' })}</span>
                  </Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    className="h-9 text-sm"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) setForm(prev => ({ ...prev, document_url: URL.createObjectURL(file) }));
                    }}
                  />
                  {form.document_url && (
                    <a href={form.document_url} target="_blank" rel="noopener noreferrer"
                       className="text-xs text-primary underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />{t('memo.viewAttachedFile', { defaultValue: 'View attached file' })}
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          </div>

          <DialogFooter className="pt-3 mt-2 border-t border-border/50">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>{t('memo.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button size="sm" onClick={addDocument}>{t('memo.saveDocument', { defaultValue: 'Save Document' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
