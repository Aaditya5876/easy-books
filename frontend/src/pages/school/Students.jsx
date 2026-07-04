import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, GraduationCap, X, ArrowRight, KeyRound, Upload } from 'lucide-react';
import BulkImportDialog from '@/components/shared/BulkImportDialog';
import { STUDENT_FIELDS } from '@/components/shared/bulkImportFields';
import { studentsApi, classesApi, portalApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const EMPTY_FORM = {
  name: '', rollNumber: '', classId: '', gender: '', dateOfBirth: '',
  address: '', guardianName: '', guardianPhone: '', guardianEmail: '',
};

function StudentDialog({ open, onClose, initial, classes, companyId }) {
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(
    initial
      ? { ...EMPTY_FORM, ...initial, dateOfBirth: initial.dateOfBirth ? initial.dateOfBirth.split('T')[0] : '' }
      : EMPTY_FORM,
  );
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (data) =>
      isEdit ? studentsApi.update(initial.id, data) : studentsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['school-dashboard'] });
      toast.success(isEdit ? 'Student updated' : 'Student enrolled');
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to save student'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Student name is required'); return; }
    save.mutate({ ...form, companyId });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Student' : 'Enroll New Student'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Full Name *</Label>
              <Input placeholder="Student full name" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Roll Number</Label>
              <Input placeholder="e.g. 101" value={form.rollNumber} onChange={e => set('rollNumber', e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Class</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.classId}
                onChange={e => set('classId', e.target.value)}
              >
                <option value="">Select class…</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.section ? ` (${c.section})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Gender</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.gender}
                onChange={e => set('gender', e.target.value)}
              >
                <option value="">Select…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Input type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input placeholder="Student address" value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
          </div>

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Guardian Details</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Guardian Name</Label>
              <Input placeholder="Parent / Guardian name" value={form.guardianName} onChange={e => set('guardianName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Guardian Phone</Label>
              <Input placeholder="98XXXXXXXX" value={form.guardianPhone} onChange={e => set('guardianPhone', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Guardian Email</Label>
              <Input type="email" placeholder="guardian@email.com" value={form.guardianEmail} onChange={e => set('guardianEmail', e.target.value)} />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Enroll Student'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PortalPasswordDialog({ open, onClose, student, companyId }) {
  const [form, setForm] = useState({ phone: student?.guardianPhone || '', password: '', type: 'PARENT' });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.phone.trim()) { toast.error('Phone number is required'); return; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await portalApi.setPassword({ studentId: student.id, ...form, companyId });
      toast.success(`Portal access set for ${student.name}'s ${form.type.toLowerCase()}`);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Portal Access</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          Set login credentials for <strong>{student?.name}</strong>'s portal access.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Access Type</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="PARENT">Parent</option>
              <option value="STUDENT">Student</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Phone Number *</Label>
            <Input placeholder="98XXXXXXXX" value={form.phone} onChange={e => set('phone', e.target.value)} />
            <p className="text-xs text-muted-foreground">This will be the login username</p>
          </div>
          <div className="space-y-1.5">
            <Label>Password *</Label>
            <Input type="password" placeholder="Min 6 characters" value={form.password} onChange={e => set('password', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Setting…' : 'Set Portal Access'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PromoteDialog({ open, onClose, classes, companyId }) {
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
      toast.success(`${r.data.promoted} students promoted`);
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to promote'),
  });

  const toggleAll = () => setSelected(selected.length === students.length ? [] : students.map(s => s.id));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Promote Students</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>From Class *</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={fromClassId} onChange={e => { setFromClassId(e.target.value); setSelected([]); }}>
                <option value="">Select…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>To Class *</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={toClassId} onChange={e => setToClassId(e.target.value)}>
                <option value="">Select…</option>
                {classes.filter(c => c.id !== fromClassId).map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>)}
              </select>
            </div>
          </div>

          {fromClassId && students.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Select Students ({selected.length}/{students.length})</Label>
                <button className="text-xs text-primary underline" onClick={toggleAll}>
                  {selected.length === students.length ? 'Deselect All' : 'Select All'}
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
            <div className="text-sm text-muted-foreground text-center py-4">No active students in this class</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => promote.mutate()}
            disabled={promote.isPending || selected.length === 0 || !toClassId}
          >
            <ArrowRight className="w-4 h-4 mr-1" />
            {promote.isPending ? 'Promoting…' : `Promote ${selected.length} Students`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Students() {
  const companyId = getActiveCompanyId();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [dialog, setDialog] = useState(null);
  const [promoteDialog, setPromoteDialog] = useState(false);
  const [portalDialog, setPortalDialog] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes', companyId],
    queryFn: () => classesApi.list().then(r => r.data),
    enabled: !!companyId,
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students', companyId, filterClass],
    queryFn: () => studentsApi.list(filterClass || undefined).then(r => r.data),
    enabled: !!companyId,
  });

  const remove = useMutation({
    mutationFn: (id) => studentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['school-dashboard'] });
      toast.success('Student removed');
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to remove student'),
  });

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.rollNumber || '').includes(search)
  );

  const classLabel = (classId) => {
    const c = classes.find(c => c.id === classId);
    return c ? `${c.name}${c.section ? ` (${c.section})` : ''}` : '—';
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-muted-foreground text-sm mt-1">{students.length} enrolled</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-1" /> Import
          </Button>
          <Button variant="outline" onClick={() => setPromoteDialog(true)}>
            <ArrowRight className="w-4 h-4 mr-1" /> Promote
          </Button>
          <Button onClick={() => setDialog({ mode: 'add' })}>
            <Plus className="w-4 h-4 mr-2" /> Enroll Student
          </Button>
        </div>
      </div>

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="students"
        title="Import Students"
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
            placeholder="Search by name or roll number…"
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring min-w-[160px]"
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
        >
          <option value="">All Classes</option>
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
          <div className="p-12 text-center text-muted-foreground text-sm">Loading students…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <GraduationCap className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {search || filterClass ? 'No students match your search' : 'No students enrolled yet'}
            </p>
            {!search && !filterClass && (
              <Button className="mt-4" size="sm" onClick={() => setDialog({ mode: 'add' })}>
                Enroll First Student
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Roll No.</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Class</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Guardian</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(student => (
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
                        {student.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setPortalDialog(student)}
                          className="p-1.5 rounded hover:bg-emerald-50 text-muted-foreground hover:text-emerald-700 transition-colors"
                          title="Set Portal Access"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDialog({ mode: 'edit', student })}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${student.name}?`)) remove.mutate(student.id);
                          }}
                          className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
