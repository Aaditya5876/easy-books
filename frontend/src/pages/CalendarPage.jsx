import { useState } from 'react';
import { getTodayBS, adToBs, NEPALI_MONTHS, ENGLISH_MONTHS } from '@/lib/nepaliDate';
import PageHeader from '../components/shared/PageHeader';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function CalendarPage() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const todayBS = getTodayBS();

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }

  // Generate calendar days
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const days = [];

  // Empty cells for days before first
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  const isToday = (day) => {
    return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
  };

  const getBSForDay = (day) => {
    if (!day) return null;
    return adToBs(new Date(currentYear, currentMonth, day));
  };

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
            <h2 className="font-semibold text-foreground">
              {ENGLISH_MONTHS[currentMonth]} {currentYear}
            </h2>
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
          {days.map((day, idx) => {
            const bs = getBSForDay(day);
            return (
              <div key={idx} className={cn(
                "min-h-[72px] p-2 border-b border-r border-border",
                !day && "bg-muted/30",
                isToday(day) && "bg-primary/5"
              )}>
                {day && (
                  <>
                    <span className={cn(
                      "text-sm font-medium",
                      isToday(day) && "w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center"
                    )}>
                      {day}
                    </span>
                    {bs && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {bs.day} {bs.monthName?.substring(0, 3)}
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Nepali Months Reference */}
      <div className="bg-card rounded-xl border p-4">
        <h3 className="text-sm font-semibold mb-3">Nepali Calendar Months</h3>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {NEPALI_MONTHS.map((month, idx) => (
            <div key={month} className={cn(
              "text-center p-2 rounded-lg text-xs",
              todayBS.month === idx + 1 ? "bg-primary text-primary-foreground" : "bg-secondary"
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