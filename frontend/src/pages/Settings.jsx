import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/adapter';
import { toast } from 'sonner';
import { usersApi, companyApi, recycleBinApi, bankAccountApi, uploadApi, notificationsApi, fiscalYearApi } from '@/api';
import apiClient from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { useRole } from "@/lib/useRole";
import { usePreferences } from '@/lib/PreferencesContext';
import { getActiveCompanyId, setActiveCompanyId } from '@/lib/companyContext';
import { confirm } from '@/lib/confirm';
import PageHeader from '../components/shared/PageHeader';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SmartNumberInput } from "@/components/ui/smart-number-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Building2, Plus, Trash2, Save, ImagePlus, X, UserPlus, Copy, Check, Shield,
  Phone, Mail, MapPin, Hash, User, Palette, Type, Bell, RotateCcw, Upload,
  Recycle, RotateCw, Lock, AlertTriangle, Clock, Zap, QrCode, Power, PowerOff, Layers
} from 'lucide-react';

const SIDEBAR_PALETTE = ['#1e293b', '#1e3a5f', '#14532d', '#4c1d95', '#881337', '#7c2d12'];
const TOPBAR_PALETTE = ['#ffffff', '#f8fafc', '#eff6ff', '#f0fdf4', '#0f172a', '#1d4ed8'];
const FONT_SIZES = [
  { key: 'small',  label: 'Small',   px: '12px' },
  { key: 'medium', label: 'Medium',  px: '14px' },
  { key: 'large',  label: 'Large',   px: '16px' },
  { key: 'xl',     label: 'XL',      px: '18px' },
];

const FONT_SIZE_I18N_KEY = {
  small: 'settings.fontSizeSmall',
  medium: 'settings.fontSizeMedium',
  large: 'settings.fontSizeLarge',
  xl: 'settings.fontSizeXl',
};

const ROLE_COLORS = {
  ADMIN: 'bg-red-100 text-red-700',
  ACCOUNTANT: 'bg-blue-100 text-blue-700',
  STAFF: 'bg-green-100 text-green-700',
  TEACHER: 'bg-amber-100 text-amber-700',
  LIBRARIAN: 'bg-teal-100 text-teal-700',
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
};

const ROLE_I18N_KEY = {
  STAFF: 'settings.roleStaff',
  ACCOUNTANT: 'settings.roleAccountant',
  TEACHER: 'settings.roleTeacher',
  LIBRARIAN: 'settings.roleLibrarian',
  ADMIN: 'settings.roleAdmin',
  SUPER_ADMIN: 'settings.roleSuperAdmin',
};

const BUSINESS_TYPES = [
  { value: 'RETAIL', label: 'Retail / General Store' },
  { value: 'PHARMACY', label: 'Pharmacy / Medical' },
  { value: 'ELECTRONICS', label: 'Electronics / Hardware' },
  { value: 'FOOD_BEVERAGE', label: 'Restaurant / Tea Shop / Bakery' },
  { value: 'SERVICES', label: 'Services / Consulting / IT' },
  { value: 'MANUFACTURING', label: 'Manufacturing / Production' },
  { value: 'OTHER', label: 'Other' },
];

const BUSINESS_TYPE_LABELS = Object.fromEntries(BUSINESS_TYPES.map(b => [b.value, b.label]));

