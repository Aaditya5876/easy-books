import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { api, apiAuth } from '@/api/adapter';
import { inventoryApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { adToBs } from '@/lib/nepaliDate';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SmartNumberInput } from "@/components/ui/smart-number-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  AlertTriangle, Package, ImagePlus, X, Trash2, Tag, ArrowUpDown, History,
  FileText, Award, Hash, Layers, Truck, MapPin, Calendar, Clock, MessageSquare, Upload
} from 'lucide-react';
import BulkImportDialog from '../components/shared/BulkImportDialog';
import { INVENTORY_FIELDS } from '../components/shared/bulkImportFields';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import { useRole } from "@/lib/useRole";

const UNITS = ['Piece', 'Set', 'Liter', 'ml', 'Kg', 'gm', 'NOS'];

// Which optional field groups to show per business type
const FIELDS = {
  RETAIL:       { brand: false, modelNo: false, application: false, expiry: false, aging: false, location: true },
  PHARMACY:     { brand: true,  modelNo: false, application: true,  expiry: true,  aging: false, location: true },
  ELECTRONICS:  { brand: true,  modelNo: true,  application: false, expiry: false, aging: true,  location: true },
  FOOD_BEVERAGE:{ brand: false, modelNo: false, application: false, expiry: true,  aging: false, location: false },
  SERVICES:     { brand: false, modelNo: false, application: false, expiry: false, aging: false, location: false },
  MANUFACTURING:{ brand: true,  modelNo: true,  application: true,  expiry: false, aging: true,  location: true },
  SCHOOL:       { brand: false, modelNo: false, application: false, expiry: false, aging: false, location: true },
  OTHER:        { brand: true,  modelNo: true,  application: true,  expiry: true,  aging: true,  location: true },
};

const BUSINESS_LABELS = {
  brand: 'Brand',
  modelNo: 'Model / Part Number',
  application: 'Usage / Purpose',
  expiry: 'Expiry Information',
  aging: 'Aging Alert (Days)',
  location: 'Stock Location',
};

function getFields(businessType) {
  return FIELDS[businessType?.toUpperCase()] ?? FIELDS.OTHER;
}

function getBusinessTypeLabel(t, businessType) {
  const labels = {
    RETAIL: t('inventory.businessTypeRetail', { defaultValue: 'Retail' }),
    PHARMACY: t('inventory.businessTypePharmacy', { defaultValue: 'Pharmacy' }),
    ELECTRONICS: t('inventory.businessTypeElectronics', { defaultValue: 'Electronics' }),
    FOOD_BEVERAGE: t('inventory.businessTypeFoodBeverage', { defaultValue: 'Tea Shop / Bakery' }),
    SERVICES: t('inventory.businessTypeServices', { defaultValue: 'Services' }),
    MANUFACTURING: t('inventory.businessTypeManufacturing', { defaultValue: 'Manufacturing' }),
    SCHOOL: t('inventory.businessTypeSchool', { defaultValue: 'School Supplies' }),
    OTHER: t('inventory.businessTypeOther', { defaultValue: 'Other' }),
  };
  return labels[businessType] || businessType;
}

function getPlaceholders(t, businessType) {
  switch (businessType?.toUpperCase()) {
    case 'RETAIL':
      return {
        item_name: t('inventory.placeholderRetailItemName', { defaultValue: 'e.g. Sugar, Salt, Soap' }),
        description: t('inventory.placeholderRetailDescription', { defaultValue: 'Additional details' }),
        brand: t('inventory.placeholderRetailBrand', { defaultValue: 'e.g. Sunkoshi, Dabur' }),
        application: t('inventory.placeholderRetailApplication', { defaultValue: 'e.g. Daily use' }),
        supplier_name: t('inventory.placeholderRetailSupplierName', { defaultValue: 'e.g. Sunrise Traders' }),
      };
    case 'PHARMACY':
      return {
        item_name: t('inventory.placeholderPharmacyItemName', { defaultValue: 'e.g. Paracetamol 500mg, Amoxicillin' }),
        description: t('inventory.placeholderPharmacyDescription', { defaultValue: 'Dosage form, strength' }),
        brand: t('inventory.placeholderPharmacyBrand', { defaultValue: 'e.g. Cipla, Sun Pharma' }),
        application: t('inventory.placeholderPharmacyApplication', { defaultValue: 'e.g. Pain relief, Antibiotic' }),
        supplier_name: t('inventory.placeholderPharmacySupplierName', { defaultValue: 'e.g. Mediline Pharma' }),
      };
    case 'ELECTRONICS':
      return {
        item_name: t('inventory.placeholderElectronicsItemName', { defaultValue: 'e.g. USB Cable, Power Bank' }),
        description: t('inventory.placeholderElectronicsDescription', { defaultValue: 'Specifications' }),
        brand: t('inventory.placeholderElectronicsBrand', { defaultValue: 'e.g. Samsung, Xiaomi' }),
        model_no: t('inventory.placeholderElectronicsModelNo', { defaultValue: 'e.g. USB-C-3.0-BLK' }),
        application: t('inventory.placeholderElectronicsApplication', { defaultValue: 'e.g. Charging, Display' }),
        supplier_name: t('inventory.placeholderElectronicsSupplierName', { defaultValue: 'e.g. Digital World' }),
      };
    case 'FOOD_BEVERAGE':
      return {
        item_name: t('inventory.placeholderFoodBeverageItemName', { defaultValue: 'e.g. Masala Tea, Milk Tea, Coffee' }),
        description: t('inventory.placeholderFoodBeverageDescription', { defaultValue: 'e.g. Served hot, 250ml' }),
        brand: '', model_no: '', application: '',
        supplier_name: t('inventory.placeholderFoodBeverageSupplierName', { defaultValue: 'e.g. Nepal Tea Estate' }),
      };
    case 'SERVICES':
      return {
        item_name: t('inventory.placeholderServicesItemName', { defaultValue: 'e.g. Consultation, Design Package' }),
        description: t('inventory.placeholderServicesDescription', { defaultValue: 'Scope of service' }),
        brand: '', model_no: '',
        application: t('inventory.placeholderServicesApplication', { defaultValue: 'e.g. IT Support, Accounting' }),
        supplier_name: t('inventory.placeholderServicesSupplierName', { defaultValue: 'e.g. TechVision Pvt. Ltd.' }),
      };
    case 'MANUFACTURING':
      return {
        item_name: t('inventory.placeholderManufacturingItemName', { defaultValue: 'e.g. Raw Steel, Cotton Yarn' }),
        description: t('inventory.placeholderManufacturingDescription', { defaultValue: 'Grade or specification' }),
        brand: t('inventory.placeholderManufacturingBrand', { defaultValue: 'e.g. SAIL, Birla' }),
        model_no: t('inventory.placeholderManufacturingModelNo', { defaultValue: 'e.g. IS:2062 Grade A' }),
        application: t('inventory.placeholderManufacturingApplication', { defaultValue: 'e.g. Structural frames, Weaving' }),
        supplier_name: t('inventory.placeholderManufacturingSupplierName', { defaultValue: 'e.g. Industrial Supply Co.' }),
      };
    case 'SCHOOL':
      return {
        item_name: t('inventory.placeholderSchoolItemName', { defaultValue: 'e.g. School Bag, PE Uniform, Notebook Set' }),
        description: t('inventory.placeholderSchoolDescription', { defaultValue: 'e.g. Size, color, class' }),
        brand: '', model_no: '', application: '',
        supplier_name: t('inventory.placeholderSchoolSupplierName', { defaultValue: 'e.g. Local Uniform Supplier' }),
      };
    default:
      return {
        item_name: t('inventory.placeholderOtherItemName', { defaultValue: 'e.g. Item name' }),
        description: t('inventory.placeholderOtherDescription', { defaultValue: 'Additional details or notes' }),
        brand: t('inventory.placeholderOtherBrand', { defaultValue: 'e.g. Brand name' }),
        model_no: t('inventory.placeholderOtherModelNo', { defaultValue: 'e.g. Model or part number' }),
        application: t('inventory.placeholderOtherApplication', { defaultValue: 'e.g. Usage or purpose' }),
        supplier_name: t('inventory.placeholderOtherSupplierName', { defaultValue: 'e.g. Supplier name' }),
      };
  }
}

