import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, School } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { classesApi, employeeApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const EMPTY_FORM = { name: '', section: '', classTeacherId: '' };

function ClassDialog({ open, onClose, initial, employees, companyId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(initial ? { name: initial.name, section: initial.section || '', classTeacherId: initial.classTeacherId || '' } : EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (data) =>
      isEdit ? classesApi.update(initial.id, data) : classesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success(isEdit ? t('classes.classUpdated', { defaultValue: 'Class updated' }) : t('classes.classCreated', { defaultValue: 'Class created' }));
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('classes.failedToSaveClass', { defaultValue: 'Failed to save class' })),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      const msg = t('classes.classNameRequired', { defaultValue: 'Class name is required' });
      setErrors({ name: msg });
      toast.error(msg);
      return;
    }
    setErrors({});
    save.mutate({ ...form, companyId });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('classes.editClass', { defaultValue: 'Edit Class' }) : t('classes.createClass', { defaultValue: 'Create Class' })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t('classes.className', { defaultValue: 'Class Name *' })}</Label>
            <Input placeholder={t('classes.classNamePlaceholder', { defaultValue: 'e.g. Grade 5, Class 10' })} value={form.name} onChange={e => { set('name', e.target.value); if (errors.name) setErrors({}); }} />
            {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{t('classes.section', { defaultValue: 'Section' })} <span className="text-muted-foreground">{t('classes.optional', { defaultValue: '(Optional)' })}</span></Label>
            <Input placeholder={t('classes.sectionPlaceholder', { defaultValue: 'e.g. A, B, Science' })} value={form.section} onChange={e => set('section', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('classes.classTeacher', { defaultValue: 'Class Teacher' })} <span className="text-muted-foreground">{t('classes.optional', { defaultValue: '(Optional)' })}</span></Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.classTeacherId}
              onChange={e => set('classTeacherId', e.target.value)}
            >
              <option value="">{t('classes.selectTeacher', { defaultValue: 'Select teacher…' })}</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} — {emp.designation || t('classes.teacher', { defaultValue: 'Teacher' })}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('classes.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? t('classes.saving', { defaultValue: 'Saving…' }) : isEdit ? t('classes.saveChanges', { defaultValue: 'Save Changes' }) : t('classes.createClass', { defaultValue: 'Create Class' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Classes() {
  const { t } = useTranslation();
  const companyId = getActiveCompanyId();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(null);

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['classes', companyId],
    queryFn: () => classesApi.list().then(r => r.data),
    enabled: !!companyId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', companyId],
    queryFn: () => employeeApi.list().then(r => r.data),
    enabled: !!companyId,
  });

  const remove = useMutation({
    mutationFn: (id) => classesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success(t('classes.classDeleted', { defaultValue: 'Class deleted' }));
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('classes.cannotDeleteEnrolled', { defaultValue: 'Cannot delete — students are enrolled in this class' })),
  });

  const teacherName = (id) => employees.find(e => e.id === id)?.name || '—';

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('classes.title', { defaultValue: 'Classes & Sections' })}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('classes.classesConfigured', { defaultValue: '{{count}} classes configured', count: classes.length })}</p>
        </div>
        <Button onClick={() => setDialog({ mode: 'add' })}>
          <Plus className="w-4 h-4 mr-2" /> {t('classes.addClass', { defaultValue: 'Add Class' })}
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">{t('classes.loading', { defaultValue: 'Loading…' })}</div>
        ) : classes.length === 0 ? (
          <div className="p-12 text-center">
            <School className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t('classes.noClassesYet', { defaultValue: 'No classes yet. Add your first class to get started.' })}</p>
            <Button className="mt-4" size="sm" onClick={() => setDialog({ mode: 'add' })}>{t('classes.addFirstClass', { defaultValue: 'Add First Class' })}</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('classes.classHeader', { defaultValue: 'Class' })}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('classes.sectionHeader', { defaultValue: 'Section' })}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('classes.classTeacherHeader', { defaultValue: 'Class Teacher' })}</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('classes.studentsHeader', { defaultValue: 'Students' })}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {classes.map(cls => (
                  <tr key={cls.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium">{cls.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{cls.section || '—'}</td>
                    <td className="px-5 py-3 text-muted-foreground">{teacherName(cls.classTeacherId)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{cls._count?.students ?? 0}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setDialog({ mode: 'edit', cls })}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(t('classes.confirmDelete', { defaultValue: 'Delete {{name}}?', name: `${cls.name}${cls.section ? ` (${cls.section})` : ''}` }))) remove.mutate(cls.id);
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
        <ClassDialog
          open={!!dialog}
          onClose={() => setDialog(null)}
          initial={dialog.mode === 'edit' ? dialog.cls : null}
          employees={employees}
          companyId={companyId}
        />
      )}
    </div>
  );
}
