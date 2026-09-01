import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, GraduationCap, X, ArrowRight, KeyRound, Upload, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BulkImportDialog from '@/components/shared/BulkImportDialog';
import { STUDENT_FIELDS } from '@/components/shared/bulkImportFields';
import { studentsApi, classesApi, portalApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { useRole } from '@/lib/useRole';
import { confirm } from '@/lib/confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const EMPTY_FORM = {
  name: '', rollNumber: '', examRollNumber: '', classId: '', gender: '', dateOfBirth: '',
  address: '', guardianName: '', guardianPhone: '', guardianEmail: '',
};

function StudentDialog({ open, onClose, initial, classes, companyId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(
    initial
      ? { ...EMPTY_FORM, ...initial, dateOfBirth: initial.dateOfBirth ? initial.dateOfBirth.split('T')[0] : '' }
      : EMPTY_FORM,
  );
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [errors, setErrors] = useState({});

  const save = useMutation({
    mutationFn: (data) =>
      isEdit ? studentsApi.update(initial.id, data) : studentsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['school-dashboard'] });
      toast.success(isEdit ? t('students.studentUpdated', { defaultValue: 'Student updated' }) : t('students.studentEnrolled', { defaultValue: 'Student enrolled' }));
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('students.failedToSaveStudent', { defaultValue: 'Failed to save student' })),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrors({ name: t('students.nameRequired', { defaultValue: 'Student name is required' }) });
      toast.error(t('students.nameRequired', { defaultValue: 'Student name is required' }));
      return;
    }
    setErrors({});
    save.mutate({ ...form, companyId });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('students.editStudent', { defaultValue: 'Edit Student' }) : t('students.enrollNewStudent', { defaultValue: 'Enroll New Student' })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>{t('students.fullName', { defaultValue: 'Full Name *' })}</Label>
              <Input placeholder={t('students.fullNamePlaceholder', { defaultValue: 'Student full name' })} value={form.name} onChange={e => { set('name', e.target.value); if (errors.name) setErrors({}); }} />
              {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>{t('students.rollNumber', { defaultValue: 'Roll Number' })}</Label>
              <Input placeholder={t('students.rollNumberPlaceholder', { defaultValue: 'e.g. 101' })} value={form.rollNumber} onChange={e => set('rollNumber', e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>{t('students.examRollNumber', { defaultValue: 'Exam Roll Number' })}</Label>
              <Input placeholder={t('students.examRollNumberPlaceholder', { defaultValue: 'e.g. 20821234' })} value={form.examRollNumber} onChange={e => set('examRollNumber', e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>{t('students.class', { defaultValue: 'Class' })}</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.classId}
                onChange={e => set('classId', e.target.value)}
              >
                <option value="">{t('students.selectClass', { defaultValue: 'Select class…' })}</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.section ? ` (${c.section})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>{t('students.gender', { defaultValue: 'Gender' })}</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.gender}
                onChange={e => set('gender', e.target.value)}
              >
                <option value="">{t('students.select', { defaultValue: 'Select…' })}</option>
                <option value="Male">{t('students.male', { defaultValue: 'Male' })}</option>
                <option value="Female">{t('students.female', { defaultValue: 'Female' })}</option>
                <option value="Other">{t('students.other', { defaultValue: 'Other' })}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>{t('students.dateOfBirth', { defaultValue: 'Date of Birth' })}</Label>
              <Input type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>{t('students.address', { defaultValue: 'Address' })}</Label>
              <Input placeholder={t('students.addressPlaceholder', { defaultValue: 'Student address' })} value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
          </div>

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">{t('students.guardianDetails', { defaultValue: 'Guardian Details' })}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>{t('students.guardianName', { defaultValue: 'Guardian Name' })}</Label>
              <Input placeholder={t('students.guardianNamePlaceholder', { defaultValue: 'Parent / Guardian name' })} value={form.guardianName} onChange={e => set('guardianName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('students.guardianPhone', { defaultValue: 'Guardian Phone' })}</Label>
              <Input placeholder={t('students.phonePlaceholder', { defaultValue: '98XXXXXXXX' })} value={form.guardianPhone} onChange={e => set('guardianPhone', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('students.guardianEmail', { defaultValue: 'Guardian Email' })}</Label>
              <Input type="email" placeholder={t('students.guardianEmailPlaceholder', { defaultValue: 'guardian@email.com' })} value={form.guardianEmail} onChange={e => set('guardianEmail', e.target.value)} />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>{t('students.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? t('students.saving', { defaultValue: 'Saving…' }) : isEdit ? t('students.saveChanges', { defaultValue: 'Save Changes' }) : t('students.enrollStudent', { defaultValue: 'Enroll Student' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PortalPasswordDialog({ open, onClose, student, companyId }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ phone: student?.guardianPhone || '', password: '', type: 'PARENT' });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const portalLink = `${window.location.origin}/portal/login?company=${companyId}`;

  function copyPortalLink() {
    navigator.clipboard.writeText(portalLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.phone.trim()) errs.phone = t('students.phoneRequired', { defaultValue: 'Phone number is required' });
    if (form.password.length < 6) errs.password = t('students.passwordMinLength', { defaultValue: 'Password must be at least 6 characters' });
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error(errs.phone || errs.password);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await portalApi.setPassword({ studentId: student.id, ...form, companyId });
      toast.success(t('students.portalAccessSetFor', { defaultValue: "Portal access set for {{name}}'s {{type}}", name: student.name, type: form.type.toLowerCase() }));
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('students.failedToSetPassword', { defaultValue: 'Failed to set password' }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('students.setPortalAccess', { defaultValue: 'Set Portal Access' })}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          {t('students.setCredentialsPrefix', { defaultValue: 'Set login credentials for' })} <strong>{student?.name}</strong>{t('students.setCredentialsSuffix', { defaultValue: "'s portal access." })}
        </p>
        <div className="space-y-1.5">
          <Label>{t('students.portalLoginLink', { defaultValue: 'Portal Login Link' })}</Label>
          <div className="flex gap-2">
            <Input readOnly value={portalLink} className="text-xs" onFocus={e => e.target.select()} />
            <Button type="button" variant="outline" size="icon" onClick={copyPortalLink} className="shrink-0">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('students.portalLoginLinkHint', { defaultValue: 'Share this link with the phone number and password below — it pre-fills the School ID so they only enter their credentials.' })}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>{t('students.accessType', { defaultValue: 'Access Type' })}</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="PARENT">{t('students.parent', { defaultValue: 'Parent' })}</option>
              <option value="STUDENT">{t('students.student', { defaultValue: 'Student' })}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('students.phoneNumber', { defaultValue: 'Phone Number *' })}</Label>
            <Input placeholder={t('students.phonePlaceholder', { defaultValue: '98XXXXXXXX' })} value={form.phone} onChange={e => { set('phone', e.target.value); if (errors.phone) setErrors(er => ({ ...er, phone: undefined })); }} />
            {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
            <p className="text-xs text-muted-foreground">{t('students.loginUsernameHint', { defaultValue: 'This will be the login username' })}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('students.password', { defaultValue: 'Password *' })}</Label>
            <Input type="password" placeholder={t('students.passwordPlaceholder', { defaultValue: 'Min 6 characters' })} value={form.password} onChange={e => { set('password', e.target.value); if (errors.password) setErrors(er => ({ ...er, password: undefined })); }} />
            {errors.password && <p className="text-xs text-red-600">{errors.password}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('students.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={loading}>{loading ? t('students.setting', { defaultValue: 'Setting…' }) : t('students.setPortalAccess', { defaultValue: 'Set Portal Access' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PromoteDialog({ open, onClose, classes, companyId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [fromClassId, setFromClassId] = useState('');
  const [toClassId, setToClassId] = useState('');
  const [selected, setSelected] = useState([]);

  const { data: students = [] } = useQuery({
    queryKey: ['students-for-promote', fromClassId],
    queryFn: () => studentsApi.list(fromClassId).then(r => r.data.filter(s => s.status === 'ACTIVE')),
    enabled: !!fromClassId,
  });

  const promote = useMutation({
    mutationFn: () => studentsApi.promote({ companyId, fromClassId, toClassId, studentIds: selected }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['students'] });
      toast.success(t('students.studentsPromoted', { defaultValue: '{{count}} students promoted', count: r.data.promoted }));
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || t('students.failedToPromote', { defaultValue: 'Failed to promote' })),
  });

  const toggleAll = () => setSelected(selected.length === students.length ? [] : students.map(s => s.id));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t('students.promoteStudents', { defaultValue: 'Promote Students' })}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t('students.fromClass', { defaultValue: 'From Class *' })}</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={fromClassId} onChange={e => { setFromClassId(e.target.value); setSelected([]); }}>
                <option value="">{t('students.select', { defaultValue: 'Select…' })}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>{t('students.toClass', { defaultValue: 'To Class *' })}</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={toClassId} onChange={e => setToClassId(e.target.value)}>
                <option value="">{t('students.select', { defaultValue: 'Select…' })}</option>
                {classes.filter(c => c.id !== fromClassId).map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>)}
              </select>
            </div>
          </div>

          {fromClassId && students.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>{t('students.selectStudents', { defaultValue: 'Select Students ({{selected}}/{{total}})', selected: selected.length, total: students.length })}</Label>
                <button className="text-xs text-primary underline" onClick={toggleAll}>
                  {selected.length === students.length ? t('students.deselectAll', { defaultValue: 'Deselect All' }) : t('students.selectAll', { defaultValue: 'Select All' })}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                {students.map(s => (
                  <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer">
                    <input type="checkbox" checked={selected.includes(s.id)} onChange={() =>
                      setSelected(p => p.includes(s.id) ? p.filter(id => id !== s.id) : [...p, s.id])
                    } />
                    <span className="text-sm">{s.name} {s.rollNumber ? `(${s.rollNumber})` : ''}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {fromClassId && students.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">{t('students.noActiveStudents', { defaultValue: 'No active students in this class' })}</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('students.cancel', { defaultValue: 'Cancel' })}</Button>
          <Button
            onClick={() => promote.mutate()}
            disabled={promote.isPending || selected.length === 0 || !toClassId}
          >
            <ArrowRight className="w-4 h-4 mr-1" />
            {promote.isPending ? t('students.promoting', { defaultValue: 'Promoting…' }) : t('students.promoteCount', { defaultValue: 'Promote {{count}} Students', count: selected.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PAGE_SIZE = 50;

export default function Students() {
  const { t } = useTranslation();
  const companyId = getActiveCompanyId();
  const { canCreateRecords, canEditRecords, canDeleteRecords, isAdmin, isAccountant, isTeacher, isLibrarian } = useRole();
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const [promoteDialog, setPromoteDialog] = useState(false);
  const [portalDialog, setPortalDialog] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  // Debounce the search box so we don't hit the server on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [search, filterClass]);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes', companyId],
    queryFn: () => classesApi.list().then(r => r.data),
    enabled: !!companyId,
  });

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['students', companyId, filterClass, search, page],
    queryFn: () => studentsApi.list({ classId: filterClass || undefined, search: search || undefined, page, pageSize: PAGE_SIZE }).then(r => r.data),
    enabled: !!companyId,
    placeholderData: (prev) => prev,
  });

  // Server always paginates here (page is always set), so `data` is `{ data, total }`
  const students = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const remove = useMutation({
    mutationFn: (id) => studentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['school-dashboard'] });
      toast.success(t('students.studentRemoved', { defaultValue: 'Student removed' }));
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('students.failedToRemoveStudent', { defaultValue: 'Failed to remove student' })),
  });

  const classLabel = (classId) => {
    const c = classes.find(c => c.id === classId);
    return c ? `${c.name}${c.section ? ` (${c.section})` : ''}` : '—';
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('students.title', { defaultValue: 'Students' })}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('students.enrolled', { defaultValue: '{{count}} enrolled', count: total })}</p>
        </div>
        <div className="flex gap-2">
          {!isTeacher && !isLibrarian && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-1" /> {t('students.import', { defaultValue: 'Import' })}
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={() => setPromoteDialog(true)}>
              <ArrowRight className="w-4 h-4 mr-1" /> {t('students.promote', { defaultValue: 'Promote' })}
            </Button>
          )}
          {canCreateRecords && (
            <Button onClick={() => setDialog({ mode: 'add' })}>
              <Plus className="w-4 h-4 mr-2" /> {t('students.enrollStudent', { defaultValue: 'Enroll Student' })}
            </Button>
          )}
        </div>
      </div>

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="students"
        title={t('students.importStudents', { defaultValue: 'Import Students' })}
        fields={STUDENT_FIELDS}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ['students'] });
          qc.invalidateQueries({ queryKey: ['classes'] });
          qc.invalidateQueries({ queryKey: ['school-dashboard'] });
        }}
      />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('students.searchPlaceholder', { defaultValue: 'Search by name or roll number…' })}
            className="pl-9"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring min-w-[160px]"
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
        >
          <option value="">{t('students.allClasses', { defaultValue: 'All Classes' })}</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.section ? ` (${c.section})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">{t('students.loadingStudents', { defaultValue: 'Loading students…' })}</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center">
            <GraduationCap className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {search || filterClass ? t('students.noMatch', { defaultValue: 'No students match your search' }) : t('students.noStudentsYet', { defaultValue: 'No students enrolled yet' })}
            </p>
            {!search && !filterClass && canCreateRecords && (
              <Button className="mt-4" size="sm" onClick={() => setDialog({ mode: 'add' })}>
                {t('students.enrollFirstStudent', { defaultValue: 'Enroll First Student' })}
              </Button>
            )}
          </div>
        ) : (
          <div className={`overflow-x-auto ${isPlaceholderData ? 'opacity-60 transition-opacity' : ''}`}>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('students.studentHeader', { defaultValue: 'Student' })}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('students.rollNoHeader', { defaultValue: 'Roll No.' })}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('students.classHeader', { defaultValue: 'Class' })}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('students.guardianHeader', { defaultValue: 'Guardian' })}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('students.phoneHeader', { defaultValue: 'Phone' })}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('students.statusHeader', { defaultValue: 'Status' })}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map(student => (
                  <tr key={student.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium">{student.name}</td>
                    <td className="px-5 py-3 text-muted-foreground tabular-nums">{student.rollNumber || '—'}</td>
                    <td className="px-5 py-3 text-muted-foreground">{classLabel(student.classId)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{student.guardianName || '—'}</td>
                    <td className="px-5 py-3 text-muted-foreground">{student.guardianPhone || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        student.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {t(`students.status_${student.status}`, { defaultValue: student.status })}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {(isAdmin || isAccountant) && (
                          <button
                            onClick={() => setPortalDialog(student)}
                            className="p-1.5 rounded hover:bg-emerald-50 text-muted-foreground hover:text-emerald-700 transition-colors"
                            title={t('students.setPortalAccess', { defaultValue: 'Set Portal Access' })}
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canEditRecords && (
                          <button
                            onClick={() => setDialog({ mode: 'edit', student })}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecords && (
                          <button
                            onClick={async () => {
                              const ok = await confirm({ description: t('students.confirmRemove', { defaultValue: 'Remove {{name}}?', name: student.name }), variant: 'destructive' });
                              if (!ok) return;
                              remove.mutate(student.id);
                            }}
                            className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
            <span className="text-muted-foreground">
              {t('students.pageInfo', {
                defaultValue: 'Page {{page}} of {{totalPages}} · {{total}} students',
                page, totalPages, total,
              })}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <ChevronLeft className="w-4 h-4 mr-1" /> {t('students.prevPage', { defaultValue: 'Previous' })}
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                {t('students.nextPage', { defaultValue: 'Next' })} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {dialog && (
        <StudentDialog
          open={!!dialog}
          onClose={() => setDialog(null)}
          initial={dialog.mode === 'edit' ? dialog.student : null}
          classes={classes}
          companyId={companyId}
        />
      )}

      {promoteDialog && (
        <PromoteDialog
          open={promoteDialog}
          onClose={() => setPromoteDialog(false)}
          classes={classes}
          companyId={companyId}
        />
      )}

      {portalDialog && (
        <PortalPasswordDialog
          open={!!portalDialog}
          onClose={() => setPortalDialog(null)}
          student={portalDialog}
          companyId={companyId}
        />
      )}
    </div>
  );
}
