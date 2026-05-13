import { useState, useEffect } from 'react';
import { api } from '@/api/adapter';
import { getActiveCompanyId, setActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Building2, Plus, Trash2, Save, ImagePlus, X } from 'lucide-react';

export default function Settings() {
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({ 
    name: '', 
    address: '', 
    phone: '', 
    email: '', 
    pan_vat: '', 
    registration_number: '',
    business_type: '',
    default_unit_type: '',
    currency: 'NPR',
    logo_url: ''
  });
  const [editingCompany, setEditingCompany] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [companyList, userList] = await Promise.all([
      api.Company.list(),
      Promise.resolve([]),
    ]);
    setCompanies(companyList);
    setUsers(userList);
    setLoading(false);
  }

  async function addCompany() {
    await api.Company.create({ 
      ...companyForm, 
      logo_url: companyForm.logo_url,
      is_active: true 
    });
    setCompanyForm({ name: '', address: '', phone: '', email: '', pan_vat: '', registration_number: '', business_type: '', default_unit_type: '', currency: 'NPR', logo_url: '' });
    setShowAddCompany(false);
    loadData();
  }

  async function updateCompany() {
    if (!editingCompany) return;
    await api.Company.update(editingCompany.id, {
      ...editingCompany,
      logo_url: editingCompany.logo_url
    });
    setEditingCompany(null);
    loadData();
  }

  async function deleteCompany(id) {
    if (!confirm('Are you sure you want to delete this company?')) return;
    await api.Company.delete(id);
    if (getActiveCompanyId() === id) {
      const remaining = companies.filter(c => c.id !== id);
      if (remaining.length > 0) setActiveCompanyId(remaining[0].id);
    }
    loadData();
  }

  async function handleLogoUpload(e, isEditing = false) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      // For now, create a local URL. In production, you'd upload to a cloud storage
      const file_url = URL.createObjectURL(file);
      if (isEditing && editingCompany) {
        setEditingCompany({ ...editingCompany, logo_url: file_url });
      } else {
        setCompanyForm({ ...companyForm, logo_url: file_url });
      }
    } catch (error) {
      alert('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Settings" subtitle="Manage companies, users and preferences" />

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddCompany(true)}><Plus className="w-4 h-4 mr-1" />Add Company</Button>
          </div>
          <div className="grid gap-4">
            {companies.map(c => (
              <div key={c.id} className="bg-card rounded-xl border p-5 flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">{c.name}</h3>
                    <p className="text-sm text-muted-foreground">{c.address || 'No address'}</p>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      {c.phone && <span>{c.phone}</span>}
                      {c.email && <span>{c.email}</span>}
                      {c.pan_vat && <span>PAN: {c.pan_vat}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingCompany({ ...c })}>Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setActiveCompanyId(c.id);
                    window.location.href = '/';
                  }}>Set Active</Button>
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

        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="grid gap-3">
            {users.map(u => (
              <div key={u.id} className="bg-card rounded-xl border p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                    {u.full_name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-medium">{u.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                <span className="text-xs bg-secondary px-2 py-1 rounded-full capitalize">{u.role || 'user'}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="preferences" className="mt-4">
          <div className="bg-card rounded-xl border p-6 space-y-4 max-w-lg">
            <h3 className="font-semibold">App Preferences</h3>
            <div>
              <Label>Default Currency</Label>
              <Input value="NPR" disabled />
            </div>
            <div>
              <Label>Fiscal Year Format</Label>
              <Input value="Shrawan - Ashadh (BS Calendar)" disabled />
            </div>
            <div>
              <Label>VAT Rate</Label>
              <Input value="13%" disabled />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Company Dialog */}
      <Dialog open={showAddCompany} onOpenChange={setShowAddCompany}>
        <DialogContent className="max-w-md max-h-96 overflow-y-auto">
          <DialogHeader><DialogTitle>Add Company</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium mb-2 block">Company Logo</Label>
              {companyForm.logo_url ? (
                <div className="relative w-16 h-16">
                  <img src={companyForm.logo_url} alt="logo preview" className="w-16 h-16 rounded-lg object-cover border shadow-sm" />
                  <button type="button" onClick={() => setCompanyForm(f => ({ ...f, logo_url: '' }))} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:scale-110 transition-transform">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-16 h-16 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  <ImagePlus className="w-4 h-4 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground text-center">Logo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, false)} disabled={uploadingLogo} />
                </label>
              )}
            </div>
            <div><Label>Company Name *</Label><Input value={companyForm.name} onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} /></div>
            <div><Label>Business Type</Label><Input placeholder="e.g. pharmacy, tea-shop" value={companyForm.business_type} onChange={e => setCompanyForm({ ...companyForm, business_type: e.target.value })} /></div>
            <div><Label>Registration Number</Label><Input value={companyForm.registration_number} onChange={e => setCompanyForm({ ...companyForm, registration_number: e.target.value })} /></div>
            <div><Label>Default Unit Type</Label><Input placeholder="e.g. pcs, meter, tablet" value={companyForm.default_unit_type} onChange={e => setCompanyForm({ ...companyForm, default_unit_type: e.target.value })} /></div>
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

      {/* Edit Company Dialog */}
      <Dialog open={!!editingCompany} onOpenChange={() => setEditingCompany(null)}>
        <DialogContent className="max-w-md max-h-96 overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Company</DialogTitle></DialogHeader>
          {editingCompany && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium mb-2 block">Company Logo</Label>
                {editingCompany.logo_url ? (
                  <div className="relative w-16 h-16">
                    <img src={editingCompany.logo_url} alt="logo preview" className="w-16 h-16 rounded-lg object-cover border shadow-sm" />
                    <button type="button" onClick={() => setEditingCompany({ ...editingCompany, logo_url: '' })} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:scale-110 transition-transform">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-16 h-16 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                    <ImagePlus className="w-4 h-4 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground text-center">Logo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, true)} disabled={uploadingLogo} />
                  </label>
                )}
              </div>
              <div><Label>Company Name</Label><Input value={editingCompany.name} onChange={e => setEditingCompany({ ...editingCompany, name: e.target.value })} /></div>
              <div><Label>Business Type</Label><Input placeholder="e.g. pharmacy, tea-shop" value={editingCompany.business_type || ''} onChange={e => setEditingCompany({ ...editingCompany, business_type: e.target.value })} /></div>
              <div><Label>Registration Number</Label><Input value={editingCompany.registration_number || ''} onChange={e => setEditingCompany({ ...editingCompany, registration_number: e.target.value })} /></div>
              <div><Label>Default Unit Type</Label><Input placeholder="e.g. pcs, meter, tablet" value={editingCompany.default_unit_type || ''} onChange={e => setEditingCompany({ ...editingCompany, default_unit_type: e.target.value })} /></div>
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
    </div>
  );
}