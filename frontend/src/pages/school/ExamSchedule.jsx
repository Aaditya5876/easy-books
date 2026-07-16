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
import { CalendarClock, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const companyId = () => localStorage.getItem('easybooks_active_company') || '';

const classLabel = (c) => `${c.name}${c.section ? ` - ${c.section}` : ''}`;

function ScheduleDialog({ open, onClose, entry, classes, subjects }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = !!entry;
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

  const save = useMutation({
    mutationFn: (d) =>
      isEdit
        ? examSchedulesApi.update(entry.id, d)
        : examSchedulesApi.create({ ...d, companyId: companyId() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exam-schedules'] });
      toast.success(isEdit ? t('examSchedule.scheduleUpdated', { defaultValue: 'Exam schedule updated' }) : t('examSchedule.examScheduled', { defaultValue: 'Exam scheduled' }));
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || t('examSchedule.failedToSave', { defaultValue: 'Failed to save' })),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.examName.trim() || !form.classId || !form.examDate)
      return toast.error(t('examSchedule.requiredFields', { defaultValue: 'Exam name, class and date are required' }));
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
          <DialogTitle>{isEdit ? t('examSchedule.editExamSchedule', { defaultValue: 'Edit Exam Schedule' }) : t('examSchedule.scheduleExam', { defaultValue: 'Schedule Exam' })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>{t('examSchedule.examNameRequired', { defaultValue: 'Exam Name *' })}</Label>
            <Input value={form.examName} onChange={e => setForm(p => ({ ...p, examName: e.target.value }))} placeholder={t('examSchedule.examNamePlaceholder', { defaultValue: 'e.g. First Terminal 2082' })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t('examSchedule.classRequired', { defaultValue: 'Class *' })}</Label>
              <Select value={form.classId} onValueChange={v => setForm(p => ({ ...p, classId: v }))}>
                <SelectTrigger><SelectValue placeholder={t('examSchedule.selectClass', { defaultValue: 'Select class' })} /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{classLabel(c)}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <input type="date" value={form.examDate} onChange={e => setForm(p => ({ ...p, examDate: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" />
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
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('examSchedule.saving', { defaultValue: 'Saving…' }) : isEdit ? t('examSchedule.update', { defaultValue: 'Update' }) : t('examSchedule.schedule', { defaultValue: 'Schedule' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ExamSchedule() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState({ open: false, entry: null });
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
          <Button onClick={() => setDialog({ open: true, entry: null })}>
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
                  <th className="px-4 py-2">{t('examSchedule.time', { defaultValue: 'Time' })}</th>
                  <th className="px-4 py-2">{t('examSchedule.room', { defaultValue: 'Room' })}</th>
                  <th className="px-4 py-2">{t('examSchedule.notes', { defaultValue: 'Notes' })}</th>
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
                    <td className="px-4 py-2 whitespace-nowrap">
                      {s.startTime ? `${s.startTime}${s.endTime ? ` – ${s.endTime}` : ''}` : '—'}
                    </td>
                    <td className="px-4 py-2">{s.roomNumber || '—'}</td>
                    <td className="px-4 py-2 max-w-[200px] truncate">{s.notes || '—'}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => setDialog({ open: true, entry: s })}>
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

      {dialog.open && (
        <ScheduleDialog
          open={dialog.open}
          onClose={() => setDialog({ open: false, entry: null })}
          entry={dialog.entry}
          classes={classes}
          subjects={subjects}
        />
      )}
    </div>
  );
}
