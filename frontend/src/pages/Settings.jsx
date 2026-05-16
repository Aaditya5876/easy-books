import { useState, useEffect } from 'react';
import { api } from '@/api/adapter';
import { usersApi, companyApi } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { getActiveCompanyId, setActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Building2, Plus, Trash2, Save, ImagePlus, X, UserPlus, Copy, Check, Shield } from 'lucide-react';

const ROLE_COLORS = {
  ADMIN: 'bg-red-100 text-red-700',
  ACCOUNTANT: 'bg-blue-100 text-blue-700',
  STAFF: 'bg-green-100 text-green-700',
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
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

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const activeCompanyId = getActiveCompanyId();

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

  // ── Preferences ───────────────────────────────────────────────────────────
  const [prefs, setPrefs] = useState({
    abbreviation: '', workingDaysPerMonth: 26,
  });
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  useEffect(() => { loadCompanies(); }, []);

  async function loadCompanies() {
    setLoading(true);
    const [list, payrollRes] = await Promise.all([
      api.Company.list(),
      activeCompanyId ? companyApi.getPayrollSettings(activeCompanyId).catch(() => null) : null,
    ]);
    setCompanies(list);
    const active = list.find(c => c.id === activeCompanyId);
    setPrefs({
      abbreviation: active?.abbreviation || '',
      workingDaysPerMonth: payrollRes?.data?.workingDaysPerMonth ?? 26,
    });
    setLoading(false);
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
    await api.Company.create({ ...companyForm, is_active: true });
    setCompanyForm({ name: '', address: '', phone: '', email: '', pan_vat: '', registration_number: '', business_type: '', default_unit_type: '', currency: 'NPR', logo_url: '' });
    setShowAddCompany(false);
    loadCompanies();
  }

  async function updateCompany() {
    if (!editingCompany) return;
    await api.Company.update(editingCompany.id, editingCompany);
    setEditingCompany(null);
    loadCompanies();
  }

  async function deleteCompany(id) {
    if (!confirm('Are you sure you want to delete this company?')) return;
    await api.Company.delete(id);
    if (getActiveCompanyId() === id) {
      const remaining = companies.filter(c => c.id !== id);
      if (remaining.length > 0) setActiveCompanyId(remaining[0].id);
    }
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
      alert(err?.response?.data?.message || 'Failed to invite user');
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
      alert(err?.response?.data?.message || 'Failed to change role');
    } finally {
      setRoleChanging(null);
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
        companyApi.update(activeCompanyId, { abbreviation: prefs.abbreviation || undefined }),
        companyApi.upsertPayrollSettings(activeCompanyId, {
          workingDaysPerMonth: Number(prefs.workingDaysPerMonth),
        }),
      ]);
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2000);
    } catch {
      alert('Failed to save preferences');
    } finally {
      setPrefsSaving(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Settings" subtitle="Manage companies, users and preferences" />

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="users" onClick={loadUsers}>Users</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        {/* ── Companies Tab ─────────────────────────────────────────────── */}
        <TabsContent value="companies" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddCompany(true)}><Plus className="w-4 h-4 mr-1" />Add Company</Button>
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
                      {c.id === activeCompanyId && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Active</span>}
                      {c.business_type && (
                        <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                          {BUSINESS_TYPE_LABELS[c.business_type] || c.business_type}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{c.address || 'No address'}</p>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      {c.phone && <span>{c.phone}</span>}
                      {c.email && <span>{c.email}</span>}
                      {c.pan_vat && <span>PAN: {c.pan_vat}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingCompany({ ...c })}>Edit</Button>
                  {c.id !== activeCompanyId && (
                    <Button size="sm" variant="outline" onClick={() => { setActiveCompanyId(c.id); window.location.href = '/'; }}>Set Active</Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => deleteCompany(c.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {companies.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No companies yet</div>
            )}
          </div>
        </TabsContent>

        {/* ── Users Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="users" className="mt-4 space-y-4">
          {!isAdmin ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Shield className="w-10 h-10 opacity-30" />
              <p className="text-sm">Only Admins can manage team members.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{users.length} member{users.length !== 1 ? 's' : ''} in this company</p>
                <Button onClick={() => setShowInvite(true)}>
                  <UserPlus className="w-4 h-4 mr-1" />Invite User
                </Button>
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
                          <p className="font-medium text-sm">{u.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {u.id === user?.sub ? (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-secondary'}`}>
                            {u.role} (you)
                          </span>
                        ) : u.role === 'SUPER_ADMIN' ? (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS.SUPER_ADMIN}`}>SUPER_ADMIN</span>
                        ) : (
                          <select
                            className="text-xs border rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                            value={u.role}
                            disabled={roleChanging === u.id}
                            onChange={e => handleRoleChange(u.id, e.target.value)}
                          >
                            <option value="STAFF">STAFF</option>
                            <option value="ACCOUNTANT">ACCOUNTANT</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground text-sm">No users yet. Invite your team.</div>
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Preferences Tab ───────────────────────────────────────────── */}
        <TabsContent value="preferences" className="mt-4">
          <div className="bg-card rounded-xl border p-6 space-y-5 max-w-lg">
            <h3 className="font-semibold">Company Preferences</h3>

            <div className="space-y-1.5">
              <Label>Invoice Prefix / Abbreviation</Label>
              <Input placeholder="e.g. INV, ABC, XYZ" value={prefs.abbreviation}
                onChange={e => setPrefs({ ...prefs, abbreviation: e.target.value.toUpperCase().slice(0, 6) })} />
              <p className="text-xs text-muted-foreground">Used in invoice numbers: ABC/2081-82/0001</p>
            </div>

            <div className="space-y-1.5">
              <Label>Working Days per Month</Label>
              <Input type="number" min={20} max={31} value={prefs.workingDaysPerMonth}
                onChange={e => setPrefs({ ...prefs, workingDaysPerMonth: parseInt(e.target.value) || 26 })} />
              <p className="text-xs text-muted-foreground">Used for absent-day salary deduction (default: 26)</p>
            </div>

            <div className="pt-1 border-t space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">System Defaults (read-only)</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Currency</Label>
                  <Input value="NPR — Nepali Rupee" disabled className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs">VAT Rate</Label>
                  <Input value="13%" disabled className="text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Fiscal Year</Label>
                <Input value="Shrawan 1 – Ashadh End (Nepali BS Calendar)" disabled className="text-sm" />
              </div>
            </div>

            <Button onClick={savePreferences} disabled={prefsSaving || !isAdmin} className="w-full">
              {prefsSaved ? <><Check className="w-4 h-4 mr-1" />Saved!</> : prefsSaving ? 'Saving…' : <><Save className="w-4 h-4 mr-1" />Save Preferences</>}
            </Button>
            {!isAdmin && <p className="text-xs text-muted-foreground text-center">Only Admins can change preferences.</p>}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Add Company Dialog ────────────────────────────────────────────── */}
      <Dialog open={showAddCompany} onOpenChange={setShowAddCompany}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Company</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <LogoUpload value={companyForm.logo_url} onChange={url => setCompanyForm(f => ({ ...f, logo_url: url }))} onFile={e => handleLogoUpload(e, false)} uploading={uploadingLogo} />
            <div><Label>Company Name *</Label><Input value={companyForm.name} onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} /></div>
            <div>
              <Label>Business Type</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring mt-1"
                value={BUSINESS_TYPES.some(b => b.value === companyForm.business_type) ? companyForm.business_type : (companyForm.business_type ? 'OTHER' : '')}
                onChange={e => setCompanyForm({ ...companyForm, business_type: e.target.value })}
              >
                <option value="">Select business type…</option>
                {BUSINESS_TYPES.map(bt => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
              </select>
              {companyForm.business_type === 'OTHER' && (
                <Input className="mt-2" placeholder="Describe your business (e.g. Tailoring Shop, Laundry)" autoFocus
                  value='' onChange={e => setCompanyForm({ ...companyForm, business_type: e.target.value })} />
              )}
              {companyForm.business_type && !BUSINESS_TYPES.some(b => b.value === companyForm.business_type) && companyForm.business_type !== 'OTHER' && (
                <Input className="mt-2" placeholder="Describe your business"
                  value={companyForm.business_type} onChange={e => setCompanyForm({ ...companyForm, business_type: e.target.value })} />
              )}
            </div>
            <div><Label>Registration Number</Label><Input value={companyForm.registration_number} onChange={e => setCompanyForm({ ...companyForm, registration_number: e.target.value })} /></div>
            <div><Label>Address</Label><Input value={companyForm.address} onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={companyForm.phone} onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={companyForm.email} onChange={e => setCompanyForm({ ...companyForm, email: e.target.value })} /></div>
            </div>
            <div><Label>PAN/VAT Number</Label><Input value={companyForm.pan_vat} onChange={e => setCompanyForm({ ...companyForm, pan_vat: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCompany(false)}>Cancel</Button>
            <Button onClick={addCompany} disabled={!companyForm.name}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Company Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!editingCompany} onOpenChange={() => setEditingCompany(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Company</DialogTitle></DialogHeader>
          {editingCompany && (
            <div className="space-y-3">
              <LogoUpload value={editingCompany.logo_url} onChange={url => setEditingCompany(c => ({ ...c, logo_url: url }))} onFile={e => handleLogoUpload(e, true)} uploading={uploadingLogo} />
              <div><Label>Company Name</Label><Input value={editingCompany.name} onChange={e => setEditingCompany({ ...editingCompany, name: e.target.value })} /></div>
              <div>
                <Label>Business Type</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring mt-1"
                  value={BUSINESS_TYPES.some(b => b.value === editingCompany.business_type) ? editingCompany.business_type : (editingCompany.business_type ? 'OTHER' : '')}
                  onChange={e => setEditingCompany({ ...editingCompany, business_type: e.target.value })}
                >
                  <option value="">Select business type…</option>
                  {BUSINESS_TYPES.map(bt => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
                </select>
                {editingCompany.business_type === 'OTHER' && (
                  <Input className="mt-2" placeholder="Describe your business (e.g. Tailoring Shop, Laundry)" autoFocus
                    value='' onChange={e => setEditingCompany({ ...editingCompany, business_type: e.target.value })} />
                )}
                {editingCompany.business_type && !BUSINESS_TYPES.some(b => b.value === editingCompany.business_type) && editingCompany.business_type !== 'OTHER' && (
                  <Input className="mt-2" placeholder="Describe your business"
                    value={editingCompany.business_type} onChange={e => setEditingCompany({ ...editingCompany, business_type: e.target.value })} />
                )}
              </div>
              <div><Label>Registration Number</Label><Input value={editingCompany.registration_number || ''} onChange={e => setEditingCompany({ ...editingCompany, registration_number: e.target.value })} /></div>
              <div><Label>Address</Label><Input value={editingCompany.address || ''} onChange={e => setEditingCompany({ ...editingCompany, address: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Phone</Label><Input value={editingCompany.phone || ''} onChange={e => setEditingCompany({ ...editingCompany, phone: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={editingCompany.email || ''} onChange={e => setEditingCompany({ ...editingCompany, email: e.target.value })} /></div>
              </div>
              <div><Label>PAN/VAT Number</Label><Input value={editingCompany.pan_vat || ''} onChange={e => setEditingCompany({ ...editingCompany, pan_vat: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCompany(null)}>Cancel</Button>
            <Button onClick={updateCompany}><Save className="w-4 h-4 mr-1" />Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Invite User Dialog ────────────────────────────────────────────── */}
      <Dialog open={showInvite && !tempPassword} onOpenChange={v => { if (!v) { setShowInvite(false); setInviteForm({ name: '', email: '', role: 'STAFF' }); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
          <form onSubmit={handleInvite} className="space-y-3">
            <div>
              <Label>Full Name *</Label>
              <Input placeholder="Ram Sharma" value={inviteForm.name}
                onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })} required />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" placeholder="ram@company.com" value={inviteForm.email}
                onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} required />
            </div>
            <div>
              <Label>Role *</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={inviteForm.role}
                onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
              >
                <option value="STAFF">Staff — Day-to-day operations</option>
                <option value="ACCOUNTANT">Accountant — Full financial access</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">A temporary password will be generated. Share it with the user so they can log in.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowInvite(false); setInviteForm({ name: '', email: '', role: 'STAFF' }); }}>Cancel</Button>
              <Button type="submit" disabled={inviteLoading}>{inviteLoading ? 'Inviting…' : 'Send Invite'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Temp Password Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!tempPassword} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>User Invited</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">The user has been created. Share this temporary password with them — they should change it after first login.</p>
            <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-3">
              <code className="flex-1 text-sm font-mono tracking-widest">{tempPassword}</code>
              <button type="button" onClick={copyTempPassword} className="text-muted-foreground hover:text-foreground transition-colors">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={closeTempPasswordDialog}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LogoUpload({ value, onChange, onFile, uploading }) {
  return (
    <div>
      <Label className="text-sm font-medium mb-2 block">Company Logo</Label>
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
          <span className="text-xs text-muted-foreground">Logo</span>
          <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
        </label>
      )}
    </div>
  );
}
