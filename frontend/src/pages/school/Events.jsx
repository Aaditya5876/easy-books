import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { schoolEventsApi } from '@/api';
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
import { CalendarCheck, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';

const EVENT_TYPES = ['GENERAL', 'HOLIDAY', 'EXAM', 'SPORTS', 'CULTURAL', 'MEETING'];
const TYPE_COLORS = {
  GENERAL: 'bg-blue-100 text-blue-800 border-blue-200',
  HOLIDAY: 'bg-red-100 text-red-800 border-red-200',
  EXAM: 'bg-purple-100 text-purple-800 border-purple-200',
  SPORTS: 'bg-green-100 text-green-800 border-green-200',
  CULTURAL: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  MEETING: 'bg-gray-100 text-gray-800 border-gray-200',
};

const eventTypeLabel = (t, type) =>
  t(`events.type${type.charAt(0)}${type.slice(1).toLowerCase()}`, { defaultValue: type.charAt(0) + type.slice(1).toLowerCase() });

const companyId = () => localStorage.getItem('easybooks_active_company') || '';

function EventDialog({ open, onClose, event }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = !!event;
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    startDate: event?.startDate ? event.startDate.split('T')[0] : '',
    endDate: event?.endDate ? event.endDate.split('T')[0] : '',
    eventType: event?.eventType || 'GENERAL',
  });

  const save = useMutation({
    mutationFn: (d) =>
      isEdit
        ? schoolEventsApi.update(event.id, d)
        : schoolEventsApi.create({ ...d, companyId: companyId() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-events'] });
      toast.success(isEdit ? t('events.eventUpdated', { defaultValue: 'Event updated' }) : t('events.eventCreated', { defaultValue: 'Event created' }));
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || t('events.failedToSave', { defaultValue: 'Failed to save' })),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.startDate) return toast.error(t('events.titleStartDateRequired', { defaultValue: 'Title and start date are required' }));
    save.mutate({ ...form, endDate: form.endDate || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('events.editEvent', { defaultValue: 'Edit Event' }) : t('events.addEvent', { defaultValue: 'Add Event' })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>{t('events.eventTitle', { defaultValue: 'Event Title *' })}</Label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={t('events.titlePlaceholder', { defaultValue: 'e.g. Annual Day Celebration' })} />
          </div>
          <div className="space-y-1">
            <Label>{t('events.type', { defaultValue: 'Type' })}</Label>
            <Select value={form.eventType} onValueChange={v => setForm(p => ({ ...p, eventType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(type => <SelectItem key={type} value={type}>{eventTypeLabel(t, type)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t('events.startDate', { defaultValue: 'Start Date *' })}</Label>
              <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" />
            </div>
            <div className="space-y-1">
              <Label>{t('events.endDate', { defaultValue: 'End Date' })}</Label>
              <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t('events.description', { defaultValue: 'Description' })}</Label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder={t('events.descriptionPlaceholder', { defaultValue: 'Optional details…' })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('events.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('events.saving', { defaultValue: 'Saving…' }) : isEdit ? t('events.update', { defaultValue: 'Update' }) : t('events.addEvent', { defaultValue: 'Add Event' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Events() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState({ open: false, event: null });
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthKey = format(currentMonth, 'yyyy-MM');

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['school-events', monthKey],
    queryFn: () => schoolEventsApi.list(monthKey).then(r => r.data),
  });

  const remove = useMutation({
    mutationFn: (id) => schoolEventsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['school-events'] }); toast.success(t('events.eventDeleted', { defaultValue: 'Event deleted' })); },
    onError: (e) => toast.error(e.response?.data?.message || t('events.failedToDelete', { defaultValue: 'Failed to delete event' })),
  });

  const prevMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  const eventsOnDay = (day) =>
    events.filter(e => {
      const start = new Date(e.startDate);
      const end = e.endDate ? new Date(e.endDate) : start;
      return day >= start && day <= end;
    });

  const dayNames = [
    t('events.sun', { defaultValue: 'Sun' }),
    t('events.mon', { defaultValue: 'Mon' }),
    t('events.tue', { defaultValue: 'Tue' }),
    t('events.wed', { defaultValue: 'Wed' }),
    t('events.thu', { defaultValue: 'Thu' }),
    t('events.fri', { defaultValue: 'Fri' }),
    t('events.sat', { defaultValue: 'Sat' }),
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('events.schoolCalendar', { defaultValue: 'School Calendar' })}</h1>
        </div>
        <Button onClick={() => setDialog({ open: true, event: null })}>
          <Plus className="h-4 w-4 mr-1" /> {t('events.addEvent', { defaultValue: 'Add Event' })}
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="sm" onClick={prevMonth}>{t('events.prev', { defaultValue: '‹ Prev' })}</Button>
          <h2 className="font-semibold text-lg">{format(currentMonth, 'MMMM yyyy')}</h2>
          <Button variant="outline" size="sm" onClick={nextMonth}>{t('events.next', { defaultValue: 'Next ›' })}</Button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-border rounded overflow-hidden">
          {dayNames.map(d => (
            <div key={d} className="bg-muted px-1 py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
          ))}
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="bg-card px-1 py-2 min-h-[70px]" />
          ))}
          {days.map(day => {
            const dayEvents = eventsOnDay(day);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className={`bg-card px-1 py-1 min-h-[70px] ${isToday ? 'bg-primary/5' : ''}`}>
                <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                  {format(day, 'd')}
                </div>
                {dayEvents.slice(0, 2).map(e => (
                  <div key={e.id} className={`text-xs px-1 rounded mb-0.5 truncate border ${TYPE_COLORS[e.eventType] || TYPE_COLORS.GENERAL}`}>
                    {e.title}
                  </div>
                ))}
                {dayEvents.length > 2 && <div className="text-xs text-muted-foreground">{t('events.more', { defaultValue: '+{{count}} more', count: dayEvents.length - 2 })}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Event list */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          {t('events.eventsIn', { defaultValue: 'Events in {{month}}', month: format(currentMonth, 'MMMM yyyy') })}
        </h3>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">{t('events.loading', { defaultValue: 'Loading…' })}</div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">{t('events.noEvents', { defaultValue: 'No events this month' })}</div>
        ) : events.map(e => (
          <div key={e.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{e.title}</span>
                <Badge className={`text-xs ${TYPE_COLORS[e.eventType]}`}>{eventTypeLabel(t, e.eventType)}</Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {format(new Date(e.startDate), 'dd MMM yyyy')}
                {e.endDate && e.endDate !== e.startDate && ` – ${format(new Date(e.endDate), 'dd MMM yyyy')}`}
              </div>
              {e.description && <p className="text-sm mt-1">{e.description}</p>}
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => setDialog({ open: true, event: e })}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => { if (window.confirm(t('events.deleteConfirm', { defaultValue: 'Delete this event?' }))) remove.mutate(e.id); }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {dialog.open && (
        <EventDialog
          open={dialog.open}
          onClose={() => setDialog({ open: false, event: null })}
          event={dialog.event}
        />
      )}
    </div>
  );
}