const EMPTY_FORM = {
  item_name: '', brand: '', model_no: '', description: '', application: '',
  quantity: '', unit: 'Piece', unit_purchase_price: '', unit_selling_price: '',
  stock_location: '', low_stock_threshold: '5', aging_days: '90',
  supplier_name: '', image_url: '', expiry_date: '', expiry_alert_days: '',
};

export default function Inventory() {
  const { t } = useTranslation();
  const { canEdit, canDelete } = useRole();
  const companyId = getActiveCompanyId();
  const [items, setItems] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ brand: '', model_no: '', description: '', application: '', qty_min: '', price_min: '', stock_location: '', date_from: '' });
  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const hasFilters = Object.values(filters).some(v => v);
  const [showAdd, setShowAdd] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateForm, setUpdateForm] = useState({ unit_selling_price: 0, unit_purchase_price: 0, stock_location: '', image_url: '' });
  const [uploadingUpdateImage, setUploadingUpdateImage] = useState(false);
  const [showUpdatePasswordDialog, setShowUpdatePasswordDialog] = useState(false);
  const [updatePassword, setUpdatePassword] = useState('');
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjForm, setAdjForm] = useState({ type: 'ADDITION', quantity: '', reason: '' });
  const [adjSubmitting, setAdjSubmitting] = useState(false);
  const [showAdjLogDialog, setShowAdjLogDialog] = useState(false);
  const [adjLog, setAdjLog] = useState([]);
  const [showExtraFields, setShowExtraFields] = useState(false);

  const isOtherType = company?.business_type?.toUpperCase() === 'OTHER';
  const isSchoolType = company?.business_type?.toUpperCase() === 'SCHOOL';
  const f = isOtherType && !showExtraFields
    ? { brand: false, modelNo: false, application: false, expiry: false, aging: false, location: false }
    : getFields(company?.business_type);
  const p = getPlaceholders(t, company?.business_type);

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setForm(prev => ({ ...prev, image_url: URL.createObjectURL(file) }));
    setUploadingImage(false);
  }

  useEffect(() => {
    if (companyId) loadItems();
  }, [companyId]);

  async function loadItems() {
    setLoading(true);
    const [data, companies] = await Promise.all([
      api.InventoryItem.filter({ company_id: companyId }),
      api.Company.list(),
    ]);
    setItems(data);
    setCompany(companies.find(c => c.id === companyId) ?? null);
    setLoading(false);
  }

  const handleDeleteClick = () => {
    if (!selectedItem) return;
    setShowPasswordDialog(true);
  };

  const handlePasswordSubmit = async () => {
    try {
      await apiAuth.me();
      setShowPasswordDialog(false);
      setPassword('');
      setShowConfirmDialog(true);
    } catch {
      alert(t('inventory.invalidPasswordAlert', { defaultValue: 'Invalid password or authentication failed' }));
      setPassword('');
    }
  };

  const handleUpdateClick = () => {
    if (!selectedItem) { alert(t('inventory.selectRowFirstAlert', { defaultValue: 'Please select an item from the table first by clicking on a row.' })); return; }
    setUpdateForm({
      unit_selling_price: selectedItem.unit_selling_price || 0,
      unit_purchase_price: selectedItem.unit_purchase_price || 0,
      stock_location: selectedItem.stock_location || '',
      image_url: selectedItem.image_url || '',
    });
    setShowUpdatePasswordDialog(true);
  };

  const handleUpdatePasswordSubmit = async () => {
    try {
      await apiAuth.me();
      setShowUpdatePasswordDialog(false);
      setUpdatePassword('');
      setShowUpdateDialog(true);
    } catch {
      alert(t('inventory.invalidPasswordAlert', { defaultValue: 'Invalid password or authentication failed' }));
      setUpdatePassword('');
    }
  };

  async function handleUpdateImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingUpdateImage(true);
    setUpdateForm(prev => ({ ...prev, image_url: URL.createObjectURL(file) }));
    setUploadingUpdateImage(false);
  }

  async function handleUpdateSubmit() {
    if (!selectedItem) return;
    const payload = {};
    if (updateForm.unit_selling_price !== '') payload.unit_selling_price = updateForm.unit_selling_price;
    if (updateForm.unit_purchase_price !== '') payload.unit_purchase_price = updateForm.unit_purchase_price;
    if (updateForm.stock_location) payload.stock_location = updateForm.stock_location;
    if (updateForm.image_url) payload.image_url = updateForm.image_url;
    if (Object.keys(payload).length === 0) { alert(t('inventory.updateAtLeastOneFieldAlert', { defaultValue: 'Update at least one field before saving.' })); return; }
    await api.InventoryItem.update(selectedItem.id, payload);
    setShowUpdateDialog(false);
    setSelectedItem(null);
    loadItems();
  }

  const handleConfirmDelete = async () => {
    if (!selectedItem) return;
    await api.InventoryItem.delete(selectedItem.id);
    setSelectedItem(null);
    setShowConfirmDialog(false);
    loadItems();
  };

  async function handleAdjustClick() {
    if (!selectedItem) { alert(t('inventory.selectItemFirstAlert', { defaultValue: 'Please select an item from the table first.' })); return; }
    setAdjForm({ type: 'ADDITION', quantity: '', reason: '' });
    setShowAdjustDialog(true);
  }

  async function submitAdjustment() {
    if (!adjForm.quantity || !adjForm.reason.trim()) return;
    setAdjSubmitting(true);
    try {
      await inventoryApi.adjust(selectedItem.id, {
        adjustmentType: adjForm.type,
        quantityChange: parseFloat(adjForm.quantity),
        reason: adjForm.reason.trim(),
      });
      setShowAdjustDialog(false);
      setSelectedItem(null);
      loadItems();
    } catch (err) {
      alert(err?.response?.data?.message || t('inventory.adjustmentFailedAlert', { defaultValue: 'Adjustment failed' }));
    } finally {
      setAdjSubmitting(false);
    }
  }

  async function handleViewLog() {
    if (!selectedItem) { alert(t('inventory.selectItemFirstAlert', { defaultValue: 'Please select an item from the table first.' })); return; }
    try {
      const res = await inventoryApi.getAdjustments(selectedItem.id);
      const data = res?.data?.data ?? res?.data ?? [];
      setAdjLog(Array.isArray(data) ? data : []);
      setShowAdjLogDialog(true);
    } catch {
      setAdjLog([]);
      setShowAdjLogDialog(true);
    }
  }

  async function addItem() {
    const today = new Date().toISOString().split('T')[0];
    const bsDate = adToBs(new Date());
    await api.InventoryItem.create({
      ...form,
      company_id: companyId,
      date_of_purchase: today,
      date_of_purchase_bs: bsDate.formatted,
      quantity: form.quantity === '' ? 0 : parseFloat(form.quantity),
      unit_purchase_price: form.unit_purchase_price === '' ? 0 : parseFloat(form.unit_purchase_price),
      unit_selling_price: form.unit_selling_price === '' ? 0 : parseFloat(form.unit_selling_price),
      low_stock_threshold: form.low_stock_threshold === '' ? 5 : parseInt(form.low_stock_threshold),
      aging_days: form.aging_days === '' ? 90 : parseInt(form.aging_days),
      expiry_alert_days: form.expiry_alert_days === '' ? null : parseInt(form.expiry_alert_days),
    });
    setForm(EMPTY_FORM);
    setShowAdd(false);
    loadItems();
  }

  const filtered = items.filter(i =>
    (!filters.brand || i.brand?.toLowerCase().includes(filters.brand.toLowerCase())) &&
    (!filters.model_no || i.model_no?.toLowerCase().includes(filters.model_no.toLowerCase())) &&
    (!filters.description || i.description?.toLowerCase().includes(filters.description.toLowerCase())) &&
    (!filters.application || i.application?.toLowerCase().includes(filters.application.toLowerCase())) &&
    (!filters.qty_min || (i.quantity || 0) >= parseFloat(filters.qty_min)) &&
    (!filters.price_min || (i.unit_selling_price || 0) >= parseFloat(filters.price_min)) &&
    (!filters.stock_location || i.stock_location?.toLowerCase().includes(filters.stock_location.toLowerCase())) &&
    (!filters.date_from || (() => {
      if (!i.date_of_purchase) return false;
      const agingDays = Math.floor((new Date() - new Date(i.date_of_purchase)) / (1000 * 60 * 60 * 24));
      return agingDays >= parseFloat(filters.date_from);
    })())
  );

  const columns = [
    { key: 'item_name', label: t('inventory.colName', { defaultValue: 'Name' }), render: (row) => <span className="font-medium max-w-[200px] truncate block">{row.item_name || '—'}</span> },
    ...(f.brand ? [{ key: 'brand', label: t('inventory.colBrand', { defaultValue: 'Brand' }) }] : []),
    ...(f.modelNo ? [{ key: 'model_no', label: t('inventory.colModelNo', { defaultValue: 'Model No.' }) }] : []),
    { key: 'description', label: t('inventory.colDetails', { defaultValue: 'Details' }), render: (row) => <span className="max-w-[200px] truncate block text-sm">{row.description || '—'}</span> },
    ...(f.application ? [{ key: 'application', label: t('inventory.colUsage', { defaultValue: 'Usage' }) }] : []),
    { key: 'quantity', label: t('inventory.colQty', { defaultValue: 'Qty' }), render: (row) => {
      const isLow = (row.quantity || 0) <= (row.low_stock_threshold || 5);
      return (
        <div className="flex items-center gap-1.5">
          <span className={isLow ? 'text-red-600 font-semibold' : 'font-medium'}>{row.quantity || 0}</span>
          <span className="text-xs text-muted-foreground">{row.unit}</span>
          {isLow && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
        </div>
      );
    }},
    { key: 'unit_selling_price', label: t('inventory.colSellingPrice', { defaultValue: 'Selling Price' }), render: (row) => <span className="font-mono">NPR {(row.unit_selling_price || 0).toLocaleString()}</span> },
    ...(f.location ? [{ key: 'stock_location', label: t('inventory.colLocation', { defaultValue: 'Location' }) }] : []),
    ...(f.aging ? [{ key: 'aging_days', label: t('inventory.colAging', { defaultValue: 'Aging' }), render: (row) => {
      if (!row.date_of_purchase) return <span className="text-muted-foreground">-</span>;
      const days = Math.floor((new Date() - new Date(row.date_of_purchase)) / (1000 * 60 * 60 * 24));
      const isAged = days >= (row.aging_days || 90);
      return <span className={isAged ? 'text-red-600 font-semibold' : ''}>{days}d</span>;
    }}] : []),
  ];

  const lowStockCount = items.filter(i => (i.quantity || 0) <= (i.low_stock_threshold || 5)).length;

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={company?.business_type?.toUpperCase() === 'SCHOOL' ? t('inventory.titleSupplies', { defaultValue: 'Supplies' }) : t('inventory.titleInventory', { defaultValue: 'Inventory' })}
        subtitle={t('inventory.subtitle', { count: items.length, lowStock: lowStockCount, defaultValue: '{{count}} items · {{lowStock}} low stock alerts' })}
        onAdd={() => { setShowExtraFields(false); setShowAdd(true); }}
        addLabel={t('inventory.addStock', { defaultValue: 'Add Stock' })}
      >
        {canEdit && (
          <Button onClick={() => setImportOpen(true)} variant="outline" className="gap-2">
            <Upload className="w-4 h-4" />{t('inventory.import', { defaultValue: 'Import' })}
          </Button>
        )}
        {canEdit && (
          <Button onClick={handleAdjustClick} variant="outline" className="gap-2" disabled={!selectedItem}>
            <ArrowUpDown className="w-4 h-4" />{t('inventory.adjustStock', { defaultValue: 'Adjust Stock' })}
          </Button>
        )}
        <Button onClick={handleViewLog} variant="ghost" className="gap-2" disabled={!selectedItem}>
          <History className="w-4 h-4" />{t('inventory.log', { defaultValue: 'Log' })}
        </Button>
        {canEdit && (
          <Button onClick={handleUpdateClick} variant="outline" className="gap-2">
            <Tag className="w-4 h-4" />{t('inventory.update', { defaultValue: 'Update' })}
          </Button>
        )}
        {canDelete && (
          <Button onClick={handleDeleteClick} variant="destructive" className="gap-2" disabled={!selectedItem}>
            <Trash2 className="w-4 h-4" />{t('inventory.delete', { defaultValue: 'Delete' })}
          </Button>
        )}
      </PageHeader>

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="inventory"
        title={t('inventory.importDialogTitle', { defaultValue: 'Import Inventory Items' })}
        fields={INVENTORY_FIELDS}
        onDone={loadItems}
      />

      {lowStockCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">{t('inventory.lowStockBanner', { count: lowStockCount, defaultValue: '{{count}} item(s) are running low on stock' })}</p>
            <p className="text-xs text-red-600">{t('inventory.lowStockBannerHint', { defaultValue: 'Review your inventory and reorder as needed' })}</p>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState icon={Package} title={t('inventory.emptyTitle', { defaultValue: 'No inventory items yet' })} description={t('inventory.emptyDescription', { defaultValue: 'Add your first stock item to start tracking your inventory.' })} action={<Button onClick={() => { setShowExtraFields(false); setShowAdd(true); }}>{t('inventory.addStock', { defaultValue: 'Add Stock' })}</Button>} />
      ) : (
      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={setSelectedItem}
        selectedId={selectedItem?.id}
        filterRow={isSchoolType ? null : <>
          {f.brand && <td className="px-2 py-1"><Input placeholder={t('inventory.colBrand', { defaultValue: 'Brand' })} value={filters.brand} onChange={e => setFilter('brand', e.target.value)} className="h-7 text-xs w-full" /></td>}
          {f.modelNo && <td className="px-2 py-1"><Input placeholder={t('inventory.colModelNo', { defaultValue: 'Model No.' })} value={filters.model_no} onChange={e => setFilter('model_no', e.target.value)} className="h-7 text-xs w-full" /></td>}
          <td className="px-2 py-1"><Input placeholder={t('inventory.filterDescription', { defaultValue: 'Description' })} value={filters.description} onChange={e => setFilter('description', e.target.value)} className="h-7 text-xs w-full" /></td>
          {f.application && <td className="px-2 py-1"><Input placeholder={t('inventory.colUsage', { defaultValue: 'Usage' })} value={filters.application} onChange={e => setFilter('application', e.target.value)} className="h-7 text-xs w-full" /></td>}
          <td className="px-2 py-1"><SmartNumberInput placeholder={t('inventory.filterMinQty', { defaultValue: 'Min Qty' })} value={filters.qty_min} onChange={e => setFilter('qty_min', e.target.value)} className="h-7 text-xs w-full" /></td>
          <td className="px-2 py-1"><SmartNumberInput placeholder={t('inventory.filterMinPrice', { defaultValue: 'Min Price' })} value={filters.price_min} onChange={e => setFilter('price_min', e.target.value)} className="h-7 text-xs w-full" /></td>
          {f.location && <td className="px-2 py-1"><Input placeholder={t('inventory.colLocation', { defaultValue: 'Location' })} value={filters.stock_location} onChange={e => setFilter('stock_location', e.target.value)} className="h-7 text-xs w-full" /></td>}
          {f.aging && <td className="px-2 py-1"><div className="flex items-center gap-1">
            <SmartNumberInput placeholder={t('inventory.filterMinAgingDays', { defaultValue: 'Min aging days' })} value={filters.date_from} onChange={e => setFilter('date_from', e.target.value)} className="h-7 text-xs w-full" />
            {hasFilters && <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => setFilters({ brand: '', model_no: '', description: '', application: '', qty_min: '', price_min: '', stock_location: '', date_from: '' })}>✕</Button>}
          </div></td>}
        </>}
        emptyMessage={t('inventory.dataTableEmptyMessage', { defaultValue: "No inventory items yet. Click 'Add Stock' to add items." })}
      />
      )}

      {/* Update Password Dialog */}
      <Dialog open={showUpdatePasswordDialog} onOpenChange={setShowUpdatePasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('inventory.verifyAccountTitle', { defaultValue: 'Verify Your Account' })}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('inventory.verifyPasswordUpdateHint', { defaultValue: 'Enter your account password to proceed with updating.' })}</p>
            <div>
              <Label>{t('inventory.password', { defaultValue: 'Password' })}</Label>
              <Input type="password" value={updatePassword} onChange={e => setUpdatePassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUpdatePasswordSubmit()} placeholder={t('inventory.enterYourPassword', { defaultValue: 'Enter your password' })} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUpdatePasswordDialog(false); setUpdatePassword(''); }}>{t('inventory.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={handleUpdatePasswordSubmit}>{t('inventory.verify', { defaultValue: 'Verify' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Price/Location/Image Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent className="glass-dialog max-w-lg overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-cyan-400 to-sky-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              {t('inventory.updateItemTitle', { name: selectedItem?.item_name || selectedItem?.description, defaultValue: 'Update Item — {{name}}' })}
            </DialogTitle>
          </DialogHeader>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-5 overflow-y-auto max-h-[calc(85vh-140px)] py-2 pr-1"
          >
            {/* Image upload */}
            <div>
              <Label className="text-sm font-medium mb-2 block">{t('inventory.productImage', { defaultValue: 'Product Image' })}</Label>
              {updateForm.image_url ? (
                <div className="relative w-24 h-24">
                  <img src={updateForm.image_url} alt={t('inventory.imagePreviewAlt', { defaultValue: 'preview' })} className="w-24 h-24 rounded-lg object-cover border shadow-sm" />
                  <button type="button" onClick={() => setUpdateForm(f => ({ ...f, image_url: '' }))}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center shadow-md">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  <ImagePlus className="w-5 h-5 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground text-center">{t('inventory.uploadImage', { defaultValue: 'Upload image' })}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpdateImageUpload} disabled={uploadingUpdateImage} />
                </label>
              )}
            </div>

            {/* Purchase Price */}
            <div>
              <Label className="text-sm font-medium mb-1.5 block">{t('inventory.purchasePrice', { defaultValue: 'Purchase Price' })}</Label>
              <div className="flex items-stretch">
                <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                <SmartNumberInput
                  className="rounded-l-none h-9 text-sm flex-1"
                  value={updateForm.unit_purchase_price}
                  onChange={e => setUpdateForm(f => ({ ...f, unit_purchase_price: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Selling Price */}
            <div>
              <Label className="text-sm font-medium mb-1.5 block">{t('inventory.sellingPrice', { defaultValue: 'Selling Price' })}</Label>
              <div className="flex items-stretch">
                <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                <SmartNumberInput
                  className="rounded-l-none h-9 text-sm flex-1"
                  value={updateForm.unit_selling_price}
                  onChange={e => setUpdateForm(f => ({ ...f, unit_selling_price: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                />
              </div>
              {updateForm.unit_purchase_price > 0 && updateForm.unit_selling_price > 0 && (
                <div className="flex items-center gap-1.5 text-xs mt-1">
                  <span className="text-muted-foreground">{t('inventory.margin', { defaultValue: 'Margin:' })}</span>
                  <span className={`font-semibold px-1.5 py-0.5 rounded ${
                    ((updateForm.unit_selling_price - updateForm.unit_purchase_price) / updateForm.unit_purchase_price * 100) >= 0
                      ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {(((updateForm.unit_selling_price - updateForm.unit_purchase_price) / updateForm.unit_purchase_price) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            {/* Stock Location */}
            {f.location && (
              <div>
                <Label className="text-sm font-medium mb-1.5 block">{t('inventory.stockLocation', { defaultValue: 'Stock Location' })}</Label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    value={updateForm.stock_location}
                    onChange={e => setUpdateForm(f => ({ ...f, stock_location: e.target.value }))}
                    placeholder={t('inventory.placeholderShelfLocation', { defaultValue: 'e.g. Shelf A-3' })}
                  />
                </div>
              </div>
            )}
          </motion.div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>{t('inventory.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={handleUpdateSubmit} className="gap-2"><Tag className="w-4 h-4" />{t('inventory.saveChanges', { defaultValue: 'Save Changes' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('inventory.verifyAccountTitle', { defaultValue: 'Verify Your Account' })}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('inventory.verifyPasswordDeleteHint', { defaultValue: 'Enter your account password to proceed with deletion.' })}</p>
            <div>
              <Label>{t('inventory.password', { defaultValue: 'Password' })}</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()} placeholder={t('inventory.enterYourPassword', { defaultValue: 'Enter your password' })} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPasswordDialog(false); setPassword(''); }}>{t('inventory.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={handlePasswordSubmit}>{t('inventory.verify', { defaultValue: 'Verify' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('inventory.confirmDeletionTitle', { defaultValue: 'Confirm Deletion' })}</DialogTitle></DialogHeader>
          <p className="text-sm">{t('inventory.confirmDeletePrefix', { defaultValue: 'Are you sure you want to delete' })} <span className="font-semibold">{selectedItem?.item_name || selectedItem?.description}</span>{t('inventory.confirmDeleteSuffix', { defaultValue: '?' })}</p>
          <p className="text-xs text-red-600 mt-1">{t('inventory.actionCannotBeUndone', { defaultValue: 'This action cannot be undone.' })}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>{t('inventory.noCancel', { defaultValue: 'No, Cancel' })}</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>{t('inventory.yesDelete', { defaultValue: 'Yes, Delete' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent className="glass-dialog max-w-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-cyan-400 to-sky-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-primary" />
              {t('inventory.adjustStockTitle', { name: selectedItem?.item_name || selectedItem?.description, defaultValue: 'Adjust Stock — {{name}}' })}
            </DialogTitle>
          </DialogHeader>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Current quantity badge */}
            <div className="bg-secondary rounded-lg px-4 py-2 text-sm flex justify-between">
              <span className="text-muted-foreground">{t('inventory.currentQuantity', { defaultValue: 'Current Quantity' })}</span>
              <span className="font-semibold">{selectedItem?.quantity ?? 0} {selectedItem?.unit}</span>
            </div>

            {/* Adjustment Type chips */}
            <div>
              <Label>{t('inventory.adjustmentType', { defaultValue: 'Adjustment Type' })}</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[
                  { v: 'ADDITION',    label: '+ ' + t('inventory.add', { defaultValue: 'Add' }),     color: 'border-green-400 text-green-700', activeColor: 'bg-green-50 border-green-500' },
                  { v: 'SUBTRACTION', label: '− ' + t('inventory.remove', { defaultValue: 'Remove' }),  color: 'border-red-400 text-red-700',   activeColor: 'bg-red-50 border-red-500' },
                  { v: 'RECOUNT',     label: '↺ ' + t('inventory.recount', { defaultValue: 'Recount' }), color: 'border-blue-400 text-blue-700', activeColor: 'bg-blue-50 border-blue-500' },
                ].map(({ v, label, color, activeColor }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAdjForm({ ...adjForm, type: v })}
                    className={`sel-chip ${adjForm.type === v ? activeColor : color + ' opacity-70'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity input */}
            <div>
              <Label>
                {adjForm.type === 'RECOUNT' ? t('inventory.newQuantity', { defaultValue: 'New Quantity' }) : (adjForm.type === 'ADDITION' ? t('inventory.quantityToAdd', { defaultValue: 'Quantity to Add' }) : t('inventory.quantityToRemove', { defaultValue: 'Quantity to Remove' }))} *
              </Label>
              <div className="relative mt-1">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <SmartNumberInput
                  className="pl-8 h-9 text-sm"
                  placeholder="0"
                  value={adjForm.quantity}
                  onChange={e => setAdjForm({ ...adjForm, quantity: e.target.value })}
                />
              </div>
              {adjForm.quantity && adjForm.type !== 'RECOUNT' && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('inventory.newQuantityWillBe', { defaultValue: 'New quantity will be:' })}{' '}
                  <strong>
                    {adjForm.type === 'ADDITION'
                      ? (selectedItem?.quantity || 0) + parseFloat(adjForm.quantity || 0)
                      : Math.max(0, (selectedItem?.quantity || 0) - parseFloat(adjForm.quantity || 0))}
                  </strong>{' '}{selectedItem?.unit}
                </p>
              )}
            </div>

            {/* Reason */}
            <div>
              <Label>{t('inventory.reason', { defaultValue: 'Reason' })} *</Label>
              <div className="relative mt-1">
                <MessageSquare className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Textarea
                  className="pl-8 text-sm"
                  rows={2}
                  placeholder={t('inventory.placeholderAdjustmentReason', { defaultValue: 'e.g. Physical stock count, damaged goods, returned items...' })}
                  value={adjForm.reason}
                  onChange={e => setAdjForm({ ...adjForm, reason: e.target.value })}
                />
              </div>
            </div>
          </motion.div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>{t('inventory.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button
              onClick={submitAdjustment}
              disabled={adjSubmitting || !adjForm.quantity || !adjForm.reason.trim()}
            >
              {adjSubmitting ? t('inventory.saving', { defaultValue: 'Saving...' }) : t('inventory.saveAdjustment', { defaultValue: 'Save Adjustment' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment Log Dialog */}
      <Dialog open={showAdjLogDialog} onOpenChange={setShowAdjLogDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4" />
              {t('inventory.adjustmentLogTitle', { name: selectedItem?.item_name || selectedItem?.description, defaultValue: 'Adjustment Log — {{name}}' })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {adjLog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('inventory.noAdjustmentsRecorded', { defaultValue: 'No adjustments recorded yet.' })}</p>
            ) : (
              <div className="space-y-2">
                {adjLog.map((entry, idx) => (
                  <div key={entry.id ?? idx} className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg text-sm">
                    <span className={`shrink-0 font-bold text-xs px-2 py-0.5 rounded-full ${
                      entry.adjustmentType === 'ADDITION' ? 'bg-green-100 text-green-700' :
                      entry.adjustmentType === 'SUBTRACTION' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {entry.adjustmentType === 'ADDITION' ? '+' : entry.adjustmentType === 'SUBTRACTION' ? '−' : '⟳'}
                      {entry.quantity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{entry.reason}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('inventory.beforeAfter', { before: entry.quantityBefore, after: entry.quantityAfter, defaultValue: 'Before: {{before}} → After: {{after}}' })}
                        {entry.createdAt && ` · ${new Date(entry.createdAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjLogDialog(false)}>{t('inventory.close', { defaultValue: 'Close' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAdd} onOpenChange={(v) => { setShowAdd(v); if (!v) setShowExtraFields(false); }}>
        <DialogContent className="glass-dialog max-w-5xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-cyan-400 to-sky-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              {t('inventory.addNewItemTitle', { defaultValue: 'Add New Inventory Item' })}
            </DialogTitle>
            {company?.business_type && (
              <p className="text-xs text-muted-foreground">
                {t('inventory.fieldsShownForPrefix', { defaultValue: 'Fields shown for' })} <span className="font-medium">
                  {getBusinessTypeLabel(t, company.business_type)}
                </span> {t('inventory.fieldsShownForSuffix', { defaultValue: 'businesses.' })}
                {' '}{t('inventory.changeInSettingsPrefix', { defaultValue: 'Change in' })} <a href="/settings" className="text-primary underline">{t('inventory.settingsLink', { defaultValue: 'Settings' })}</a> {t('inventory.changeInSettingsSuffix', { defaultValue: 'to adjust.' })}
              </p>
            )}
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 max-h-[72vh] overflow-hidden mt-1">

            {/* LEFT column — Item Details */}
            <div className="overflow-y-auto space-y-4 pr-2">
              {/* Image upload */}
              <div>
                <Label className="text-sm font-medium mb-2 block">{t('inventory.image', { defaultValue: 'Image' })}</Label>
                {form.image_url ? (
                  <div className="relative w-32 h-32">
                    <img src={form.image_url} alt={t('inventory.imagePreviewAlt', { defaultValue: 'preview' })} className="w-32 h-32 rounded-lg object-cover border shadow-sm" />
                    <button type="button" onClick={() => setForm(f => ({ ...f, image_url: '' }))}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center shadow-md">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                    <ImagePlus className="w-6 h-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground text-center">{t('inventory.clickToUpload', { defaultValue: 'Click to upload' })}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                  </label>
                )}
              </div>

              {/* Basic Information */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium border-b pb-1">{t('inventory.basicInformation', { defaultValue: 'Basic Information' })}</h4>

                {/* Item Name */}
                <div>
                  <Label className="text-sm">{t('inventory.itemName', { defaultValue: 'Item Name' })} *</Label>
                  <div className="relative mt-1">
                    <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      className="pl-8 h-9 text-sm"
                      value={form.item_name}
                      onChange={e => setForm({ ...form, item_name: e.target.value })}
                      placeholder={p.item_name}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Label className="text-sm">{t('inventory.colDetails', { defaultValue: 'Description' })} <span className="text-muted-foreground text-xs">{t('inventory.optional', { defaultValue: '(optional)' })}</span></Label>
                  <div className="relative mt-1">
                    <FileText className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      className="pl-8 h-9 text-sm"
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      placeholder={p.description}
                    />
                  </div>
                </div>

                {/* Brand */}
                {f.brand && (
                  <div>
                    <Label className="text-sm">{t('inventory.colBrand', { defaultValue: 'Brand' })} <span className="text-muted-foreground text-xs">{t('inventory.optional', { defaultValue: '(optional)' })}</span></Label>
                    <div className="relative mt-1">
                      <Award className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        className="pl-8 h-9 text-sm"
                        value={form.brand}
                        onChange={e => setForm({ ...form, brand: e.target.value })}
                        placeholder={p.brand || t('inventory.placeholderOtherBrand', { defaultValue: 'e.g. Brand name' })}
                      />
                    </div>
                  </div>
                )}

                {/* Model / Part No */}
                {f.modelNo && (
                  <div>
                    <Label className="text-sm">{t('inventory.modelPartNo', { defaultValue: 'Model / Part No.' })} <span className="text-muted-foreground text-xs">{t('inventory.optional', { defaultValue: '(optional)' })}</span></Label>
                    <div className="relative mt-1">
                      <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        className="pl-8 h-9 text-sm"
                        value={form.model_no}
                        onChange={e => setForm({ ...form, model_no: e.target.value })}
                        placeholder={p.model_no || t('inventory.placeholderModelNoFallback', { defaultValue: 'e.g. USB-C-3.0' })}
                      />
                    </div>
                  </div>
                )}

                {/* Application */}
                {f.application && (
                  <div>
                    <Label className="text-sm">{t('inventory.usagePurpose', { defaultValue: 'Usage / Purpose' })} <span className="text-muted-foreground text-xs">{t('inventory.optional', { defaultValue: '(optional)' })}</span></Label>
                    <div className="relative mt-1">
                      <Layers className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        className="pl-8 h-9 text-sm"
                        value={form.application}
                        onChange={e => setForm({ ...form, application: e.target.value })}
                        placeholder={p.application || t('inventory.placeholderOtherApplication', { defaultValue: 'e.g. Usage or purpose' })}
                      />
                    </div>
                  </div>
                )}

                {/* Supplier Name */}
                <div>
                  <Label className="text-sm">{t('inventory.supplierName', { defaultValue: 'Supplier Name' })} <span className="text-muted-foreground text-xs">{t('inventory.optional', { defaultValue: '(optional)' })}</span></Label>
                  <div className="relative mt-1">
                    <Truck className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      className="pl-8 h-9 text-sm"
                      value={form.supplier_name}
                      onChange={e => setForm({ ...form, supplier_name: e.target.value })}
                      placeholder={p.supplier_name || t('inventory.placeholderSupplierNameFallback', { defaultValue: 'e.g. ABC Traders' })}
                    />
                  </div>
                </div>

                {/* Show additional fields toggle for OTHER type */}
                {isOtherType && !showExtraFields && (
                  <button
                    type="button"
                    onClick={() => setShowExtraFields(true)}
                    className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                  >
                    {t('inventory.showAdditionalFields', { defaultValue: '+ Show additional fields (brand, model, usage, expiry…)' })}
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT column — Pricing & Stock */}
            <div className="overflow-y-auto space-y-4 pr-2">
              <div className="space-y-3">
                <h4 className="text-sm font-medium border-b pb-1">{t('inventory.quantityAndPricing', { defaultValue: 'Quantity & Pricing' })}</h4>

                {/* Quantity */}
                <div>
                  <Label className="text-sm">{t('inventory.quantity', { defaultValue: 'Quantity' })}</Label>
                  <div className="relative mt-1">
                    <Package className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <SmartNumberInput
                      className="pl-8 h-9 text-sm"
                      value={form.quantity}
                      onChange={e => setForm({ ...form, quantity: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Unit */}
                <div>
                  <Label className="text-sm">{t('inventory.unit', { defaultValue: 'Unit' })}</Label>
                  {!form.unit || UNITS.includes(form.unit) ? (
                    <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v === '__custom__' ? '__custom__' : v })}>
                      <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder={t('inventory.selectUnit', { defaultValue: 'Select unit' })} /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map(u => <SelectItem key={u} value={u}>{t(`inventory.unit${u}`, { defaultValue: u })}</SelectItem>)}
                        <SelectItem value="__custom__">{t('inventory.customEllipsis', { defaultValue: 'Custom...' })}</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2 mt-1">
                      <Input value={form.unit === '__custom__' ? '' : form.unit}
                        onChange={e => setForm({ ...form, unit: e.target.value })} placeholder={t('inventory.customUnit', { defaultValue: 'Custom unit' })} autoFocus className="h-9 text-sm" />
                      <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, unit: 'Piece' })}>↩</Button>
                    </div>
                  )}
                </div>

                {/* Buy Price */}
                <div>
                  <Label className="text-sm">{t('inventory.purchasePrice', { defaultValue: 'Purchase Price' })}</Label>
                  <div className="flex items-stretch mt-1">
                    <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                    <SmartNumberInput
                      className="rounded-l-none h-9 text-sm flex-1"
                      value={form.unit_purchase_price}
                      onChange={e => setForm({ ...form, unit_purchase_price: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Sell Price */}
                <div>
                  <Label className="text-sm">{t('inventory.sellingPrice', { defaultValue: 'Selling Price' })}</Label>
                  <div className="flex items-stretch mt-1">
                    <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">NPR</span>
                    <SmartNumberInput
                      className="rounded-l-none h-9 text-sm flex-1"
                      value={form.unit_selling_price}
                      onChange={e => setForm({ ...form, unit_selling_price: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  {form.unit_purchase_price > 0 && form.unit_selling_price > 0 && (
                    <div className="flex items-center gap-1.5 text-xs mt-1">
                      <span className="text-muted-foreground">{t('inventory.margin', { defaultValue: 'Margin:' })}</span>
                      <span className={`font-semibold px-1.5 py-0.5 rounded ${
                        ((form.unit_selling_price - form.unit_purchase_price) / form.unit_purchase_price * 100) >= 0
                          ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {(((form.unit_selling_price - form.unit_purchase_price) / form.unit_purchase_price) * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Low Stock Threshold */}
                <div>
                  <Label className="text-sm">{t('inventory.lowStockAlert', { defaultValue: 'Low Stock Alert' })}</Label>
                  <div className="relative mt-1">
                    <AlertTriangle className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <SmartNumberInput
                      className="pl-8 h-9 text-sm"
                      value={form.low_stock_threshold}
                      onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })}
                      placeholder="5"
                    />
                  </div>
                </div>

                {/* Stock Location */}
                {f.location && (
                  <div>
                    <Label className="text-sm">{t('inventory.stockLocation', { defaultValue: 'Stock Location' })} <span className="text-muted-foreground text-xs">{t('inventory.optional', { defaultValue: '(optional)' })}</span></Label>
                    <div className="relative mt-1">
                      <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        className="pl-8 h-9 text-sm"
                        value={form.stock_location}
                        onChange={e => setForm({ ...form, stock_location: e.target.value })}
                        placeholder={t('inventory.placeholderShelfLocation', { defaultValue: 'e.g. Shelf A-3' })}
                      />
                    </div>
                  </div>
                )}

                {/* Expiry Date */}
                {f.expiry && (
                  <div>
                    <Label className="text-sm">{t('inventory.expiryDate', { defaultValue: 'Expiry Date' })} <span className="text-muted-foreground text-xs">{t('inventory.optional', { defaultValue: '(optional)' })}</span></Label>
                    <div className="relative mt-1">
                      <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        type="date"
                        className="pl-8 h-9 text-sm"
                        value={form.expiry_date || ''}
                        onChange={e => setForm({ ...form, expiry_date: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* Aging Alert */}
                {f.aging && (
                  <div>
                    <Label className="text-sm">{t('inventory.agingAlertDays', { defaultValue: 'Aging Alert (Days)' })} <span className="text-muted-foreground text-xs">{t('inventory.flagSlowMovingStock', { defaultValue: '(flag slow-moving stock)' })}</span></Label>
                    <div className="relative mt-1">
                      <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <SmartNumberInput
                        className="pl-8 h-9 text-sm"
                        value={form.aging_days}
                        onChange={e => setForm({ ...form, aging_days: e.target.value })}
                        placeholder="90"
                      />
                    </div>
                  </div>
                )}

                {/* Expiry Alert Days */}
                {f.expiry && (
                  <div>
                    <Label className="text-sm">{t('inventory.alertBeforeExpiryDays', { defaultValue: 'Alert Before Expiry (Days)' })}</Label>
                    <div className="relative mt-1">
                      <AlertTriangle className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <SmartNumberInput
                        className="pl-8 h-9 text-sm"
                        placeholder="30"
                        value={form.expiry_alert_days || ''}
                        onChange={e => setForm({ ...form, expiry_alert_days: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t('inventory.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={addItem} disabled={!form.item_name} className="gap-2">
              <Package className="w-4 h-4" />{t('inventory.addItem', { defaultValue: 'Add Item' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
