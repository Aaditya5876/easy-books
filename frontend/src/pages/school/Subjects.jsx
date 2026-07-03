import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subjectsApi } from '@/api';
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

function SubjectDialog({ open, onClose, subject }) {
  const qc = useQueryClient();
  const isEdit = !!subject;
  const [form, setForm] = useState({ name: subject?.name || '', code: subject?.code || '' });

  const save = useMutation({
    mutationFn: (d) => isEdit ? subjectsApi.update(subject.id, d) : subjectsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries(['school-subjects']);
      toast.success(isEdit ? 'Subject updated' : 'Subject created');
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  const companyId = localStorage.getItem('easybooks_active_company') || '';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Subject name is required');
    save.mutate(isEdit ? { name: form.name, code: form.code } : { ...form, companyId });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Subject' : 'Add Subject'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Subject Name *</Label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Mathematics" />
          </div>
          <div className="space-y-1">
            <Label>Subject Code</Label>
            <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g. MATH-10" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Subjects() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState({ open: false, subject: null });
  const [importOpen, setImportOpen] = useState(false);

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['school-subjects'],
    queryFn: () => subjectsApi.list().then(r => r.data),
  });

  const remove = useMutation({
    mutationFn: (id) => subjectsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries(['school-subjects']); toast.success('Subject deleted'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Cannot delete subject'),
  });

  const handleDelete = (s) => {
    if (!window.confirm(`Delete subject "${s.name}"?`)) return;
    remove.mutate(s.id);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookMarked className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Subjects</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <Button onClick={() => setDialog({ open: true, subject: null })}>
            <Plus className="h-4 w-4 mr-1" /> Add Subject
          </Button>
        </div>
      </div>

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="subjects"
        title="Import Subjects"
        fields={SUBJECT_FIELDS}
        onDone={() => qc.invalidateQueries({ queryKey: ['school-subjects'] })}
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Subject Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : subjects.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No subjects yet. Add your first subject.</TableCell></TableRow>
            ) : subjects.map((s, i) => (
              <TableRow key={s.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.code || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setDialog({ open: true, subject: s })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(s)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
