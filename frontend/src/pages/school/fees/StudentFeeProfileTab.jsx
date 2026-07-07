import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { schoolFinanceApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import StudentCombobox from '@/components/shared/StudentCombobox';
import { GraduationCap, Bus, Home, Package, Award, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const fmtRs = (n) => `Rs. ${Number(n ?? 0).toLocaleString('en-NP', { minimumFractionDigits: 2 })}`;

const SOURCE_META = {
  CLASS: { icon: GraduationCap, cls: 'text-blue-600 bg-blue-50' },
  TRANSPORT: { icon: Bus, cls: 'text-sky-600 bg-sky-50' },
  HOSTEL: { icon: Home, cls: 'text-violet-600 bg-violet-50' },
  PACKAGE: { icon: Package, cls: 'text-emerald-600 bg-emerald-50' },
  SCHOLARSHIP: { icon: Award, cls: 'text-amber-600 bg-amber-50' },
};

function ScholarshipDialog({ open, onClose, studentId, feeHeads, onDone }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', type: 'PERCENT', value: '', feeHeadId: '' });

  const save = useMutation({
    mutationFn: () => schoolFinanceApi.addScholarship(studentId, {
      name: form.name,
      type: form.type,
      value: Number(form.value),
      feeHeadId: form.feeHeadId || null,
    }),
    onSuccess: () => { toast.success(t('feeProfile.scholarshipAdded', { defaultValue: 'Scholarship added' })); onDone(); onClose(); },
    onError: (e) => toast.error(e.response?.data?.message || t('feeProfile.failed', { defaultValue: 'Failed' })),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error(t('feeProfile.nameRequired', { defaultValue: 'Name is required' }));
    if (!(Number(form.value) > 0)) return toast.error(t('feeProfile.valueRequired', { defaultValue: 'Enter a valid value' }));
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('feeProfile.addScholarship', { defaultValue: 'Add Scholarship / Discount' })}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t('feeProfile.scholarshipName', { defaultValue: 'Name *' })}</Label>
            <Input placeholder={t('feeProfile.scholarshipNamePlaceholder', { defaultValue: 'e.g. Dalit Scholarship, Sibling Discount' })} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('feeProfile.type', { defaultValue: 'Type' })}</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="PERCENT">{t('feeProfile.percent', { defaultValue: 'Percent (%)' })}</option>
                <option value="FIXED">{t('feeProfile.fixed', { defaultValue: 'Fixed (Rs.)' })}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('feeProfile.value', { defaultValue: 'Value *' })}</Label>
              <Input type="number" min="0" step="0.01" placeholder={form.type === 'PERCENT' ? '50' : '500'} value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('feeProfile.appliesTo', { defaultValue: 'Applies To' })}</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.feeHeadId} onChange={e => setForm(f => ({ ...f, feeHeadId: e.target.value }))}>
              <option value="">{t('feeProfile.allFees', { defaultValue: 'All fees (whole bill)' })}</option>
              {feeHeads.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('feeProfile.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('feeProfile.saving', { defaultValue: 'Saving…' }) : t('feeProfile.add', { defaultValue: 'Add' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function StudentFeeProfileTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [studentId, setStudentId] = useState('');
  const [scholarshipDialog, setScholarshipDialog] = useState(false);

  const { data: feeHeads = [] } = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => schoolFinanceApi.listFeeHeads().then(r => r.data),
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['fee-packages'],
    queryFn: () => schoolFinanceApi.listPackages().then(r => r.data),
  });

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ['fee-profile', studentId],
    queryFn: () => schoolFinanceApi.studentFeeProfile(studentId).then(r => r.data),
    enabled: !!studentId,
  });

  const assignPackage = useMutation({
    mutationFn: (packageId) => schoolFinanceApi.assignPackage(studentId, packageId || null),
    onSuccess: () => { toast.success(t('feeProfile.packageUpdated', { defaultValue: 'Package updated' })); refetch(); },
    onError: (e) => toast.error(e.response?.data?.message || t('feeProfile.failed', { defaultValue: 'Failed' })),
  });

  const removeScholarship = useMutation({
    mutationFn: (id) => schoolFinanceApi.removeScholarship(id),
    onSuccess: () => { toast.success(t('feeProfile.scholarshipRemoved', { defaultValue: 'Scholarship removed' })); refetch(); },
    onError: (e) => toast.error(e.response?.data?.message || t('feeProfile.failed', { defaultValue: 'Failed' })),
  });

  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-xl p-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5 w-80">
          <Label>{t('feeProfile.student', { defaultValue: 'Student' })}</Label>
          <StudentCombobox
            value={studentId}
            onChange={setStudentId}
            placeholder={t('feeProfile.selectStudent', { defaultValue: 'Select a student…' })}
          />
        </div>
        {profile && (
          <div className="space-y-1.5 w-64">
            <Label>{t('feeProfile.package', { defaultValue: 'Fee Package' })}</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={profile.student.packageId || ''}
              onChange={e => assignPackage.mutate(e.target.value)}
            >
              <option value="">{t('feeProfile.noPackage', { defaultValue: '— No package (itemized) —' })}</option>
              {packages.filter(p => p.isActive).map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.price != null ? ` — ${fmtRs(p.price)}` : ''}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!studentId ? (
        <div className="p-12 text-center text-muted-foreground text-sm bg-white border border-border rounded-xl">
          {t('feeProfile.pickPrompt', { defaultValue: 'Pick a student to see their complete monthly fee composition — class fees, bus, hostel, package and scholarships.' })}
        </div>
      ) : isLoading ? (
        <div className="p-12 text-center text-muted-foreground text-sm">{t('feeProfile.loading', { defaultValue: 'Loading…' })}</div>
      ) : profile ? (
        <>
          {profile.conflicts.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-1">
              {profile.conflicts.map((c, i) => (
                <p key={i} className="text-sm text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {c}
                </p>
              ))}
            </div>
          )}

          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-semibold">{profile.student.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {profile.student.className}
                  {profile.student.rollNumber ? ` · ${t('feeProfile.roll', { defaultValue: 'Roll {{roll}}', roll: profile.student.rollNumber })}` : ''}
                  {profile.student.packageName ? ` · ${profile.student.packageName}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('feeProfile.monthlyTotal', { defaultValue: 'Monthly Total' })}</p>
                <p className="text-2xl font-bold tabular-nums">{fmtRs(profile.monthlyTotal)}</p>
              </div>
            </div>

            <div className="divide-y">
              {profile.lines.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {t('feeProfile.noFees', { defaultValue: 'No fees apply — set up fee structures for this class first.' })}
                </div>
              ) : profile.lines.map((line, i) => {
                const meta = SOURCE_META[line.source] || SOURCE_META.CLASS;
                const Icon = meta.icon;
                return (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <div className={`p-2 rounded-lg shrink-0 ${meta.cls}`}><Icon className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{line.description}</p>
                      <p className="text-xs text-muted-foreground">{line.headName}</p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${line.amount < 0 ? 'text-emerald-600' : ''}`}>
                      {line.amount < 0 ? `− ${fmtRs(Math.abs(line.amount))}` : fmtRs(line.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-border rounded-xl">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm">{t('feeProfile.scholarships', { defaultValue: 'Scholarships & Discounts' })}</h3>
              <Button size="sm" variant="outline" onClick={() => setScholarshipDialog(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> {t('feeProfile.add', { defaultValue: 'Add' })}
              </Button>
            </div>
            {profile.scholarships.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">{t('feeProfile.noScholarships', { defaultValue: 'No scholarships or discounts for this student.' })}</p>
            ) : (
              <div className="divide-y">
                {profile.scholarships.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <Award className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.type === 'PERCENT' ? `${s.value}%` : fmtRs(s.value)} · {s.feeHeadName || t('feeProfile.allFees', { defaultValue: 'All fees (whole bill)' })}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => {
                      if (window.confirm(t('feeProfile.removeScholarshipConfirm', { defaultValue: 'Remove this scholarship?' }))) removeScholarship.mutate(s.id);
                    }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {scholarshipDialog && (
            <ScholarshipDialog
              open={scholarshipDialog}
              onClose={() => setScholarshipDialog(false)}
              studentId={studentId}
              feeHeads={feeHeads.filter(h => h.isActive)}
              onDone={() => { refetch(); qc.invalidateQueries({ queryKey: ['fee-invoices'] }); }}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