const BUSINESS_TYPE_I18N_KEY = {
  RETAIL: 'settings.businessTypeRetail',
  PHARMACY: 'settings.businessTypePharmacy',
  ELECTRONICS: 'settings.businessTypeElectronics',
  FOOD_BEVERAGE: 'settings.businessTypeFoodBeverage',
  SERVICES: 'settings.businessTypeServices',
  MANUFACTURING: 'settings.businessTypeManufacturing',
  OTHER: 'settings.businessTypeOther',
};

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { canEdit, canDelete, canManageUsers } = useRole();
  const { prefs, updatePref, resetPrefs } = usePreferences();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isSchool = user?.defaultCompany?.businessType === 'SCHOOL';
  const activeCompanyId = getActiveCompanyId();
  const logoInputRef = useRef(null);

  function roleLabel(role) {
    const key = ROLE_I18N_KEY[role];
    return key ? t(key, { defaultValue: role }) : role;
  }

  function businessTypeLabel(value) {
    if (!value) return value;
    const key = BUSINESS_TYPE_I18N_KEY[value];
    return key ? t(key, { defaultValue: BUSINESS_TYPE_LABELS[value] || value }) : value;
  }

  // Controlled so the selected tab survives `loading` toggling (see `if (loading)
  // return (...)` below) — every company action (add/edit/delete/deactivate) calls
  // loadCompanies(), which flips loading true→false, unmounting and remounting an
  // uncontrolled <Tabs defaultValue="preferences"> each time and resetting it back
  // to Preferences. Lifting the selection into state here fixes that for all of them.
  const [activeTab, setActiveTab] = useState('preferences');

  // ── Companies ─────────────────────────────────────────────────────────────
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: '', address: '', phone: '', email: '', pan_vat: '',
    registration_number: '', business_type: '', default_unit_type: '',
    currency: 'NPR', logo_url: '',
  });

  // ── Users ─────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'STAFF' });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState(null);
  const [copied, setCopied] = useState(false);
  const [roleChanging, setRoleChanging] = useState(null);
  const [removingUserId, setRemovingUserId] = useState(null);
  const [maxCompaniesSaving, setMaxCompaniesSaving] = useState(null);

  // ── Recycle Bin ───────────────────────────────────────────────────────────
  const [binAccessGranted, setBinAccessGranted] = useState(false);
  const [binPassword, setBinPassword] = useState('');
  const [binPasswordError, setBinPasswordError] = useState('');
  const [binVerifying, setBinVerifying] = useState(false);
  const [binItems, setBinItems] = useState(null);
  const [binLoading, setBinLoading] = useState(false);
  const [binAutoDelete, setBinAutoDelete] = useState(() => parseInt(localStorage.getItem('easybooks_bin_auto_delete') || '0'));
  const [binConfirmEmpty, setBinConfirmEmpty] = useState(false);

  // ── Company Prefs (server-side) ───────────────────────────────────────────
  const [companyPrefs, setCompanyPrefs] = useState({
    abbreviation: '', workingDaysPerMonth: 26,
    standardStartTime: '', standardEndTime: '', attendanceDeductionEnabled: false,
  });
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  // ── Package (SUPER_ADMIN only) ────────────────────────────────────────────
  const [companyEnabledModules, setCompanyEnabledModules] = useState([]);
  const [packageSaving, setPackageSaving] = useState(false);
  const [packageSaved, setPackageSaved] = useState(false);

  // ── Create Client (SUPER_ADMIN only — sales-led onboarding) ──────────────
  const [provisionForm, setProvisionForm] = useState({
    companyName: '', businessType: 'SCHOOL', adminName: '', adminEmail: '', package: 'STANDARD',
  });
  const [provisioning, setProvisioning] = useState(false);

  const [automation, setAutomation] = useState({
    autoFeeBilling: true, autoInvoiceRelease: true, autoPayroll: true, autoReconciliation: true,
    autoLibraryReminders: true,
  });
  const [automationSaving, setAutomationSaving] = useState(false);
  const [automationSaved, setAutomationSaved] = useState(false);
  const [fiscalYearStatus, setFiscalYearStatus] = useState(null);
  const [closingFiscalYear, setClosingFiscalYear] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [closePassword, setClosePassword] = useState('');
  const [reopeningYear, setReopeningYear] = useState(null); // fiscalYear string currently mid-confirm, or null
  const [reopenPassword, setReopenPassword] = useState('');
  const [reopenSaving, setReopenSaving] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [qrUploadingId, setQrUploadingId] = useState(null);
  const [showAddBank, setShowAddBank] = useState(false);
  const [bankForm, setBankForm] = useState({ bankName: '', accountNumber: '', accountType: '', branch: '', currentBalance: '', paymentType: 'BANK' });
  const [addBankSaving, setAddBankSaving] = useState(false);

  useEffect(() => { loadCompanies(); }, []);
  useEffect(() => { loadFiscalYearStatus(); }, [activeCompanyId]);

  async function loadFiscalYearStatus() {
    if (!activeCompanyId) return;
    try {
      const res = await fiscalYearApi.status();
      setFiscalYearStatus(res.data);
    } catch {
      setFiscalYearStatus(null);
    }
  }

  async function handleCloseFiscalYear() {
    if (!fiscalYearStatus?.preview || !closePassword) return;
    setClosingFiscalYear(true);
    try {
      await fiscalYearApi.close(fiscalYearStatus.preview.fiscalYear, closePassword);
      setConfirmingClose(false);
      setClosePassword('');
      await loadFiscalYearStatus();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('settings.failedCloseFiscalYear', { defaultValue: 'Failed to close fiscal year' }));
    } finally {
      setClosingFiscalYear(false);
    }
  }

  async function handleReopenFiscalYear(fiscalYear) {
    if (!reopenPassword) return;
    setReopenSaving(true);
    try {
      await fiscalYearApi.reopen(fiscalYear, reopenPassword);
      setReopeningYear(null);
      setReopenPassword('');
      await loadFiscalYearStatus();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('settings.failedReopenFiscalYear', { defaultValue: 'Failed to reopen fiscal year' }));
    } finally {
      setReopenSaving(false);
    }
  }

  // Server is the source of truth for notification preferences (per-user,
  // shared across devices) — localStorage is only the instant-UI cache
  // (usePreferences default) until this hydrates it with the real value.
  useEffect(() => {
    notificationsApi.getPreferences()
      .then(res => updatePref('notifications', res.data))
      .catch(() => {});
  }, []);

  async function loadCompanies() {
    setLoading(true);
    const [list, payrollRes] = await Promise.all([
      api.Company.list(),
      activeCompanyId ? companyApi.getPayrollSettings(activeCompanyId).catch(() => null) : null,
    ]);
    setCompanies(list);
    const active = list.find(c => c.id === activeCompanyId);
    setCompanyEnabledModules(active?.enabledModules ?? []);
    setCompanyPrefs({
      abbreviation: active?.abbreviation || '',
      workingDaysPerMonth: payrollRes?.data?.workingDaysPerMonth ?? 26,
      standardStartTime: payrollRes?.data?.standardStartTime ?? '',
      standardEndTime: payrollRes?.data?.standardEndTime ?? '',
      attendanceDeductionEnabled: payrollRes?.data?.attendanceDeductionEnabled ?? false,
    });
    setAutomation({
      autoFeeBilling: active?.auto_fee_billing ?? true,
      autoInvoiceRelease: active?.auto_invoice_release ?? true,
      autoPayroll: active?.auto_payroll ?? true,
      autoReconciliation: active?.auto_reconciliation ?? true,
      autoLibraryReminders: active?.auto_library_reminders ?? true,
      autoPaymentProofReminders: active?.auto_payment_proof_reminders ?? true,
    });
    setLoading(false);
  }

  async function loadBankAccounts() {
    if (!activeCompanyId) return;
    try {
      const res = await bankAccountApi.list();
      setBankAccounts(res.data ?? []);
    } catch {
      setBankAccounts([]);
    }
  }

  async function saveAutomation() {
    if (!activeCompanyId) return;
    setAutomationSaving(true);
    try {
      await companyApi.update(activeCompanyId, automation);
      setAutomationSaved(true);
      setTimeout(() => setAutomationSaved(false), 2000);
    } catch {
      toast.error(t('settings.failedSaveAutomation', { defaultValue: 'Failed to save automation settings' }));
    } finally {
      setAutomationSaving(false);
    }
  }

  function resolveFileUrl(url = '') {
    return url.startsWith('http') ? url : `${apiClient.defaults.baseURL}${url}`;
  }

  async function handleQrUpload(bankAccountId, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrUploadingId(bankAccountId);
    try {
      const uploadRes = await uploadApi.upload(file);
      await bankAccountApi.update(bankAccountId, { qrCodeUrl: uploadRes.data.url });
      await loadBankAccounts();
    } catch {
      toast.error(t('settings.failedUploadQr', { defaultValue: 'Failed to upload QR code' }));
    } finally {
      setQrUploadingId(null);
    }
  }

  async function handleAddBank(e) {
    e.preventDefault();
    if (!activeCompanyId || !bankForm.bankName.trim() || !bankForm.accountNumber.trim()) return;
    setAddBankSaving(true);
    try {
      await bankAccountApi.create({
        companyId: activeCompanyId,
        bankName: bankForm.bankName.trim(),
        accountNumber: bankForm.accountNumber.trim(),
        accountType: bankForm.accountType.trim() || undefined,
        branch: bankForm.branch.trim() || undefined,
        currentBalance: bankForm.currentBalance ? Number(bankForm.currentBalance) : 0,
        paymentType: bankForm.paymentType,
      });
      setShowAddBank(false);
      setBankForm({ bankName: '', accountNumber: '', accountType: '', branch: '', currentBalance: '', paymentType: 'BANK' });
      await loadBankAccounts();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('settings.failedAddBank', { defaultValue: 'Failed to add bank account' }));
    } finally {
      setAddBankSaving(false);
    }
  }

  async function loadUsers() {
    if (!activeCompanyId || !isAdmin) return;
    setUsersLoading(true);
    try {
      const res = await usersApi.list(activeCompanyId);
      setUsers(res.data);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }

  // ── Company CRUD ──────────────────────────────────────────────────────────

  async function addCompany() {
    try {
      await api.Company.create({ ...companyForm, is_active: true });
      setCompanyForm({ name: '', address: '', phone: '', email: '', pan_vat: '', registration_number: '', business_type: '', default_unit_type: '', currency: 'NPR', logo_url: '' });
      setShowAddCompany(false);
      loadCompanies();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('settings.failedAddCompany', { defaultValue: 'Failed to add company' }));
    }
  }

  async function updateCompany() {
    if (!editingCompany) return;
    await api.Company.update(editingCompany.id, editingCompany);
    setEditingCompany(null);
    loadCompanies();
  }

  async function deleteCompany(id) {
    // NOTE: this used to be `if (!confirm(...)) return` without an await — confirm()
    // always returns a Promise (truthy), so that check never actually blocked anything;
    // the delete fired immediately regardless of what the user clicked. Fixed here.
    const ok = await confirm({
      title: t('settings.confirmDeleteCompanyTitle', { defaultValue: 'Delete this company?' }),
      description: t('settings.confirmDeleteCompany', { defaultValue: 'This permanently deletes the company and cannot be undone. If you just want to pause a school that stopped using OneBook, use Deactivate instead.' }),
      confirmLabel: t('settings.delete', { defaultValue: 'Delete' }),
      variant: 'destructive',
    });
    if (!ok) return;
    await api.Company.delete(id);
    if (getActiveCompanyId() === id) {
      const remaining = companies.filter(c => c.id !== id);
      if (remaining.length > 0) setActiveCompanyId(remaining[0].id);
    }
    loadCompanies();
  }

  async function toggleCompanyActive(company) {
    const activating = !company.is_active;
    if (!activating) {
      const ok = await confirm({
        title: t('settings.confirmDeactivateTitle', { defaultValue: 'Deactivate this school?' }),
        description: t('settings.confirmDeactivateDescription', { defaultValue: 'The nightly automation (fee billing, payroll, reconciliation) will stop running for this school. You can reactivate it anytime.' }),
        confirmLabel: t('settings.deactivate', { defaultValue: 'Deactivate' }),
        variant: 'destructive',
      });
      if (!ok) return;
    }
    await api.Company.update(company.id, { is_active: activating });
    loadCompanies();
  }

  async function handleLogoUpload(e, isEditing = false) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const file_url = URL.createObjectURL(file);
    if (isEditing && editingCompany) setEditingCompany({ ...editingCompany, logo_url: file_url });
    else setCompanyForm({ ...companyForm, logo_url: file_url });
    setUploadingLogo(false);
  }

  // ── User Management ───────────────────────────────────────────────────────

  async function handleInvite(e) {
    e.preventDefault();
    setInviteLoading(true);
    try {
      const res = await usersApi.invite(activeCompanyId, inviteForm);
      if (res.data.tempPassword) setTempPassword(res.data.tempPassword);
      else { setShowInvite(false); setInviteForm({ name: '', email: '', role: 'STAFF' }); }
      loadUsers();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('settings.failedInviteUser', { defaultValue: 'Failed to invite user' }));
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRoleChange(userId, newRole) {
    setRoleChanging(userId);
    try {
      await usersApi.changeRole(userId, activeCompanyId, newRole);
      loadUsers();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('settings.failedChangeRole', { defaultValue: 'Failed to change role' }));
    } finally {
      setRoleChanging(null);
    }
  }

  async function handleMaxCompaniesChange(userId, value) {
    const n = parseInt(value, 10);
    if (!n || n < 1) return;
    setMaxCompaniesSaving(userId);
    try {
      await usersApi.updateMaxCompanies(userId, n);
      loadUsers();
      toast.success(t('settings.maxCompaniesUpdated', { defaultValue: 'Company limit updated' }));
    } catch (err) {
      toast.error(err?.response?.data?.message || t('settings.failedUpdateMaxCompanies', { defaultValue: 'Failed to update company limit' }));
    } finally {
      setMaxCompaniesSaving(null);
    }
  }

  async function handleRemoveUser(u) {
    const ok = await confirm({
      title: t('settings.removeUserTitle', { defaultValue: 'Remove user?' }),
      description: t('settings.removeUserDescription', { defaultValue: 'Remove {{name}} from this company? They will lose access immediately.', name: u.name || u.email }),
      confirmLabel: t('settings.remove', { defaultValue: 'Remove' }),
      variant: 'destructive',
    });
    if (!ok) return;
    setRemovingUserId(u.id);
    try {
      await usersApi.remove(u.id, activeCompanyId);
      loadUsers();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('settings.failedRemoveUser', { defaultValue: 'Failed to remove user' }));
    } finally {
      setRemovingUserId(null);
    }
  }

  function copyTempPassword() {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function closeTempPasswordDialog() {
    setTempPassword(null);
    setShowInvite(false);
    setInviteForm({ name: '', email: '', role: 'STAFF' });
  }

  // ── Preferences ───────────────────────────────────────────────────────────

  async function savePreferences() {
    if (!activeCompanyId) return;
    setPrefsSaving(true);
    try {
      await Promise.all([
        companyApi.update(activeCompanyId, { abbreviation: companyPrefs.abbreviation || undefined }),
        companyApi.upsertPayrollSettings(activeCompanyId, {
          workingDaysPerMonth: Number(companyPrefs.workingDaysPerMonth),
          standardStartTime: companyPrefs.standardStartTime || undefined,
          standardEndTime: companyPrefs.standardEndTime || undefined,
          attendanceDeductionEnabled: companyPrefs.attendanceDeductionEnabled,
        }),
      ]);
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2000);
    } catch {
      toast.error(t('settings.failedSavePreferences', { defaultValue: 'Failed to save preferences' }));
    } finally {
      setPrefsSaving(false);
    }
  }

  // ── Package (SUPER_ADMIN only) ────────────────────────────────────────────
  const PACKAGE_MODULES = {
    BASE: ['BASE'],
    STANDARD: ['BASE', 'SCHOOL_ACADEMICS'],
    PREMIUM: ['BASE', 'SCHOOL_ACADEMICS', 'FACILITIES', 'HRMS', 'AI', 'BULK_IMPORT', 'FINANCE', 'INVENTORY'],
  };

  function currentPackageTier() {
    if (companyEnabledModules.length === 0) return null; // legacy/unrestricted — not on a tier yet
    if (companyEnabledModules.includes('FACILITIES')) return 'PREMIUM';
    if (companyEnabledModules.includes('SCHOOL_ACADEMICS')) return 'STANDARD';
    return 'BASE';
  }

  async function savePackage(tier) {
    if (!activeCompanyId) return;
    setPackageSaving(true);
    try {
      const modules = PACKAGE_MODULES[tier];
      await companyApi.updatePackage(activeCompanyId, modules);
      setCompanyEnabledModules(modules);
      setPackageSaved(true);
      setTimeout(() => setPackageSaved(false), 2000);
    } catch (err) {
      toast.error(err?.response?.data?.message || t('settings.packageSaveFailed', { defaultValue: 'Failed to update package' }));
    } finally {
      setPackageSaving(false);
    }
  }

  async function handleProvisionClient(e) {
    e.preventDefault();
    setProvisioning(true);
    try {
      const res = await usersApi.provisionClient({
        companyName: provisionForm.companyName,
        businessType: provisionForm.businessType,
        adminName: provisionForm.adminName,
        adminEmail: provisionForm.adminEmail,
        enabledModules: PACKAGE_MODULES[provisionForm.package] || [],
      });
      if (res.data.emailSent) {
        toast.success(t('settings.clientCreatedEmailed', { defaultValue: 'Client created — login details emailed to {{email}}', email: provisionForm.adminEmail }));
      } else if (res.data.tempPassword) {
        // Email delivery failed — this is the only remaining way to hand over
        // the password, so fall back to showing it instead of losing it.
        toast.error(t('settings.clientCreatedEmailFailed', { defaultValue: 'Client created, but the invite email failed to send — share this password manually' }));
        setTempPassword(res.data.tempPassword);
      }
      setProvisionForm({ companyName: '', businessType: 'SCHOOL', adminName: '', adminEmail: '', package: 'STANDARD' });
      loadCompanies();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('settings.provisionFailed', { defaultValue: 'Failed to create client' }));
    } finally {
      setProvisioning(false);
    }
  }

  async function verifyBinPassword() {
    if (!binPassword) return;
    setBinVerifying(true);
    setBinPasswordError('');
    try {
      const res = await recycleBinApi.verify(binPassword);
      if (res.data?.valid) {
        setBinAccessGranted(true);
        setBinPassword('');
        loadBinItems();
      } else {
        setBinPasswordError(t('settings.binIncorrectPassword', { defaultValue: 'Incorrect password.' }));
      }
    } catch {
      setBinPasswordError(t('settings.binIncorrectPassword', { defaultValue: 'Incorrect password.' }));
    } finally {
      setBinVerifying(false);
    }
  }

  async function loadBinItems() {
    if (!activeCompanyId) return;
    setBinLoading(true);
    try {
      // Auto-cleanup old items if auto-delete is set
      if (binAutoDelete > 0) {
        await recycleBinApi.cleanup(activeCompanyId, binAutoDelete).catch(() => {});
      }
      const res = await recycleBinApi.list(activeCompanyId);
      setBinItems(res.data);
    } catch {
      setBinItems(null);
    } finally {
      setBinLoading(false);
    }
  }

  async function restoreItem(id, type) {
    await recycleBinApi.restore(id, type, activeCompanyId);
    loadBinItems();
  }

  async function permanentDeleteItem(id, type) {
    if (!confirm(t('settings.confirmPermanentDelete', { defaultValue: 'Permanently delete this item? This cannot be undone.' }))) return;
    await recycleBinApi.permanentDelete(id, type, activeCompanyId);
    loadBinItems();
  }

  async function emptyBin() {
    await recycleBinApi.emptyBin(activeCompanyId);
    setBinConfirmEmpty(false);
    loadBinItems();
  }

  function setBinAutoDeletePref(days) {
    setBinAutoDelete(days);
    localStorage.setItem('easybooks_bin_auto_delete', String(days));
  }

  function handleUiLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => updatePref('companyLogoUrl', ev.target.result);
    reader.readAsDataURL(file);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('settings.title', { defaultValue: 'Settings' })} subtitle={t('settings.subtitle', { defaultValue: 'Manage companies, users and preferences' })} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="companies">{t('settings.tabCompanies', { defaultValue: 'Companies' })}</TabsTrigger>
          <TabsTrigger value="users" onClick={loadUsers}>{t('settings.tabUsers', { defaultValue: 'Users' })}</TabsTrigger>
          <TabsTrigger value="preferences">{t('settings.tabPreferences', { defaultValue: 'Preferences' })}</TabsTrigger>
          <TabsTrigger value="automation" onClick={loadBankAccounts}>{t('settings.tabAutomation', { defaultValue: 'Automation' })}</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="recycle-bin" className="gap-1.5">
              <Recycle className="w-3.5 h-3.5" />{t('settings.tabRecycleBin', { defaultValue: 'Recycle Bin' })}
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Companies Tab ─────────────────────────────────────────────── */}
        <TabsContent value="companies" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddCompany(true)}><Plus className="w-4 h-4 mr-1" />{t('settings.addCompany', { defaultValue: 'Add Company' })}</Button>
          </div>
          <div className="grid gap-4">
            {companies.map(c => (
              <div key={c.id} className={`bg-card rounded-xl border p-5 flex items-start justify-between ${c.id === activeCompanyId ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{c.name}</h3>
                      {c.id === activeCompanyId && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full" title={t('settings.currentlyViewingHint', { defaultValue: "You're currently viewing this school" })}>{t('settings.active', { defaultValue: 'Active' })}</span>}
                      {c.is_active === false && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">{t('settings.deactivated', { defaultValue: 'Deactivated' })}</span>}
                      {c.business_type && (
                        <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                          {businessTypeLabel(c.business_type)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{c.address || t('settings.noAddress', { defaultValue: 'No address' })}</p>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      {c.phone && <span>{c.phone}</span>}
                      {c.email && <span>{c.email}</span>}
                      {c.pan_vat && <span>{t('settings.panWithValue', { defaultValue: 'PAN: {{value}}', value: c.pan_vat })}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={() => setEditingCompany({ ...c })}>{t('settings.edit', { defaultValue: 'Edit' })}</Button>
                  )}
                  {c.id !== activeCompanyId && (
                    <Button size="sm" variant="outline" onClick={() => { setActiveCompanyId(c.id); window.location.href = '/'; }}>{t('settings.setActive', { defaultValue: 'Set Active' })}</Button>
                  )}
                  {canDelete && (
                    <Button size="sm" variant="outline" onClick={() => toggleCompanyActive(c)}>
                      {c.is_active === false
                        ? <><Power className="w-3.5 h-3.5 mr-1.5" />{t('settings.reactivate', { defaultValue: 'Reactivate' })}</>
                        : <><PowerOff className="w-3.5 h-3.5 mr-1.5" />{t('settings.deactivate', { defaultValue: 'Deactivate' })}</>}
                    </Button>
                  )}
                  {canDelete && (
                    <Button size="icon" variant="ghost" onClick={() => deleteCompany(c.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {companies.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">{t('settings.noCompaniesYet', { defaultValue: 'No companies yet' })}</div>
            )}
          </div>
        </TabsContent>

        {/* ── Users Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="users" className="mt-4 space-y-4">
          {!isAdmin ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Shield className="w-10 h-10 opacity-30" />
              <p className="text-sm">{t('settings.adminOnlyManageUsers', { defaultValue: 'Only Admins can manage team members.' })}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t('settings.membersCount', { defaultValue: '{{count}} members in this company', count: users.length })}</p>
                {canManageUsers && (
                  <Button onClick={() => setShowInvite(true)}>
                    <UserPlus className="w-4 h-4 mr-1" />{t('settings.inviteUser', { defaultValue: 'Invite User' })}
                  </Button>
                )}
              </div>

              {usersLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid gap-3">
                  {users.map(u => (
                    <div key={u.id} className="bg-card rounded-xl border p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                          {u.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{u.name || t('settings.unknownUser', { defaultValue: 'Unknown' })}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isSuperAdmin && u.role === 'ADMIN' && (
                          <div className="flex items-center gap-1.5" title={t('settings.maxCompaniesHint', { defaultValue: 'How many companies this admin may self-serve create' })}>
                            <span className="text-xs text-muted-foreground">{t('settings.maxCompaniesLabel', { defaultValue: 'Max Companies' })}</span>
                            <input
                              type="number"
                              min={1}
                              className="w-14 text-xs border rounded-md px-1.5 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                              defaultValue={u.maxCompanies ?? 1}
                              disabled={maxCompaniesSaving === u.id}
                              onBlur={e => { if (Number(e.target.value) !== u.maxCompanies) handleMaxCompaniesChange(u.id, e.target.value); }}
                            />
                          </div>
                        )}
                        {u.id === user?.id ? (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-secondary'}`}>
                            {roleLabel(u.role)} {t('settings.youSuffix', { defaultValue: '(you)' })}
                          </span>
                        ) : u.role === 'SUPER_ADMIN' ? (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS.SUPER_ADMIN}`}>{roleLabel('SUPER_ADMIN')}</span>
                        ) : (
                          <select
                            className="text-xs border rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                            value={u.role}
                            disabled={roleChanging === u.id}
                            onChange={e => handleRoleChange(u.id, e.target.value)}
                          >
                            <option value="STAFF">{roleLabel('STAFF')}</option>
                            <option value="ACCOUNTANT">{roleLabel('ACCOUNTANT')}</option>
                            {isSchool && <option value="TEACHER">{roleLabel('TEACHER')}</option>}
                            {isSchool && <option value="LIBRARIAN">{roleLabel('LIBRARIAN')}</option>}
                            <option value="ADMIN">{roleLabel('ADMIN')}</option>
                          </select>
                        )}
                        {canManageUsers && u.id !== user?.id && u.role !== 'SUPER_ADMIN' && (
                          <button
                            onClick={() => handleRemoveUser(u)}
                            disabled={removingUserId === u.id}
                            className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50"
                            title={t('settings.removeFromCompany', { defaultValue: 'Remove from company' })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground text-sm">{t('settings.noUsersYet', { defaultValue: 'No users yet. Invite your team.' })}</div>
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Preferences Tab ───────────────────────────────────────────── */}
        <TabsContent value="preferences" className="mt-4 space-y-5">

          {/* Company Settings */}
          <div className="bg-card rounded-xl border p-6 space-y-5 max-w-lg">
            <h3 className="font-semibold">{t('settings.companySettingsHeading', { defaultValue: 'Company Settings' })}</h3>

            <div className="space-y-1.5">
              <Label>{t('settings.invoicePrefixLabel', { defaultValue: 'Invoice Prefix / Abbreviation' })}</Label>
              <Input placeholder={t('settings.invoicePrefixPlaceholder', { defaultValue: 'e.g. INV, ABC, XYZ' })} value={companyPrefs.abbreviation}
                onChange={e => setCompanyPrefs({ ...companyPrefs, abbreviation: e.target.value.toUpperCase().slice(0, 6) })} />
              <p className="text-xs text-muted-foreground">{t('settings.invoiceNumberHint', { defaultValue: 'Used in invoice numbers: ABC/2081-82/0001' })}</p>
            </div>

            <div className="space-y-1.5">
              <Label>{t('settings.workingDaysLabel', { defaultValue: 'Working Days per Month' })}</Label>
              <SmartNumberInput min={20} max={31} value={companyPrefs.workingDaysPerMonth}
                onChange={e => setCompanyPrefs({ ...companyPrefs, workingDaysPerMonth: parseInt(e.target.value) || 26 })} />
              <p className="text-xs text-muted-foreground">{t('settings.workingDaysHint', { defaultValue: 'Used for absent-day salary deduction (default: 26)' })}</p>
            </div>

            <div className="pt-1 border-t space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" />{t('settings.workingHoursHeading', { defaultValue: 'Working Hours & Attendance Deduction' })}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('settings.workingHoursSubtitle', { defaultValue: 'If enabled, staff who check in/out for fewer hours than expected get a prorated salary deduction — on top of absent-day deduction, not instead of it.' })}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={companyPrefs.attendanceDeductionEnabled}
                  onClick={() => setCompanyPrefs(p => ({ ...p, attendanceDeductionEnabled: !p.attendanceDeductionEnabled }))}
                  className={`relative shrink-0 w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                    companyPrefs.attendanceDeductionEnabled ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    companyPrefs.attendanceDeductionEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('settings.standardStartTimeLabel', { defaultValue: 'Standard Start Time' })}</Label>
                  <Input type="time" className="text-sm" value={companyPrefs.standardStartTime}
                    onChange={e => setCompanyPrefs({ ...companyPrefs, standardStartTime: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('settings.standardEndTimeLabel', { defaultValue: 'Standard End Time' })}</Label>
                  <Input type="time" className="text-sm" value={companyPrefs.standardEndTime}
                    onChange={e => setCompanyPrefs({ ...companyPrefs, standardEndTime: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('settings.workingHoursHint', { defaultValue: 'Applies to full-time staff. Part-time staff are judged against their own contracted hours/day, set per employee on the Employees page.' })}
              </p>
            </div>

            <div className="pt-1 border-t space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">{t('settings.systemDefaultsHeading', { defaultValue: 'System Defaults (read-only)' })}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('settings.currencyLabel', { defaultValue: 'Currency' })}</Label>
                  <Input value={t('settings.currencyValue', { defaultValue: 'NPR — Nepali Rupee' })} disabled className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs">{t('settings.vatRateLabel', { defaultValue: 'VAT Rate' })}</Label>
                  <Input value="13%" disabled className="text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-xs">{t('settings.fiscalYearLabel', { defaultValue: 'Fiscal Year' })}</Label>
                <Input value={t('settings.fiscalYearValue', { defaultValue: 'Shrawan 1 – Ashadh End (Nepali BS Calendar)' })} disabled className="text-sm" />
                <p className="text-xs text-muted-foreground mt-1">{t('settings.fiscalYearFixedHint', { defaultValue: "Nepal's fiscal year is fixed by law — not configurable." })}</p>
              </div>

              {fiscalYearStatus && (
                <div className="rounded-lg border p-3 space-y-2.5">
                  <p className="text-sm">{t('settings.currentlyIn', { defaultValue: 'Currently in:' })} <strong>{fiscalYearStatus.currentFiscalYear}</strong></p>

                  {fiscalYearStatus.closedYears.length > 0 && (
                    <div className="space-y-2 pt-1 border-t">
                      {fiscalYearStatus.closedYears.map(y => (
                        <div key={y.fiscalYear} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {y.fiscalYear} — {y.reopenedAt ? t('settings.reopened', { defaultValue: 'Reopened' }) : t('settings.closed', { defaultValue: 'Closed' })}
                            </span>
                            <span className={`font-medium tabular-nums ${y.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                              Rs. {Math.abs(y.netProfit).toLocaleString('en-NP')}{y.netProfit < 0 ? ` ${t('settings.loss', { defaultValue: 'loss' })}` : ''}
                            </span>
                          </div>
                          {isAdmin && !y.reopenedAt && (
                            reopeningYear === y.fiscalYear ? (
                              <div className="flex gap-1.5 items-center pl-2">
                                <Input
                                  type="password" placeholder={t('settings.enterPassword', { defaultValue: 'Password' })}
                                  value={reopenPassword} onChange={e => setReopenPassword(e.target.value)}
                                  className="h-7 text-xs"
                                />
                                <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" disabled={reopenSaving || !reopenPassword} onClick={() => handleReopenFiscalYear(y.fiscalYear)}>
                                  {reopenSaving ? t('settings.reopening', { defaultValue: 'Reopening…' }) : t('settings.confirm', { defaultValue: 'Confirm' })}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setReopeningYear(null); setReopenPassword(''); }}>{t('settings.cancel', { defaultValue: 'Cancel' })}</Button>
                              </div>
                            ) : (
                              <button type="button" className="text-xs text-muted-foreground underline hover:text-foreground pl-2" onClick={() => setReopeningYear(y.fiscalYear)}>
                                {t('settings.reopenFiscalYear', { defaultValue: 'Reopen' })}
                              </button>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {fiscalYearStatus.preview ? (
                    <div className="rounded-md bg-amber-50 border border-amber-200 p-2.5 space-y-2">
                      <p className="text-xs font-medium text-amber-800">
                        {t('settings.fiscalYearEndedNotClosed', { defaultValue: 'Fiscal year {{fy}} has ended and isn\'t closed yet.', fy: fiscalYearStatus.preview.fiscalYear })}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><p className="text-muted-foreground">{t('settings.income', { defaultValue: 'Income' })}</p><p className="font-medium tabular-nums">Rs. {fiscalYearStatus.preview.totalIncome.toLocaleString('en-NP')}</p></div>
                        <div><p className="text-muted-foreground">{t('settings.expense', { defaultValue: 'Expense' })}</p><p className="font-medium tabular-nums">Rs. {fiscalYearStatus.preview.totalExpense.toLocaleString('en-NP')}</p></div>
                        <div><p className="text-muted-foreground">{t('settings.net', { defaultValue: 'Net' })}</p><p className="font-medium tabular-nums">Rs. {fiscalYearStatus.preview.netProfit.toLocaleString('en-NP')}</p></div>
                      </div>
                      {isAdmin && (
                        confirmingClose ? (
                          <div className="space-y-2 pt-1">
                            <p className="text-xs text-amber-800">
                              {t('settings.closeFiscalYearWarning', { defaultValue: 'This posts closing entries and cannot be undone lightly. Enter your password to confirm closing {{fy}}.', fy: fiscalYearStatus.preview.fiscalYear })}
                            </p>
                            <Input
                              type="password" placeholder={t('settings.enterPassword', { defaultValue: 'Password' })}
                              value={closePassword} onChange={e => setClosePassword(e.target.value)}
                              className="h-8 text-sm"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" disabled={closingFiscalYear || !closePassword} onClick={handleCloseFiscalYear}>
                                {closingFiscalYear ? t('settings.closing', { defaultValue: 'Closing…' }) : t('settings.confirmClose', { defaultValue: 'Confirm Close' })}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => { setConfirmingClose(false); setClosePassword(''); }}>{t('settings.cancel', { defaultValue: 'Cancel' })}</Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setConfirmingClose(true)}>
                            {t('settings.closeFiscalYearButton', { defaultValue: 'Close Fiscal Year {{fy}}', fy: fiscalYearStatus.preview.fiscalYear })}
                          </Button>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('settings.noFiscalYearPendingClose', { defaultValue: 'No fiscal year is pending close.' })}</p>
                  )}
                </div>
              )}
            </div>

            <Button onClick={savePreferences} disabled={prefsSaving || !isAdmin} className="w-full">
              {prefsSaved ? <><Check className="w-4 h-4 mr-1" />{t('settings.saved', { defaultValue: 'Saved!' })}</> : prefsSaving ? t('settings.savingEllipsis', { defaultValue: 'Saving…' }) : <><Save className="w-4 h-4 mr-1" />{t('settings.savePreferences', { defaultValue: 'Save Preferences' })}</>}
            </Button>
            {!isAdmin && <p className="text-xs text-muted-foreground text-center">{t('settings.adminOnlyPreferences', { defaultValue: 'Only Admins can change preferences.' })}</p>}
          </div>

          {/* Package — SUPER_ADMIN only (platform-operator control, not self-service for the school's own admin) */}
          {isSuperAdmin && (
            <div className="bg-card rounded-xl border p-6 space-y-4 max-w-lg">
              <div>
                <h3 className="font-semibold flex items-center gap-1.5"><Layers className="w-4 h-4 text-primary" />{t('settings.packageHeading', { defaultValue: 'Package' })}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{t('settings.packageSubtitle', { defaultValue: 'Which features this company can access. Super-admin only — not visible to the school\'s own admin.' })}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['BASE', 'STANDARD', 'PREMIUM'].map(tier => (
                  <button
                    key={tier}
                    type="button"
                    disabled={packageSaving}
                    onClick={() => savePackage(tier)}
                    className={`rounded-lg border p-3 text-center text-sm font-medium transition-colors disabled:opacity-50 ${
                      currentPackageTier() === tier ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
                    }`}
                  >
                    {t(`settings.package${tier}`, { defaultValue: tier.charAt(0) + tier.slice(1).toLowerCase() })}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {currentPackageTier()
                  ? t('settings.currentPackage', { defaultValue: 'Current: {{tier}}', tier: currentPackageTier() })
                  : t('settings.noPackageSet', { defaultValue: 'No package set yet — this company currently has unrestricted (legacy) access to everything.' })}
                {packageSaved && <span className="text-emerald-600 ml-2 inline-flex items-center gap-1"><Check className="w-3 h-3" />{t('settings.saved', { defaultValue: 'Saved!' })}</span>}
              </p>
            </div>
          )}

          {/* Create Client — SUPER_ADMIN only (sales-led onboarding: creates the
              company + its first ADMIN login, instead of self-registration) */}
          {isSuperAdmin && (
            <div className="bg-card rounded-xl border p-6 space-y-4 max-w-lg">
              <div>
                <h3 className="font-semibold flex items-center gap-1.5"><UserPlus className="w-4 h-4 text-primary" />{t('settings.createClientHeading', { defaultValue: 'Create Client' })}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{t('settings.createClientSubtitle', { defaultValue: "Sets up a new client's company and their first admin login — for after they've paid, instead of self-registration." })}</p>
              </div>
              <form onSubmit={handleProvisionClient} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{t('settings.companyNameLabel', { defaultValue: 'Company / School Name' })}</Label>
                  <Input required value={provisionForm.companyName} onChange={e => setProvisionForm(f => ({ ...f, companyName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings.productLabel', { defaultValue: 'Product' })}</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={provisionForm.businessType}
                    onChange={e => setProvisionForm(f => ({ ...f, businessType: e.target.value }))}
                  >
                    <option value="SCHOOL">{t('settings.productSchool', { defaultValue: 'School Management System' })}</option>
                    <option value="OTHER">{t('settings.productOneBook', { defaultValue: 'OneBook (Business)' })}</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t('settings.adminNameLabel', { defaultValue: "Admin's Name" })}</Label>
                    <Input required value={provisionForm.adminName} onChange={e => setProvisionForm(f => ({ ...f, adminName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings.adminEmailLabel', { defaultValue: "Admin's Email" })}</Label>
                    <Input type="email" required value={provisionForm.adminEmail} onChange={e => setProvisionForm(f => ({ ...f, adminEmail: e.target.value }))} />
                  </div>
                </div>
                {provisionForm.businessType === 'SCHOOL' && (
                  <div className="space-y-1.5">
                    <Label>{t('settings.packageLabel', { defaultValue: 'Package' })}</Label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      value={provisionForm.package}
                      onChange={e => setProvisionForm(f => ({ ...f, package: e.target.value }))}
                    >
                      <option value="BASE">{t('settings.packageBASE', { defaultValue: 'Base' })}</option>
                      <option value="STANDARD">{t('settings.packageSTANDARD', { defaultValue: 'Standard' })}</option>
                      <option value="PREMIUM">{t('settings.packagePREMIUM', { defaultValue: 'Premium' })}</option>
                    </select>
                  </div>
                )}
                <Button type="submit" disabled={provisioning} className="w-full">
                  {provisioning ? t('settings.creatingClient', { defaultValue: 'Creating…' }) : t('settings.createClientButton', { defaultValue: 'Create Client & Send Login' })}
                </Button>
              </form>
            </div>
          )}

          {/* Appearance */}
          <div className="bg-card rounded-xl border p-6 space-y-6 max-w-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">{t('settings.appearanceHeading', { defaultValue: 'Appearance' })}</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetPrefs}
                className="text-muted-foreground gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />{t('settings.resetToDefaults', { defaultValue: 'Reset to Defaults' })}
              </Button>
            </div>

            {/* Company Logo */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />{t('settings.sidebarLogoLabel', { defaultValue: 'Sidebar Logo' })}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.sidebarLogoHint', { defaultValue: 'Replaces the Building icon in the sidebar top-left. Shows "Powered by GeoInfosys" badge below.' })}</p>
              <div className="flex items-center gap-3">
                {prefs.companyLogoUrl ? (
                  <div className="relative">
                    <img src={prefs.companyLogoUrl} alt="Sidebar logo" className="w-14 h-14 rounded-xl object-cover border shadow-sm" />
                    <button
                      type="button"
                      onClick={() => updatePref('companyLogoUrl', '')}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center shadow hover:scale-110 transition-transform"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-14 h-14 border-2 border-dashed border-muted-foreground/25 rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                    <ImagePlus className="w-4 h-4 text-muted-foreground mb-0.5" />
                    <span className="text-[10px] text-muted-foreground">{t('settings.uploadLabel', { defaultValue: 'Upload' })}</span>
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleUiLogoUpload} />
                  </label>
                )}
                {!prefs.companyLogoUrl && (
                  <p className="text-xs text-muted-foreground">{t('settings.fileSizeHint', { defaultValue: 'PNG, JPG, SVG up to 2 MB' })}</p>
                )}
              </div>
            </div>

            {/* Sidebar Color */}
            <div className="space-y-2">
              <Label>{t('settings.sidebarColorLabel', { defaultValue: 'Sidebar Background Color' })}</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {SIDEBAR_PALETTE.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updatePref('sidebarColor', c)}
                    title={c}
                    className="w-7 h-7 rounded-lg border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: prefs.sidebarColor === c ? 'hsl(var(--primary))' : 'transparent',
                      outline: prefs.sidebarColor === c ? '2px solid hsl(var(--primary))' : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
                <label
                  className="w-7 h-7 rounded-lg border-2 border-dashed border-muted-foreground/40 flex items-center justify-center cursor-pointer hover:border-primary/60 transition-colors overflow-hidden"
                  title={t('settings.customColor', { defaultValue: 'Custom color' })}
                  style={prefs.sidebarColor && !SIDEBAR_PALETTE.includes(prefs.sidebarColor) ? { backgroundColor: prefs.sidebarColor } : {}}
                >
                  <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="color"
                    className="sr-only"
                    value={prefs.sidebarColor || '#1e293b'}
                    onChange={e => updatePref('sidebarColor', e.target.value)}
                  />
                </label>
                {prefs.sidebarColor && (
                  <button
                    type="button"
                    onClick={() => updatePref('sidebarColor', '')}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    {t('settings.reset', { defaultValue: 'Reset' })}
                  </button>
                )}
              </div>
              {prefs.sidebarColor && (
                <p className="text-xs text-muted-foreground">{t('settings.currentColor', { defaultValue: 'Current: {{color}}', color: prefs.sidebarColor })}</p>
              )}
            </div>

            {/* Topbar Color */}
            <div className="space-y-2">
              <Label>{t('settings.topbarColorLabel', { defaultValue: 'Topbar Background Color' })}</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {TOPBAR_PALETTE.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updatePref('topbarColor', c)}
                    title={c}
                    className="w-7 h-7 rounded-lg border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: prefs.topbarColor === c ? 'hsl(var(--primary))' : '#e2e8f0',
                      outline: prefs.topbarColor === c ? '2px solid hsl(var(--primary))' : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
                <label
                  className="w-7 h-7 rounded-lg border-2 border-dashed border-muted-foreground/40 flex items-center justify-center cursor-pointer hover:border-primary/60 transition-colors overflow-hidden"
                  title={t('settings.customColor', { defaultValue: 'Custom color' })}
                  style={prefs.topbarColor && !TOPBAR_PALETTE.includes(prefs.topbarColor) ? { backgroundColor: prefs.topbarColor } : {}}
                >
                  <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="color"
                    className="sr-only"
                    value={prefs.topbarColor || '#ffffff'}
                    onChange={e => updatePref('topbarColor', e.target.value)}
                  />
                </label>
                {prefs.topbarColor && (
                  <button
                    type="button"
                    onClick={() => updatePref('topbarColor', '')}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    {t('settings.reset', { defaultValue: 'Reset' })}
                  </button>
                )}
              </div>
              {prefs.topbarColor && (
                <p className="text-xs text-muted-foreground">{t('settings.currentColor', { defaultValue: 'Current: {{color}}', color: prefs.topbarColor })}</p>
              )}
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Type className="w-3.5 h-3.5" />{t('settings.fontSizeLabel', { defaultValue: 'Font Size' })}</Label>
              <div className="flex gap-2">
                {FONT_SIZES.map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => updatePref('fontSize', f.key)}
                    className={`flex-1 flex flex-col items-center py-2.5 px-2 rounded-lg border-2 transition-all ${
                      prefs.fontSize === f.key
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <span className="font-semibold" style={{ fontSize: f.px }}>A</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">{t(FONT_SIZE_I18N_KEY[f.key], { defaultValue: f.label })}</span>
                    <span className="text-[9px] text-muted-foreground/60">{f.px}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" />{t('settings.notificationPreferencesLabel', { defaultValue: 'Notification Preferences' })}</Label>
              <div className="space-y-2">
                {[
                  { key: 'transactions', label: t('settings.notifTransactionsLabel', { defaultValue: 'Transaction Alerts' }), desc: t('settings.notifTransactionsDesc', { defaultValue: 'Low stock, stale cheques, expiring bank guarantees' }) },
                  { key: 'reminders',    label: t('settings.notifRemindersLabel', { defaultValue: 'Reminders' }),          desc: t('settings.notifRemindersDesc', { defaultValue: 'Payroll due, attendance missing, task deadlines' }) },
                  { key: 'system',       label: t('settings.notifSystemLabel', { defaultValue: 'System Notices' }),     desc: t('settings.notifSystemDesc', { defaultValue: 'Updates, maintenance, role changes' }) },
                ].map(n => (
                  <div key={n.key} className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{n.label}</p>
                      <p className="text-xs text-muted-foreground">{n.desc}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={prefs.notifications[n.key]}
                      onClick={() => {
                        const value = !prefs.notifications[n.key];
                        updatePref('notifications', { [n.key]: value });
                        notificationsApi.updatePreferences({ [n.key]: value }).catch(() => {});
                      }}
                      className={`relative shrink-0 w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                        prefs.notifications[n.key] ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                        prefs.notifications[n.key] ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Automation Tab ─────────────────────────────────────────────── */}
        <TabsContent value="automation" className="mt-4 space-y-6">
          <div className="bg-card rounded-xl border p-5 space-y-1">
            <h3 className="font-semibold flex items-center gap-1.5"><Zap className="w-4 h-4 text-primary" />{t('settings.automationTitle', { defaultValue: 'Nightly Automation (runs at 1 AM)' })}</h3>
            <p className="text-sm text-muted-foreground">{t('settings.automationSubtitle', { defaultValue: 'Turn off anything you\'d rather trigger manually.' })}</p>
          </div>

          <div className="bg-card rounded-xl border p-5 space-y-1 divide-y divide-border/50">
            {[
              ...(isSchool ? [
                { key: 'autoFeeBilling', label: t('settings.autoFeeBillingLabel', { defaultValue: 'Auto Fee Billing' }), desc: t('settings.autoFeeBillingDesc', { defaultValue: 'Automatically generate monthly fee invoices for every active student' }) },
                { key: 'autoInvoiceRelease', label: t('settings.autoInvoiceReleaseLabel', { defaultValue: 'Auto-Release Invoices' }), desc: t('settings.autoInvoiceReleaseDesc', { defaultValue: 'Immediately release auto-billed invoices to the student portal (notifies students). If off, invoices are created but held for manual review/release.' }) },
                { key: 'autoLibraryReminders', label: t('settings.autoLibraryRemindersLabel', { defaultValue: 'Library Due-Date Reminders' }), desc: t('settings.autoLibraryRemindersDesc', { defaultValue: 'Nightly "book due in 3 days" reminder to students in the portal' }) },
                { key: 'autoPaymentProofReminders', label: t('settings.autoPaymentProofRemindersLabel', { defaultValue: 'Payment Proof Reminders' }), desc: t('settings.autoPaymentProofRemindersDesc', { defaultValue: 'Nightly nudge to Admin/Accountant about payment proofs still awaiting review. Never auto-approves — a person always has to check the screenshot.' }) },
              ] : []),
              { key: 'autoPayroll', label: t('settings.autoPayrollLabel', { defaultValue: 'Auto Payroll Processing' }), desc: t('settings.autoPayrollDesc', { defaultValue: 'Automatically process monthly payroll for all employees' }) },
              { key: 'autoReconciliation', label: t('settings.autoReconciliationLabel', { defaultValue: 'Daily Reconciliation Summary' }), desc: t('settings.autoReconciliationDesc', { defaultValue: 'Nightly summary of income, expenses, overdue invoices and ledger balance sent to admins' }) },
            ].map(item => (
              <div key={item.key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={automation[item.key]}
                  onClick={() => setAutomation(a => ({ ...a, [item.key]: !a[item.key] }))}
                  className={`relative shrink-0 w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                    automation[item.key] ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    automation[item.key] ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            ))}
            <div className="pt-4 flex items-center gap-3">
              <Button onClick={saveAutomation} disabled={automationSaving}>
                <Save className="w-4 h-4 mr-1.5" />
                {automationSaving ? t('settings.saving', { defaultValue: 'Saving…' }) : t('settings.saveChanges', { defaultValue: 'Save Changes' })}
              </Button>
              {automationSaved && <span className="text-sm text-emerald-600 flex items-center gap-1"><Check className="w-4 h-4" />{t('settings.saved', { defaultValue: 'Saved' })}</span>}
            </div>
          </div>

          <div className="bg-card rounded-xl border p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold flex items-center gap-1.5"><QrCode className="w-4 h-4 text-primary" />{t('settings.paymentQrTitle', { defaultValue: 'Payment QR Codes' })}</h3>
                <p className="text-sm text-muted-foreground">{t('settings.paymentQrSubtitle', { defaultValue: 'Upload a photo of your eSewa, Khalti or bank QR code — it will print on every fee invoice so parents can scan to pay.' })}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowAddBank(true)} className="shrink-0">
                <Plus className="w-3.5 h-3.5 mr-1" />{t('settings.addBank', { defaultValue: 'Add Bank' })}
              </Button>
            </div>
            {bankAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">{t('settings.noBankAccountsYet', { defaultValue: 'No bank accounts set up yet.' })}</p>
            ) : (
              <div className="grid gap-3">
                {bankAccounts.map(b => (
                  <div key={b.id} className="flex items-center justify-between gap-4 border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      {b.qrCodeUrl ? (
                        <img src={resolveFileUrl(b.qrCodeUrl)} alt={b.bankName} className="w-14 h-14 object-contain border rounded-md p-1" />
                      ) : (
                        <div className="w-14 h-14 rounded-md border border-dashed flex items-center justify-center text-muted-foreground">
                          <QrCode className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium inline-flex items-center gap-1.5">
                          {b.bankName}
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground">
                            {b.paymentType === 'ESEWA' ? t('settings.paymentTypeEsewa', { defaultValue: 'eSewa' })
                              : b.paymentType === 'KHALTI' ? t('settings.paymentTypeKhalti', { defaultValue: 'Khalti' })
                              : t('settings.paymentTypeBank', { defaultValue: 'Bank' })}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">{b.accountNumber}</p>
                      </div>
                    </div>
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" disabled={qrUploadingId === b.id} onChange={e => handleQrUpload(b.id, e)} />
                      <span className="inline-flex items-center gap-1.5 text-sm border rounded-md px-3 py-1.5 hover:bg-secondary">
                        <Upload className="w-3.5 h-3.5" />
                        {qrUploadingId === b.id
                          ? t('settings.uploading', { defaultValue: 'Uploading…' })
                          : b.qrCodeUrl
                            ? t('settings.replaceQr', { defaultValue: 'Replace' })
                            : t('settings.uploadQr', { defaultValue: 'Upload QR' })}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Recycle Bin Tab ────────────────────────────────────────────── */}
        <TabsContent value="recycle-bin" className="mt-4 space-y-4">
          {!binAccessGranted ? (
            /* Password Gate */
            <div className="max-w-sm mx-auto mt-8">
              <div className="bg-card rounded-xl border p-8 space-y-5 text-center">
                <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{t('settings.binAdminAccessRequired', { defaultValue: 'Admin Access Required' })}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{t('settings.binAdminAccessDesc', { defaultValue: 'Enter your admin password to access the Recycle Bin.' })}</p>
                </div>
                <div className="space-y-2 text-left">
                  <input
                    type="password"
                    placeholder={t('settings.binPasswordPlaceholder', { defaultValue: 'Admin password' })}
                    value={binPassword}
                    onChange={e => { setBinPassword(e.target.value); setBinPasswordError(''); }}
                    onKeyDown={e => e.key === 'Enter' && verifyBinPassword()}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {binPasswordError && <p className="text-xs text-destructive">{binPasswordError}</p>}
                </div>
                <Button onClick={verifyBinPassword} disabled={binVerifying || !binPassword} className="w-full">
                  {binVerifying ? t('settings.verifyingEllipsis', { defaultValue: 'Verifying…' }) : t('settings.unlockRecycleBin', { defaultValue: 'Unlock Recycle Bin' })}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Header bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{t('settings.autoDeleteAfterLabel', { defaultValue: 'Auto-delete after:' })}</span>
                  </div>
                  <div className="flex gap-1">
                    {[
                      { v: 0, l: t('settings.autoDeleteNever', { defaultValue: 'Never' }) },
                      { v: 7, l: t('settings.autoDelete7Days', { defaultValue: '7 days' }) },
                      { v: 30, l: t('settings.autoDelete30Days', { defaultValue: '30 days' }) },
                      { v: 90, l: t('settings.autoDelete90Days', { defaultValue: '90 days' }) },
                    ].map(opt => (
                      <button
                        key={opt.v}
                        onClick={() => setBinAutoDeletePref(opt.v)}
                        className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                          binAutoDelete === opt.v ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'
                        }`}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={loadBinItems}>
                    <RotateCw className="w-3.5 h-3.5 mr-1" />{t('settings.refresh', { defaultValue: 'Refresh' })}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBinConfirmEmpty(true)}
                    disabled={!binItems || Object.values(binItems).every(arr => arr.length === 0)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />{t('settings.emptyBin', { defaultValue: 'Empty Bin' })}
                  </Button>
                </div>
              </div>

              {/* Confirm empty dialog */}
              {binConfirmEmpty && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium">{t('settings.confirmEmptyBinMessage', { defaultValue: 'Permanently delete ALL items in the bin?' })}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setBinConfirmEmpty(false)}>{t('settings.cancel', { defaultValue: 'Cancel' })}</Button>
                    <Button variant="destructive" size="sm" onClick={emptyBin}>{t('settings.yesEmptyBin', { defaultValue: 'Yes, empty bin' })}</Button>
                  </div>
                </div>
              )}

              {binLoading ? (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : !binItems || Object.values(binItems).every(arr => arr.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                  <Recycle className="w-12 h-12 opacity-20" />
                  <p className="text-sm font-medium">{t('settings.recycleBinEmpty', { defaultValue: 'Recycle bin is empty' })}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {[
                    { key: 'clients',   label: t('settings.sectionClients', { defaultValue: 'Clients' }),         icon: '👤', type: 'client',   nameKey: 'name',         subKey: 'email' },
                    { key: 'vendors',   label: t('settings.sectionVendors', { defaultValue: 'Vendors' }),         icon: '🏢', type: 'vendor',   nameKey: 'name',         subKey: 'phone' },
                    { key: 'employees', label: t('settings.sectionEmployees', { defaultValue: 'Employees' }),       icon: '👷', type: 'employee', nameKey: 'name',         subKey: 'designation' },
                    { key: 'inventory', label: t('settings.sectionInventoryItems', { defaultValue: 'Inventory Items' }), icon: '📦', type: 'inventory',nameKey: 'itemName',     subKey: 'brand' },
                    { key: 'sales',     label: t('settings.sectionSalesOrders', { defaultValue: 'Sales Orders' }),    icon: '🧾', type: 'sales',    nameKey: 'invoiceNumber',subKey: 'clientName' },
                    { key: 'purchases', label: t('settings.sectionPurchaseOrders', { defaultValue: 'Purchase Orders' }), icon: '🛒', type: 'purchase', nameKey: 'orderNumber',  subKey: 'vendorName' },
                    { key: 'tasks',     label: t('settings.sectionTasks', { defaultValue: 'Tasks' }),           icon: '✅', type: 'task',     nameKey: 'title',        subKey: 'assignedTo' },
                    { key: 'memos',     label: t('settings.sectionMemos', { defaultValue: 'Memos' }),           icon: '📝', type: 'memo',     nameKey: 'title',        subKey: 'documentType' },
                  ].filter(s => binItems[s.key]?.length > 0).map(section => (
                    <div key={section.key} className="bg-card rounded-xl border overflow-hidden">
                      <div className="px-4 py-3 bg-secondary/50 border-b flex items-center gap-2">
                        <span>{section.icon}</span>
                        <span className="font-medium text-sm">{section.label}</span>
                        <span className="ml-auto text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                          {binItems[section.key].length}
                        </span>
                      </div>
                      <div className="divide-y divide-border">
                        {binItems[section.key].map(item => (
                          <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item[section.nameKey] || '—'}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {item[section.subKey] && `${item[section.subKey]} · `}
                                {t('settings.deletedOn', { defaultValue: 'Deleted {{date}}', date: new Date(item.deletedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })}
                              </p>
                            </div>
                            <div className="flex gap-2 ml-3 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => restoreItem(item.id, section.type)}
                                className="h-7 text-xs gap-1"
                              >
                                <RotateCcw className="w-3 h-3" />{t('settings.restore', { defaultValue: 'Restore' })}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => permanentDeleteItem(item.id, section.type)}
                                className="h-7 text-xs text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Add Bank Account Dialog ───────────────────────────────────────── */}
      <Dialog open={showAddBank} onOpenChange={v => { setShowAddBank(v); if (!v) setBankForm({ bankName: '', accountNumber: '', accountType: '', branch: '', currentBalance: '', paymentType: 'BANK' }); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('settings.addBankAccount', { defaultValue: 'Add Bank Account' })}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddBank} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t('settings.paymentTypeLabel', { defaultValue: 'Payment Type *' })}</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={bankForm.paymentType}
                onChange={e => setBankForm(f => ({ ...f, paymentType: e.target.value }))}
              >
                <option value="BANK">{t('settings.paymentTypeBank', { defaultValue: 'Bank' })}</option>
                <option value="ESEWA">{t('settings.paymentTypeEsewa', { defaultValue: 'eSewa' })}</option>
                <option value="KHALTI">{t('settings.paymentTypeKhalti', { defaultValue: 'Khalti' })}</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {t('settings.paymentTypeHint', { defaultValue: 'Which "Paid To" list this account shows up in for staff and the student portal.' })}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>{t('settings.bankNameLabel', { defaultValue: 'Bank / Wallet Name *' })}</Label>
              <Input placeholder={t('settings.bankNamePlaceholder', { defaultValue: 'e.g. eSewa, Khalti, Nabil Bank' })} value={bankForm.bankName} onChange={e => setBankForm(f => ({ ...f, bankName: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>{t('settings.accountNumberLabel', { defaultValue: 'Account / Wallet Number *' })}</Label>
              <Input value={bankForm.accountNumber} onChange={e => setBankForm(f => ({ ...f, accountNumber: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('settings.accountTypeLabel', { defaultValue: 'Account Type' })}</Label>
                <Input placeholder={t('settings.accountTypePlaceholder', { defaultValue: 'Savings, Current…' })} value={bankForm.accountType} onChange={e => setBankForm(f => ({ ...f, accountType: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('settings.branchLabel', { defaultValue: 'Branch' })}</Label>
                <Input value={bankForm.branch} onChange={e => setBankForm(f => ({ ...f, branch: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('settings.openingBalanceLabel', { defaultValue: 'Opening Balance' })}</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={bankForm.currentBalance} onChange={e => setBankForm(f => ({ ...f, currentBalance: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddBank(false)}>{t('settings.cancel', { defaultValue: 'Cancel' })}</Button>
              <Button type="submit" disabled={addBankSaving}>
                {addBankSaving ? t('settings.saving', { defaultValue: 'Saving…' }) : t('settings.addBank', { defaultValue: 'Add Bank' })}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add Company Dialog ────────────────────────────────────────────── */}
      <Dialog open={showAddCompany} onOpenChange={setShowAddCompany}>
        <DialogContent className="glass-dialog max-w-3xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-800 to-blue-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />{t('settings.addCompanyDialogTitle', { defaultValue: 'Add Company' })}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 max-h-[65vh] overflow-hidden mt-2">
            {/* LEFT — Company Info */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="space-y-3 overflow-y-auto pr-1"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />{t('settings.companyInfoSection', { defaultValue: 'Company Info' })}
              </p>

              <LogoUpload value={companyForm.logo_url} onChange={url => setCompanyForm(f => ({ ...f, logo_url: url }))} onFile={e => handleLogoUpload(e, false)} uploading={uploadingLogo} />

              <div className="space-y-1">
                <Label>{t('settings.companyNameRequired', { defaultValue: 'Company Name *' })}</Label>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={companyForm.name} onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>{t('settings.businessTypeLabel', { defaultValue: 'Business Type' })}</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring mt-1"
                  value={BUSINESS_TYPES.some(b => b.value === companyForm.business_type) ? companyForm.business_type : (companyForm.business_type ? 'OTHER' : '')}
                  onChange={e => setCompanyForm({ ...companyForm, business_type: e.target.value })}
                >
                  <option value="">{t('settings.selectBusinessType', { defaultValue: 'Select business type…' })}</option>
                  {BUSINESS_TYPES.map(bt => <option key={bt.value} value={bt.value}>{businessTypeLabel(bt.value)}</option>)}
                </select>
                {companyForm.business_type === 'OTHER' && (
                  <Input className="mt-2" placeholder={t('settings.describeBusinessPlaceholder', { defaultValue: 'Describe your business (e.g. Tailoring Shop, Laundry)' })} autoFocus
                    value='' onChange={e => setCompanyForm({ ...companyForm, business_type: e.target.value })} />
                )}
                {companyForm.business_type && !BUSINESS_TYPES.some(b => b.value === companyForm.business_type) && companyForm.business_type !== 'OTHER' && (
                  <Input className="mt-2" placeholder={t('settings.describeBusinessShortPlaceholder', { defaultValue: 'Describe your business' })}
                    value={companyForm.business_type} onChange={e => setCompanyForm({ ...companyForm, business_type: e.target.value })} />
                )}
              </div>

              <div className="space-y-1">
                <Label>{t('settings.registrationNumberLabel', { defaultValue: 'Registration Number' })}</Label>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={companyForm.registration_number} onChange={e => setCompanyForm({ ...companyForm, registration_number: e.target.value })} />
                </div>
              </div>
            </motion.div>

            {/* RIGHT — Contact Details */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.06 }}
              className="space-y-3 overflow-y-auto pr-1"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />{t('settings.contactDetailsSection', { defaultValue: 'Contact Details' })}
              </p>

              <div className="space-y-1">
                <Label>{t('settings.addressLabel', { defaultValue: 'Address' })}</Label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={companyForm.address} onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>{t('settings.phoneLabel', { defaultValue: 'Phone' })}</Label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={companyForm.phone} onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>{t('settings.emailLabel', { defaultValue: 'Email' })}</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={companyForm.email} onChange={e => setCompanyForm({ ...companyForm, email: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>{t('settings.panVatLabel', { defaultValue: 'PAN/VAT Number' })}</Label>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8 h-9 text-sm" value={companyForm.pan_vat} onChange={e => setCompanyForm({ ...companyForm, pan_vat: e.target.value })} />
                </div>
              </div>
            </motion.div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowAddCompany(false)}>{t('settings.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={addCompany} disabled={!companyForm.name}>{t('settings.create', { defaultValue: 'Create' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Company Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!editingCompany} onOpenChange={() => setEditingCompany(null)}>
        <DialogContent className="glass-dialog max-w-3xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-800 to-blue-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />{t('settings.editCompanyDialogTitle', { defaultValue: 'Edit Company' })}
            </DialogTitle>
          </DialogHeader>

          {editingCompany && (
            <div className="grid grid-cols-2 gap-6 max-h-[65vh] overflow-hidden mt-2">
              {/* LEFT — Company Info */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="space-y-3 overflow-y-auto pr-1"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />{t('settings.companyInfoSection', { defaultValue: 'Company Info' })}
                </p>

                <LogoUpload value={editingCompany.logo_url} onChange={url => setEditingCompany(c => ({ ...c, logo_url: url }))} onFile={e => handleLogoUpload(e, true)} uploading={uploadingLogo} />

                <div className="space-y-1">
                  <Label>{t('settings.companyNameLabel', { defaultValue: 'Company Name' })}</Label>
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editingCompany.name} onChange={e => setEditingCompany({ ...editingCompany, name: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>{t('settings.businessTypeLabel', { defaultValue: 'Business Type' })}</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring mt-1"
                    value={BUSINESS_TYPES.some(b => b.value === editingCompany.business_type) ? editingCompany.business_type : (editingCompany.business_type ? 'OTHER' : '')}
                    onChange={e => setEditingCompany({ ...editingCompany, business_type: e.target.value })}
                  >
                    <option value="">{t('settings.selectBusinessType', { defaultValue: 'Select business type…' })}</option>
                    {BUSINESS_TYPES.map(bt => <option key={bt.value} value={bt.value}>{businessTypeLabel(bt.value)}</option>)}
                  </select>
                  {editingCompany.business_type === 'OTHER' && (
                    <Input className="mt-2" placeholder={t('settings.describeBusinessPlaceholder', { defaultValue: 'Describe your business (e.g. Tailoring Shop, Laundry)' })} autoFocus
                      value='' onChange={e => setEditingCompany({ ...editingCompany, business_type: e.target.value })} />
                  )}
                  {editingCompany.business_type && !BUSINESS_TYPES.some(b => b.value === editingCompany.business_type) && editingCompany.business_type !== 'OTHER' && (
                    <Input className="mt-2" placeholder={t('settings.describeBusinessShortPlaceholder', { defaultValue: 'Describe your business' })}
                      value={editingCompany.business_type} onChange={e => setEditingCompany({ ...editingCompany, business_type: e.target.value })} />
                  )}
                </div>

                <div className="space-y-1">
                  <Label>{t('settings.registrationNumberLabel', { defaultValue: 'Registration Number' })}</Label>
                  <div className="relative">
                    <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editingCompany.registration_number || ''} onChange={e => setEditingCompany({ ...editingCompany, registration_number: e.target.value })} />
                  </div>
                </div>
              </motion.div>

              {/* RIGHT — Contact Details */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: 0.06 }}
                className="space-y-3 overflow-y-auto pr-1"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />{t('settings.contactDetailsSection', { defaultValue: 'Contact Details' })}
                </p>

                <div className="space-y-1">
                  <Label>{t('settings.addressLabel', { defaultValue: 'Address' })}</Label>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editingCompany.address || ''} onChange={e => setEditingCompany({ ...editingCompany, address: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>{t('settings.phoneLabel', { defaultValue: 'Phone' })}</Label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editingCompany.phone || ''} onChange={e => setEditingCompany({ ...editingCompany, phone: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>{t('settings.emailLabel', { defaultValue: 'Email' })}</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editingCompany.email || ''} onChange={e => setEditingCompany({ ...editingCompany, email: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>{t('settings.panVatLabel', { defaultValue: 'PAN/VAT Number' })}</Label>
                  <div className="relative">
                    <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 h-9 text-sm" value={editingCompany.pan_vat || ''} onChange={e => setEditingCompany({ ...editingCompany, pan_vat: e.target.value })} />
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditingCompany(null)}>{t('settings.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={updateCompany}><Save className="w-4 h-4 mr-1" />{t('settings.save', { defaultValue: 'Save' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Invite User Dialog ────────────────────────────────────────────── */}
      <Dialog open={showInvite && !tempPassword} onOpenChange={v => { if (!v) { setShowInvite(false); setInviteForm({ name: '', email: '', role: 'STAFF' }); } }}>
        <DialogContent className="glass-dialog max-w-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-800 to-blue-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />{t('settings.inviteTeamMemberTitle', { defaultValue: 'Invite Team Member' })}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleInvite}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="space-y-4 mt-2"
            >
              {/* Full Name */}
              <div className="space-y-1">
                <Label>{t('settings.fullNameRequired', { defaultValue: 'Full Name *' })}</Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    placeholder={t('settings.fullNamePlaceholder', { defaultValue: 'Ram Sharma' })}
                    value={inviteForm.name}
                    onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <Label>{t('settings.emailRequired', { defaultValue: 'Email *' })}</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="email"
                    className="pl-8 h-9 text-sm"
                    placeholder={t('settings.emailPlaceholder', { defaultValue: 'ram@company.com' })}
                    value={inviteForm.email}
                    onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Role chips */}
              <div className="space-y-2">
                <Label>{t('settings.roleRequired', { defaultValue: 'Role *' })}</Label>
                <div className="flex flex-col gap-2">
                  {[
                    { v: 'STAFF', label: t('settings.roleStaffLabel', { defaultValue: 'Staff' }), desc: t('settings.roleStaffDesc', { defaultValue: 'Day-to-day operations' }) },
                    { v: 'ACCOUNTANT', label: t('settings.roleAccountantLabel', { defaultValue: 'Accountant' }), desc: t('settings.roleAccountantDesc', { defaultValue: 'Full financial access' }) },
                    ...(isSchool ? [
                      { v: 'TEACHER', label: t('settings.roleTeacherLabel', { defaultValue: 'Teacher' }), desc: t('settings.roleTeacherDesc', { defaultValue: 'Attendance, exams, homework, materials' }) },
                      { v: 'LIBRARIAN', label: t('settings.roleLibrarianLabel', { defaultValue: 'Librarian' }), desc: t('settings.roleLibrarianDesc', { defaultValue: 'Library books, issues and returns' }) },
                    ] : []),
                  ].map(r => (
                    <button
                      key={r.v}
                      type="button"
                      onClick={() => setInviteForm({ ...inviteForm, role: r.v })}
                      className={`flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left w-full ${inviteForm.role === r.v ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                    >
                      <span className="text-sm font-semibold">{r.label}</span>
                      <span className="text-xs text-muted-foreground">{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{t('settings.tempPasswordNotice', { defaultValue: 'A temporary password will be generated. Share it with the user so they can log in.' })}</p>
            </motion.div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => { setShowInvite(false); setInviteForm({ name: '', email: '', role: 'STAFF' }); }}>{t('settings.cancel', { defaultValue: 'Cancel' })}</Button>
              <Button type="submit" disabled={inviteLoading}>{inviteLoading ? t('settings.invitingEllipsis', { defaultValue: 'Inviting…' }) : t('settings.sendInvite', { defaultValue: 'Send Invite' })}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Temp Password Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!tempPassword} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('settings.userInvitedTitle', { defaultValue: 'User Invited' })}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('settings.tempPasswordDesc', { defaultValue: 'The user has been created. Share this temporary password with them — they should change it after first login.' })}</p>
            <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-3">
              <code className="flex-1 text-sm font-mono tracking-widest">{tempPassword}</code>
              <button type="button" onClick={copyTempPassword} className="text-muted-foreground hover:text-foreground transition-colors">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={closeTempPasswordDialog}>{t('settings.done', { defaultValue: 'Done' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LogoUpload({ value, onChange, onFile, uploading }) {
  const { t } = useTranslation();
  return (
    <div>
      <Label className="text-sm font-medium mb-2 block">{t('settings.companyLogoLabel', { defaultValue: 'Company Logo' })}</Label>
      {value ? (
        <div className="relative w-16 h-16">
          <img src={value} alt="logo" className="w-16 h-16 rounded-lg object-cover border shadow-sm" />
          <button type="button" onClick={() => onChange('')}
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:scale-110 transition-transform">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-16 h-16 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
          <ImagePlus className="w-4 h-4 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">{t('settings.logoLabel', { defaultValue: 'Logo' })}</span>
          <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
        </label>
      )}
    </div>
  );
}
