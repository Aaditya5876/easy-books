import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { subjectsApi, classesApi } from '@/api';
import { confirm } from '@/lib/confirm';
import { useRole } from '@/lib/useRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { BookMarked, Plus, Pencil, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import BulkImportDialog from '@/components/shared/BulkImportDialog';
import { SUBJECT_FIELDS } from '@/components/shared/bulkImportFields';

const classLabel = (c) => `${c.name}${c.section ? ` (${c.section})` : ''}`;

function SubjectDialog({ open, onClose, subject }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = !!subject;
  const [form, setForm] = useState({
    name: subject?.name || '',
    code: subject?.code || '',
    classIds: subject?.classes?.map(sc => sc.classId) || [],
    bookReference: subject?.bookReference || '',
    chapters: subject?.chapters ?? '',
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['school-classes'],
    queryFn: () => classesApi.list().then(r => r.data),
  });

  const [errors, setErrors] = useState({});

  const toggleClass = (classId) => {
    setForm(p => ({
      ...p,
      classIds: p.classIds.includes(classId) ? p.classIds.filter(id => id !== classId) : [...p.classIds, classId],
    }));
  };

  const save = useMutation({
    mutationFn: (d) => isEdit ? subjectsApi.update(subject.id, d) : subjectsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-subjects'] });
      toast.success(isEdit ? t('subjects.subjectUpdated', { defaultValue: 'Subject updated' }) : t('subjects.subjectCreated', { defaultValue: 'Subject created' }));
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || t('subjects.failedToSave', { defaultValue: 'Failed to save' })),
  });

  const companyId = localStorage.getItem('easybooks_active_company') || '';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      const msg = t('subjects.subjectNameRequired', { defaultValue: 'Subject name is required' });
      setErrors({ name: msg });
      return toast.error(msg);
    }
    setErrors({});
    const payload = {
      name: form.name,
      code: form.code,
      classIds: form.classIds,
      bookReference: form.bookReference,
      chapters: form.chapters ? parseInt(form.chapters, 10) : undefined,
    };
    save.mutate(isEdit ? payload : { ...payload, companyId });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('subjects.editSubject', { defaultValue: 'Edit Subject' }) : t('subjects.addSubject', { defaultValue: 'Add Subject' })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>{t('subjects.subjectName', { defaultValue: 'Subject Name *' })}</Label>
            <Input value={form.name} onChange={e => { setForm(p => ({ ...p, name: e.target.value })); if (errors.name) setErrors({}); }} placeholder={t('subjects.subjectNamePlaceholder', { defaultValue: 'e.g. Mathematics' })} />
            {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
          </div>
          <div className="space-y-1">
            <Label>{t('subjects.subjectCode', { defaultValue: 'Subject Code' })}</Label>
            <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder={t('subjects.subjectCodePlaceholder', { defaultValue: 'e.g. MATH-10' })} />
          </div>
          <div className="space-y-1">
            <Label>{t('subjects.standards', { defaultValue: 'Standards' })}</Label>
            <div className="flex flex-wrap gap-x-3 gap-y-2 border rounded-md p-2 max-h-32 overflow-y-auto">
              {classes.length === 0 ? (
                <span className="text-xs text-muted-foreground">{t('subjects.noClassesYet', { defaultValue: 'No classes set up yet' })}</span>
              ) : classes.map(c => (
                <label key={c.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.classIds.includes(c.id)} onChange={() => toggleClass(c.id)} />
                  {classLabel(c)}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('subjects.standardsHint', { defaultValue: 'Leave all unchecked to make this subject available for every standard.' })}</p>
          </div>
          <div className="space-y-1">
            <Label>Books Reference</Label>
            <Input value={form.bookReference} onChange={e => setForm(p => ({ ...p, bookReference: e.target.value }))} placeholder="e.g. NCERT, Rainbow" />
          </div>
          <div className="space-y-1">
            <Label>Number of Chapters</Label>
            <Input type="number" value={form.chapters} onChange={e => setForm(p => ({ ...p, chapters: e.target.value }))} placeholder="0" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('subjects.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? t('subjects.saving', { defaultValue: 'Saving…' }) : isEdit ? t('subjects.update', { defaultValue: 'Update' }) : t('subjects.create', { defaultValue: 'Create' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Subjects() {
  const { t } = useTranslation();
  const { canManageAcademicContent } = useRole();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState({ open: false, subject: null });
  const [importOpen, setImportOpen] = useState(false);

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['school-subjects'],
    queryFn: () => subjectsApi.list().then(r => r.data),
  });

  const remove = useMutation({
    mutationFn: (id) => subjectsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['school-subjects'] }); toast.success(t('subjects.subjectDeleted', { defaultValue: 'Subject deleted' })); },
    onError: (e) => toast.error(e.response?.data?.message || t('subjects.cannotDeleteSubject', { defaultValue: 'Cannot delete subject' })),
  });

  const handleDelete = async (s) => {
    const ok = await confirm({
      title: t('common.deleteConfirmTitle', { defaultValue: 'Delete?' }),
      description: t('subjects.confirmDelete', { defaultValue: 'Delete subject "{{name}}"?', name: s.name }),
      confirmLabel: t('common.delete', { defaultValue: 'Delete' }),
      variant: 'destructive',
    });
    if (!ok) return;
    remove.mutate(s.id);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookMarked className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('subjects.title', { defaultValue: 'Subjects' })}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> {t('subjects.import', { defaultValue: 'Import' })}
          </Button>
          {canManageAcademicContent && (
            <Button onClick={() => setDialog({ open: true, subject: null })}>
              <Plus className="h-4 w-4 mr-1" /> {t('subjects.addSubject', { defaultValue: 'Add Subject' })}
            </Button>
          )}
        </div>
      </div>

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="subjects"
        title={t('subjects.importSubjects', { defaultValue: 'Import Subjects' })}
        fields={SUBJECT_FIELDS}
        onDone={() => qc.invalidateQueries({ queryKey: ['school-subjects'] })}
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{t('subjects.subjectNameHeader', { defaultValue: 'Subject Name' })}</TableHead>
              <TableHead>{t('subjects.codeHeader', { defaultValue: 'Code' })}</TableHead>
              <TableHead>{t('subjects.standardsHeader', { defaultValue: 'Standards' })}</TableHead>
              <TableHead>{t('subjects.bookHeader', { defaultValue: 'Books' })}</TableHead>
              <TableHead>{t('subjects.chaptersHeader', { defaultValue: 'Chapters' })}</TableHead>
              <TableHead className="w-24">{t('subjects.actionsHeader', { defaultValue: 'Actions' })}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t('subjects.loading', { defaultValue: 'Loading…' })}</TableCell></TableRow>
            ) : subjects.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">{t('subjects.noSubjectsYet', { defaultValue: 'No subjects yet. Add your first subject.' })}</TableCell></TableRow>
            ) : subjects.map((s, i) => (
              <TableRow key={s.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.code || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{s.classes?.length ? s.classes.map(sc => classLabel(sc.class)).join(', ') : <span className="text-muted-foreground">{t('subjects.allStandards', { defaultValue: 'All' })}</span>}</TableCell>
                  <TableCell>{s.bookReference || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{s.chapters ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {canManageAcademicContent && (
                        <Button size="icon" variant="ghost" onClick={() => setDialog({ open: true, subject: s })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canManageAcademicContent && (
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(s)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {dialog.open && (
        <SubjectDialog
          open={dialog.open}
          onClose={() => setDialog({ open: false, subject: null })}
          subject={dialog.subject}
        />
      )}
    </div>
  );
}
