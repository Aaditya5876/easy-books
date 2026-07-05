import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { timetableApi, classesApi, subjectsApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Clock, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WORK_DAYS = [0, 1, 2, 3, 4, 5]; // Sun–Fri for Nepal schools
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

const companyId = () => localStorage.getItem('easybooks_active_company') || '';

function PeriodDialog({ open, onClose, entry, classId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    dayOfWeek: entry?.dayOfWeek ?? 1,
    periodNumber: entry?.periodNumber ?? 1,
    subjectId: entry?.subjectId || '',
    startTime: entry?.startTime || '09:00',
    endTime: entry?.endTime || '09:45',
    roomNumber: entry?.roomNumber || '',
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['school-subjects'],
    queryFn: () => subjectsApi.list().then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (d) => timetableApi.upsert({ ...d, companyId: companyId(), classId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timetable', classId] });
      toast.success(t('timetable.periodSaved', { defaultValue: 'Period saved' }));
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || t('timetable.failedToSave', { defaultValue: 'Failed to save' })),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    save.mutate({
      ...form,
      dayOfWeek: Number(form.dayOfWeek),
      periodNumber: Number(form.periodNumber),
      subjectId: form.subjectId && form.subjectId !== 'FREE' ? form.subjectId : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('timetable.setPeriod', { defaultValue: 'Set Period' })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t('timetable.day', { defaultValue: 'Day' })}</Label>
              <Select value={String(form.dayOfWeek)} onValueChange={v => setForm(p => ({ ...p, dayOfWeek: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WORK_DAYS.map(d => <SelectItem key={d} value={String(d)}>{t(`timetable.${DAY_KEYS[d]}`, { defaultValue: DAYS[d] })}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('timetable.periodNumber', { defaultValue: 'Period #' })}</Label>
              <Select value={String(form.periodNumber)} onValueChange={v => setForm(p => ({ ...p, periodNumber: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODS.map(p => <SelectItem key={p} value={String(p)}>{t('timetable.periodOption', { number: p, defaultValue: 'Period {{number}}' })}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t('timetable.subject', { defaultValue: 'Subject' })}</Label>
            <Select value={form.subjectId || 'FREE'} onValueChange={v => setForm(p => ({ ...p, subjectId: v === 'FREE' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder={t('timetable.selectSubject', { defaultValue: 'Select subject' })} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FREE">{t('timetable.freeBreak', { defaultValue: '— Free / Break —' })}</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t('timetable.startTime', { defaultValue: 'Start Time' })}</Label>
              <Input type="time" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t('timetable.endTime', { defaultValue: 'End Time' })}</Label>
              <Input type="time" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t('timetable.room', { defaultValue: 'Room' })}</Label>
            <Input value={form.roomNumber} onChange={e => setForm(p => ({ ...p, roomNumber: e.target.value }))} placeholder={t('timetable.roomPlaceholder', { defaultValue: 'e.g. Room 201' })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('timetable.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('timetable.saving', { defaultValue: 'Saving…' }) : t('timetable.save', { defaultValue: 'Save' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Timetable() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [classId, setClassId] = useState('');
  const [dialog, setDialog] = useState({ open: false, entry: null });

  const { data: classes = [] } = useQuery({
    queryKey: ['school-classes'],
    queryFn: () => classesApi.list().then(r => r.data),
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['timetable', classId],
    queryFn: () => timetableApi.get(classId).then(r => r.data),
    enabled: !!classId,
  });

  const remove = useMutation({
    mutationFn: (id) => timetableApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timetable', classId] }); toast.success(t('timetable.periodCleared', { defaultValue: 'Period cleared' })); },
    onError: (e) => toast.error(e.response?.data?.message || t('timetable.failedToClearPeriod', { defaultValue: 'Failed to clear period' })),
  });

  // Build grid: day → period → entry
  const grid = {};
  WORK_DAYS.forEach(d => { grid[d] = {}; });
  entries.forEach(e => { grid[e.dayOfWeek] = { ...grid[e.dayOfWeek], [e.periodNumber]: e }; });

  const selectedClass = classes.find(c => c.id === classId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Clock className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">{t('timetable.title', { defaultValue: 'Class Timetable' })}</h1>
      </div>

      <div className="flex items-center gap-4 bg-card rounded-lg border p-4">
        <div className="space-y-1 w-64">
          <Label>{t('timetable.selectClass', { defaultValue: 'Select Class' })}</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger><SelectValue placeholder={t('timetable.chooseAClass', { defaultValue: 'Choose a class…' })} /></SelectTrigger>
            <SelectContent>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{c.section ? ` (${c.section})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {classId && (
          <Button className="mt-5" onClick={() => setDialog({ open: true, entry: null })}>
            <Plus className="h-4 w-4 mr-1" /> {t('timetable.addPeriod', { defaultValue: 'Add Period' })}
          </Button>
        )}
      </div>

      {classId && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border bg-muted px-3 py-2 text-left w-24">{t('timetable.period', { defaultValue: 'Period' })}</th>
                {WORK_DAYS.map(d => (
                  <th key={d} className="border bg-muted px-3 py-2 text-center font-semibold">{t(`timetable.${DAY_KEYS[d]}`, { defaultValue: DAYS[d] })}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(p => (
                <tr key={p}>
                  <td className="border bg-muted/50 px-3 py-2 font-medium text-center">{t('timetable.periodAbbrev', { number: p, defaultValue: 'P{{number}}' })}</td>
                  {WORK_DAYS.map(d => {
                    const e = grid[d]?.[p];
                    return (
                      <td key={d} className="border px-2 py-2 min-w-[120px] align-top">
                        {e ? (
                          <div className="bg-primary/10 rounded p-1.5 relative group">
                            <div className="font-semibold text-primary text-xs">{e.subject?.name || t('timetable.free', { defaultValue: 'Free' })}</div>
                            <div className="text-xs text-muted-foreground">{e.startTime}–{e.endTime}</div>
                            {e.roomNumber && <div className="text-xs text-muted-foreground">{e.roomNumber}</div>}
                            <button
                              onClick={() => remove.mutate(e.id)}
                              className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDialog({ open: true, entry: { dayOfWeek: d, periodNumber: p } })}
                            className="w-full h-10 text-muted-foreground/40 hover:text-primary hover:bg-primary/5 rounded transition-colors text-xs"
                          >
                            {t('timetable.addCell', { defaultValue: '+ Add' })}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!classId && (
        <div className="text-center py-20 text-muted-foreground">
          {t('timetable.selectClassPrompt', { defaultValue: 'Select a class to view or edit its timetable' })}
        </div>
      )}

      {dialog.open && (
        <PeriodDialog
          open={dialog.open}
          onClose={() => setDialog({ open: false, entry: null })}
          entry={dialog.entry}
          classId={classId}
        />
      )}
    </div>
  );
}
