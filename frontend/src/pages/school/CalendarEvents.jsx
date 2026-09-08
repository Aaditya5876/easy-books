import { useState } from 'react';
import AcademicYear from './AcademicYear';
import Events from './Events';
import CalendarPage from '../CalendarPage';
import { Button } from '@/components/ui/button';

export default function CalendarEvents() {
  const [view, setView] = useState('calendar'); // calendar | years | events
  const [calendarMode, setCalendarMode] = useState('AD'); // AD | BS

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Calendar and Events</h1>
          <p className="text-sm text-muted-foreground">Manage academic years, events and browse the school calendar in AD or BS.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view==='calendar'? 'default':'ghost'} onClick={() => setView('calendar')}>Calendar</Button>
          <Button variant={view==='years'? 'default':'ghost'} onClick={() => setView('years')}>Academic Years</Button>
          <Button variant={view==='events'? 'default':'ghost'} onClick={() => setView('events')}>Events</Button>
          <Button variant="outline" onClick={() => setCalendarMode(m => m === 'AD' ? 'BS' : 'AD')}>{calendarMode === 'AD' ? 'Show BS' : 'Show AD'}</Button>
        </div>
      </div>

      {view === 'calendar' && (
        <div className="rounded-lg border p-4">
          <CalendarPage mode={calendarMode} />
        </div>
      )}

      {view === 'years' && (
        <div className="rounded-lg border p-4">
          <AcademicYear />
        </div>
      )}

      {view === 'events' && (
          <div className="rounded-lg border p-4">
            <Events mode={calendarMode} />
          </div>
      )}
    </div>
  );
}
