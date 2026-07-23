import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { examSchedulesApi, classesApi, subjectsApi } from '@/api';
import { filterSubjectsByClass } from '@/lib/subjectFilter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { CalendarClock, Plus, Pencil, Trash2, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const classLabel = (c) => `${c.name}${c.section ? ` - ${c.section}` : ''}`;

// ── Edit a single already-scheduled paper ──────────────────────────────────────

function EditScheduleDialog({ open, onClose, entry, classes, subjects }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    examName: entry?.examName || '',
    classId: entry?.classId || '',
    subjectId: entry?.subjectId || '',
    examDate: entry?.examDate ? entry.examDate.split('T')[0] : '',
    startTime: entry?.startTime || '',
    endTime: entry?.endTime || '',
    roomNumber: entry?.roomNumber || '',
    notes: entry?.notes || '',
  });
  const [errors, setErrors] = useState({});

  const save = useMutation({
    mutationFn: (d) => examSchedulesApi.update(entry.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exam-schedules'] });
      toast.success(t('examSchedule.scheduleUpdated', { defaultValue: 'Exam schedule updated' }));
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || t('examSchedule.failedToSave', { defaultValue: 'Failed to save' })),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.examName.trim()) errs.examName = t('examSchedule.examNameRequiredMsg', { defaultValue: 'Exam name is required' });
    if (!form.classId) errs.classId = t('examSchedule.classRequiredMsg', { defaultValue: 'Class is required' });
    if (!form.examDate) errs.examDate = t('examSchedule.dateRequiredMsg', { defaultValue: 'Exam date is required' });
    if (Object.keys(errs).length) {
      setErrors(errs);
      return toast.error(t('examSchedule.requiredFields', { defaultValue: 'Exam name, class and date are required' }));
    }
    setErrors({});
    save.mutate({
      ...form,
      subjectId: form.subjectId || undefined,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      roomNumber: form.roomNumber || undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('examSchedule.editExamSchedule', { defaultValue: 'Edit Exam Schedule' })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>{t('examSchedule.examNameRequired', { defaultValue: 'Exam Name *' })}</Label>
            <Input value={form.examName} onChange={e => { setForm(p => ({ ...p, examName: e.target.value })); if (errors.examName) setErrors(er => ({ ...er, examName: undefined })); }} placeholder={t('examSchedule.examNamePlaceholder', { defaultValue: 'e.g. First Terminal 2082' })} />
            {errors.examName && <p className="text-xs text-red-600">{errors.examName}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t('examSchedule.classRequired', { defaultValue: 'Class *' })}</Label>
              <Select value={form.classId} onValueChange={v => { setForm(p => ({ ...p, classId: v })); if (errors.classId) setErrors(er => ({ ...er, classId: undefined })); }}>
                <SelectTrigger><SelectValue placeholder={t('examSchedule.selectClass', { defaultValue: 'Select class' })} /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{classLabel(c)}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.classId && <p className="text-xs text-red-600">{errors.classId}</p>}
            </div>
            <div className="space-y-1">
              <Label>{t('examSchedule.subject', { defaultValue: 'Subject' })}</Label>
              <Select value={form.subjectId} onValueChange={v => setForm(p => ({ ...p, subjectId: v }))}>
                <SelectTrigger><SelectValue placeholder={t('examSchedule.selectSubject', { defaultValue: 'Select subject' })} /></SelectTrigger>
                <SelectContent>
                  {filterSubjectsByClass(subjects, form.classId).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t('examSchedule.examDateRequired', { defaultValue: 'Exam Date *' })}</Label>
            <input type="date" value={form.examDate} onChange={e => { setForm(p => ({ ...p, examDate: e.target.value })); if (errors.examDate) setErrors(er => ({ ...er, examDate: undefined })); }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" />
            {errors.examDate && <p className="text-xs text-red-600">{errors.examDate}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>{t('examSchedule.startTime', { defaultValue: 'Start Time' })}</Label>
              <input type="time" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" />
            </div>
            <div className="space-y-1">
              <Label>{t('examSchedule.endTime', { defaultValue: 'End Time' })}</Label>
              <input type="time" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" />
            </div>
            <div className="space-y-1">
              <Label>{t('examSchedule.room', { defaultValue: 'Room' })}</Label>
              <Input value={form.roomNumber} onChange={e => setForm(p => ({ ...p, roomNumber: e.target.value }))} placeholder="101" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t('examSchedule.notes', { defaultValue: 'Notes' })}</Label>
            <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder={t('examSchedule.notesPlaceholder', { defaultValue: 'Optional instructions…' })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('examSchedule.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('examSchedule.saving', { defaultValue: 'Saving…' }) : t('examSchedule.update', { defaultValue: 'Update' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Create a full date-sheet: one exam+class, many subject/date/time rows ──────

let rowSeq = 0;
const newSubjectRow = () => ({ key: ++rowSeq, subjectId: '', examDate: '', startTime: '', endTime: '' });

function NewScheduleDialog({ open, onClose, classes, subjects }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [examName, setExamName] = useState('');
  const [classId, setClassId] = useState('');
  const [rows, setRows] = useState([newSubjectRow()]);
  const [errors, setErrors] = useState({});

  const updateRow = (key, patch) => setRows(rs => rs.map(r => r.key === key ? { ...r, ...patch } : r));
  const addRow = () => setRows(rs => [...rs, newSubjectRow()]);
  const removeRow = (key) => setRows(rs => rs.length > 1 ? rs.filter(r => r.key !== key) : rs);

  const classSubjects = filterSubjectsByClass(subjects, classId);
  const subjectCode = (id) => classSubjects.find(s => s.id === id)?.code || '—';

  const save = useMutation({
    mutationFn: () => examSchedulesApi.createBulk({
      classId,
      examName: examName.trim(),
      rows: rows.map(r => ({ subjectId: r.subjectId || undefined, examDate: r.examDate, startTime: r.startTime || undefined, endTime: r.endTime || undefined })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exam-schedules'] });
      toast.success(t('examSchedule.examScheduled', { defaultValue: 'Exam scheduled' }));
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || t('examSchedule.failedToSave', { defaultValue: 'Failed to save' })),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!examName.trim()) errs.examName = t('examSchedule.examNameRequiredMsg', { defaultValue: 'Exam name is required' });
    if (!classId) errs.classId = t('examSchedule.classRequiredMsg', { defaultValue: 'Class is required' });
    if (Object.keys(errs).length) {
      setErrors(errs);
      return toast.error(t('examSchedule.requiredFields', { defaultValue: 'Exam name, class and date are required' }));
    }
    setErrors({});
    if (rows.some(r => !r.examDate)) return toast.error(t('examSchedule.dateRequiredAllRows', { defaultValue: 'Enter a date for every subject row' }));
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('examSchedule.scheduleExam', { defaultValue: 'Schedule Exam' })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t('examSchedule.examNameRequired', { defaultValue: 'Exam Name *' })}</Label>
              <Input value={examName} onChange={e => { setExamName(e.target.value); if (errors.examName) setErrors(er => ({ ...er, examName: undefined })); }} placeholder={t('examSchedule.examNamePlaceholder', { defaultValue: 'e.g. First Terminal 2082' })} />
              {errors.examName && <p className="text-xs text-red-600">{errors.examName}</p>}
            </div>
            <div className="space-y-1">
              <Label>{t('examSchedule.classRequired', { defaultValue: 'Class *' })}</Label>
              <Select value={classId} onValueChange={v => { setClassId(v); if (errors.classId) setErrors(er => ({ ...er, classId: undefined })); }}>
                <SelectTrigger><SelectValue placeholder={t('examSchedule.selectClass', { defaultValue: 'Select class' })} /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{classLabel(c)}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.classId && <p className="text-xs text-red-600">{errors.classId}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('examSchedule.subjectsTable', { defaultValue: 'Subjects' })}</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-3.5 w-3.5 mr-1" /> {t('examSchedule.addRow', { defaultValue: 'Add Row' })}
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">{t('examSchedule.date', { defaultValue: 'Date' })}</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">{t('examSchedule.subject', { defaultValue: 'Subject' })}</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">{t('examSchedule.subjectCode', { defaultValue: 'Subject Code' })}</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">{t('examSchedule.time', { defaultValue: 'Time' })}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.key} className="border-t border-border">
                      <td className="px-2 py-1.5">
                        <input type="date" value={row.examDate} onChange={e => updateRow(row.key, { examDate: e.target.value })}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm" />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          className="w-full h-9 border rounded-md px-2 text-sm bg-background"
                          value={row.subjectId}
                          onChange={e => updateRow(row.key, { subjectId: e.target.value })}
                          disabled={!classId}
                        >
                          <option value="">{t('examSchedule.selectSubject', { defaultValue: 'Select subject' })}</option>
                          {classSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground text-xs whitespace-nowrap">{subjectCode(row.subjectId)}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <input type="time" value={row.startTime} onChange={e => updateRow(row.key, { startTime: e.target.value })}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm" />
                          <span className="text-muted-foreground text-xs">–</span>
                          <input type="time" value={row.endTime} onChange={e => updateRow(row.key, { endTime: e.target.value })}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm" />
                        </div>
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button type="button" onClick={() => removeRow(row.key)} className="p-1 text-muted-foreground hover:text-destructive">
                          <Minus className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('examSchedule.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('examSchedule.saving', { defaultValue: 'Saving…' }) : t('examSchedule.schedule', { defaultValue: 'Schedule' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ExamSchedule() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [classFilter, setClassFilter] = useState('ALL');

  const { data: classes = [] } = useQuery({
    queryKey: ['school-classes'],
    queryFn: () => classesApi.list().then(r => r.data),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['school-subjects'],
    queryFn: () => subjectsApi.list().then(r => r.data),
  });

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['exam-schedules', classFilter],
    queryFn: () =>
      examSchedulesApi
        .list(classFilter !== 'ALL' ? { classId: classFilter } : {})
        .then(r => r.data),
  });

  const remove = useMutation({
    mutationFn: (id) => examSchedulesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-schedules'] }); toast.success(t('examSchedule.scheduleDeleted', { defaultValue: 'Exam schedule deleted' })); },
    onError: (e) => toast.error(e.response?.data?.message || t('examSchedule.failedToDelete', { defaultValue: 'Failed to delete' })),
  });

  // Group by exam name so a full date-sheet reads as one block per exam
  const grouped = useMemo(() => {
    const map = new Map();
    for (const s of schedules) {
      if (!map.has(s.examName)) map.set(s.examName, []);
      map.get(s.examName).push(s);
    }
    return [...map.entries()];
  }, [schedules]);

  const isPast = (d) => new Date(d) < new Date(new Date().toDateString());

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('examSchedule.title', { defaultValue: 'Exam Schedule' })}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('examSchedule.allClasses', { defaultValue: 'All Classes' })}</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{classLabel(c)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> {t('examSchedule.scheduleExam', { defaultValue: 'Schedule Exam' })}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">{t('examSchedule.loading', { defaultValue: 'Loading…' })}</div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t('examSchedule.noExamsScheduled', { defaultValue: 'No exams scheduled yet. Click "Schedule Exam" to create a date-sheet.' })}
        </div>
      ) : grouped.map(([examName, entries]) => (
        <div key={examName} className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/50 flex items-center justify-between">
            <h2 className="font-semibold">{examName}</h2>
            <Badge variant="secondary">{entries.length > 1 ? t('examSchedule.papersCount', { count: entries.length, defaultValue: '{{count}} papers' }) : t('examSchedule.paperCount', { count: entries.length, defaultValue: '{{count}} paper' })}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2">{t('examSchedule.date', { defaultValue: 'Date' })}</th>
                  <th className="px-4 py-2">{t('examSchedule.class', { defaultValue: 'Class' })}</th>
                  <th className="px-4 py-2">{t('examSchedule.subject', { defaultValue: 'Subject' })}</th>
                  <th className="px-4 py-2">{t('examSchedule.subjectCode', { defaultValue: 'Subject Code' })}</th>
                  <th className="px-4 py-2">{t('examSchedule.time', { defaultValue: 'Time' })}</th>
                  <th className="px-4 py-2">{t('examSchedule.room', { defaultValue: 'Room' })}</th>
                  <th className="px-4 py-2 text-right">{t('examSchedule.actions', { defaultValue: 'Actions' })}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(s => (
                  <tr key={s.id} className={`border-b last:border-0 ${isPast(s.examDate) ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-2 whitespace-nowrap font-medium">
                      {format(new Date(s.examDate), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {s.class ? classLabel(s.class) : '—'}
                    </td>
                    <td className="px-4 py-2">{s.subject?.name || '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{s.subject?.code || '—'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {s.startTime ? `${s.startTime}${s.endTime ? ` – ${s.endTime}` : ''}` : '—'}
                    </td>
                    <td className="px-4 py-2">{s.roomNumber || '—'}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => setEditEntry(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (window.confirm(t('examSchedule.deleteThisSchedule', { defaultValue: 'Delete this exam schedule?' }))) remove.mutate(s.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {showNew && (
        <NewScheduleDialog
          open={showNew}
          onClose={() => setShowNew(false)}
          classes={classes}
          subjects={subjects}
        />
      )}

      {editEntry && (
        <EditScheduleDialog
          open={!!editEntry}
          onClose={() => setEditEntry(null)}
          entry={editEntry}
          classes={classes}
          subjects={subjects}
        />
      )}
    </div>
  );
}
