import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ClipboardList, AlertCircle, Sparkles } from 'lucide-react';
import { homeworkApi, classesApi, subjectsApi, aiApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const EMPTY = { title: '', classId: '', subjectId: '', description: '', dueDate: '', fileUrl: '' };

function HomeworkDialog({ open, onClose, initial, classes, subjects, companyId }) {
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(initial ? {
    title: initial.title,
    classId: initial.classId || '',
    subjectId: initial.subjectId || '',
    description: initial.description || '',
    dueDate: initial.dueDate ? initial.dueDate.slice(0, 10) : '',
    fileUrl: initial.fileUrl || '',
  } : EMPTY);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [aiLoading, setAiLoading] = useState(false);

  async function generateDescription() {
    if (!form.title.trim()) { toast.error('Enter a title first'); return; }
    const className = classes.find(c => c.id === form.classId)?.name || '';
    const subjectName = subjects.find(s => s.id === form.subjectId)?.name || '';
    setAiLoading(true);
    try {
      const res = await aiApi.homeworkDescription({
        subject: subjectName || 'General',
        topic: form.title,
        className: className || 'students',
        dueDate: form.dueDate || 'next class',
      });
      set('description', res.data.description);
      toast.success('Description generated');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'AI failed — check GEMINI_API_KEY');
    } finally {
      setAiLoading(false);
    }
  }

  const save = useMutation({
    mutationFn: (data) => isEdit ? homeworkApi.update(initial.id, data) : homeworkApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homework'] });
      toast.success(isEdit ? 'Updated' : 'Homework assigned');
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to save'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.classId) { toast.error('Class is required'); return; }
    if (!form.dueDate) { toast.error('Due date is required'); return; }
    save.mutate({ ...form, companyId, dueDate: new Date(form.dueDate) });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Homework' : 'Assign Homework'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input placeholder="e.g. Chapter 5 Exercise" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Class *</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.classId} onChange={e => set('classId', e.target.value)}>
                <option value="">Select class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.subjectId} onChange={e => set('subjectId', e.target.value)}>
                <option value="">All Subjects</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Due Date *</Label>
            <Input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Description</Label>
              <button
                type="button"
                onClick={generateDescription}
                disabled={aiLoading}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3" />
                {aiLoading ? 'Writing…' : 'Write with AI'}
              </button>
            </div>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm bg-background min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Instructions or details for students…"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reference File URL <span className="text-muted-foreground">(Optional)</span></Label>
            <Input placeholder="https://…" value={form.fileUrl} onChange={e => set('fileUrl', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Assign'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function isOverdue(dueDate) {
  return new Date(dueDate) < new Date();
}

export default function Homework() {
  const companyId = getActiveCompanyId();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(null);
  const [filterClass, setFilterClass] = useState('');

  const { data: homeworks = [], isLoading } = useQuery({
    queryKey: ['homework', companyId, filterClass],
    queryFn: () => homeworkApi.list(filterClass || undefined).then(r => r.data),
    enabled: !!companyId,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['school-classes', companyId],
    queryFn: () => classesApi.list().then(r => r.data),
    enabled: !!companyId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', companyId],
    queryFn: () => subjectsApi.list().then(r => r.data),
    enabled: !!companyId,
  });

  const remove = useMutation({
    mutationFn: (id) => homeworkApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['homework'] }); toast.success('Deleted'); },
    onError: () => toast.error('Failed to delete'),
  });

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-NP', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Homework</h1>
          <p className="text-muted-foreground text-sm mt-1">{homeworks.length} assignments</p>
        </div>
        <Button onClick={() => setDialog({ mode: 'add' })}>
          <Plus className="w-4 h-4 mr-2" /> Assign Homework
        </Button>
      </div>

      <div className="flex gap-3">
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
        ) : homeworks.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No homework assigned yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {homeworks.map(hw => {
              const overdue = isOverdue(hw.dueDate);
              return (
                <div key={hw.id} className="px-5 py-4 hover:bg-muted/20 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{hw.title}</p>
                      {overdue && (
                        <span className="flex items-center gap-1 text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                          <AlertCircle className="w-3 h-3" /> Overdue
                        </span>
                      )}
                    </div>
                    {hw.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{hw.description}</p>}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {hw.class && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{hw.class.name}{hw.class.section ? ` (${hw.class.section})` : ''}</span>}
                      {hw.subject && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{hw.subject.name}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${overdue ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                        Due: {fmtDate(hw.dueDate)}
                      </span>
                    </div>
                    {hw.fileUrl && (
                      <a href={hw.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-1 inline-block">Reference file</a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setDialog({ mode: 'edit', hw })} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this homework?')) remove.mutate(hw.id); }}
                      className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {dialog && (
        <HomeworkDialog
          open={!!dialog}
          onClose={() => setDialog(null)}
          initial={dialog.mode === 'edit' ? dialog.hw : null}
          classes={classes}
          subjects={subjects}
          companyId={companyId}
        />
      )}
    </div>
  );
}
