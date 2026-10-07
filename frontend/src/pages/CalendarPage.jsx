import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTodayBS, adToBs, bsToAd, daysInBsMonth, NEPALI_MONTHS, ENGLISH_MONTHS } from '@/lib/nepaliDate';
import { schoolEventsApi, noticesApi } from '@/api';
import PageHeader from '../components/shared/PageHeader';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function CalendarPage({ mode = 'AD' }) {
  const today = new Date();

  // AD-mode navigation state
  const [adMonth, setAdMonth] = useState(today.getMonth());
  const [adYear, setAdYear] = useState(today.getFullYear());

  // BS-mode navigation state — independent of AD mode so toggling back and
  // forth doesn't reset either view's position.
  const todayBS = getTodayBS();
  const [bsMonth, setBsMonth] = useState(todayBS.month);
  const [bsYear, setBsYear] = useState(todayBS.year);

  // Fetch the full event/notice lists once and filter client-side by whatever
  // range is currently visible — simpler and always correct than trying to
  // stitch together AD-month-keyed queries for a BS month, since BS and AD
  // month boundaries never align (a BS month can span two AD months).
  const { data: events = [] } = useQuery({
    queryKey: ['school-events', 'all'],
    queryFn: () => schoolEventsApi.list().then(r => r.data),
  });
  const { data: notices = [] } = useQuery({
    queryKey: ['school-notices', 'all'],
    queryFn: () => noticesApi.list().then(r => r.data),
  });

  const parseLocalDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const isSameDate = (a, b) =>
    a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const eventsOnDay = (day) =>
    events.filter(e => {
      const start = parseLocalDate(e.startDate);
      const end = parseLocalDate(e.endDate) || start;
      return start && day >= start && day <= end;
    });

  const noticesOnDay = (day) =>
    notices.filter(n => isSameDate(parseLocalDate(n.createdAt), day));

  const getDayColor = (dayEvents) => {
    if (!dayEvents.length) return '';
    const types = new Set(dayEvents.map(e => e.eventType));
    if (types.has('HOLIDAY')) return 'bg-red-200 text-red-900 border-red-300';
    if (types.has('EXAM')) return 'bg-emerald-200 text-emerald-900 border-emerald-300';
    return 'bg-yellow-200 text-yellow-900 border-yellow-300';
  };

  function prevMonth() {
    if (mode === 'BS') {
      if (bsMonth === 1) { setBsMonth(12); setBsYear(y => y - 1); } else { setBsMonth(m => m - 1); }
    } else if (adMonth === 0) {
      setAdMonth(11); setAdYear(y => y - 1);
    } else {
      setAdMonth(m => m - 1);
    }
  }

  function nextMonth() {
    if (mode === 'BS') {
      if (bsMonth === 12) { setBsMonth(1); setBsYear(y => y + 1); } else { setBsMonth(m => m + 1); }
    } else if (adMonth === 11) {
      setAdMonth(0); setAdYear(y => y + 1);
    } else {
      setAdMonth(m => m + 1);
    }
  }

  // Build the visible day cells. Each cell carries its own real AD date
  // (adDate) regardless of mode — that's what event/notice/today matching
  // is always done against, so accuracy doesn't depend on which mode is active.
  let cells = [];
  let headerLabel;

  if (mode === 'BS') {
    const firstOfMonthAd = bsToAd(bsYear, bsMonth, 1);
    const daysInMonth = daysInBsMonth(bsYear, bsMonth);
    const firstWeekday = firstOfMonthAd.getDay();
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ label: d, adDate: bsToAd(bsYear, bsMonth, d) });
    }
    headerLabel = `${NEPALI_MONTHS[bsMonth - 1]} ${bsYear}`;
  } else {
    const firstOfMonthAd = new Date(adYear, adMonth, 1);
    const daysInMonth = new Date(adYear, adMonth + 1, 0).getDate();
    const firstWeekday = firstOfMonthAd.getDay();
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ label: d, adDate: new Date(adYear, adMonth, d) });
    }
    headerLabel = `${ENGLISH_MONTHS[adMonth]} ${adYear}`;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Calendar" subtitle="Gregorian (AD) & Nepali (BS) dual calendar" />

      {/* BS Date Today */}
      <div className="bg-primary text-primary-foreground rounded-2xl p-6 text-center">
        <p className="text-sm opacity-70">Today (BS)</p>
        <p className="text-3xl font-bold mt-1">{todayBS.day} {todayBS.monthName} {todayBS.year}</p>
        <p className="text-sm opacity-70 mt-1">
          {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
          <div className="text-center">
            <h2 className="font-semibold text-foreground">{headerLabel}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="p-2 text-center text-xs font-semibold text-muted-foreground uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            if (!cell) {
              return <div key={idx} className="min-h-[72px] p-2 border-b border-r border-border bg-muted/30" />;
            }
            const dayEvents = eventsOnDay(cell.adDate);
            const dayNotices = noticesOnDay(cell.adDate);
            const badges = [
              ...dayEvents.map(e => ({ id: `e-${e.id}`, label: e.title, notice: false })),
              ...dayNotices.map(n => ({ id: `n-${n.id}`, label: n.title, notice: true })),
            ];
            const eventColor = getDayColor(dayEvents);
            const bs = mode === 'AD' ? adToBs(cell.adDate) : null;
            const isToday = isSameDate(cell.adDate, today);
            return (
              <div key={idx} className={cn(
                "min-h-[72px] p-2 border-b border-r border-border",
                eventColor,
                isToday && "bg-primary/5"
              )}>
                <span className={cn(
                  "text-sm font-medium",
                  isToday && "w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center"
                )}>
                  {cell.label}
                </span>
                {mode === 'AD' && bs && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {bs.day} {bs.monthName?.substring(0, 3)}
                  </p>
                )}
                {mode === 'BS' && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {ENGLISH_MONTHS[cell.adDate.getMonth()].substring(0, 3)} {cell.adDate.getDate()}
                  </p>
                )}
                {badges.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                    {badges.slice(0, 2).map(b => (
                      <span key={b.id} className={cn(
                        "rounded-full px-1 py-0.5 text-[9px] font-medium",
                        b.notice ? "bg-indigo-100 text-indigo-700" : "bg-white/80 text-slate-700"
                      )}>
                        {b.notice ? '📢 ' : ''}{b.label}
                      </span>
                    ))}
                    {badges.length > 2 && <span className="rounded-full bg-white/80 px-1 py-0.5 text-[9px] font-medium text-slate-700">+{badges.length - 2}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Months Reference — follows the AD/BS toggle instead of always showing Nepali months */}
      <div className="bg-card rounded-xl border p-4">
        <h3 className="text-sm font-semibold mb-3">{mode === 'AD' ? 'Gregorian Calendar Months' : 'Nepali Calendar Months'}</h3>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {(mode === 'AD' ? ENGLISH_MONTHS : NEPALI_MONTHS).map((month, idx) => (
            <div key={month} className={cn(
              "text-center p-2 rounded-lg text-xs",
              (mode === 'AD' ? today.getMonth() === idx : todayBS.month === idx + 1) ? "bg-primary text-primary-foreground" : "bg-secondary"
            )}>
              <p className="font-medium">{month}</p>
              <p className="text-[10px] opacity-70">Month {idx + 1}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
