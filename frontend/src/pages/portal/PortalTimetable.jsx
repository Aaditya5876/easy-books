import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { portalApi } from '@/api';
import { Clock } from 'lucide-react';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DAY_SHORT = { MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat' };

export default function PortalTimetable() {
  const [student, setStudent] = useState(null);
  useEffect(() => {
    try { setStudent(JSON.parse(localStorage.getItem('portal_student') || 'null')); } catch {}
  }, []);

  const { data: timetable = [], isLoading } = useQuery({
    queryKey: ['portal-timetable', student?.classId],
    queryFn: () => portalApi.timetable(student?.classId).then(r => r.data),
    enabled: !!student,
  });

  const byDay = DAYS.reduce((acc, d) => {
    acc[d] = timetable.filter(e => e.dayOfWeek === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
    return acc;
  }, {});

  const activeDays = DAYS.filter(d => byDay[d].length > 0);

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">Timetable</h1>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : timetable.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No timetable set for your class yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeDays.map(day => (
            <div key={day} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-emerald-600 text-white">
                <h2 className="font-semibold text-sm">{DAY_SHORT[day] || day}</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {byDay[day].map(e => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-16 text-xs text-gray-400 tabular-nums shrink-0">
                      {e.startTime}<br />{e.endTime}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{e.subject?.name || e.subjectName || '—'}</p>
                      {e.teacherName && <p className="text-xs text-gray-400">{e.teacherName}</p>}
                    </div>
                    {e.room && <span className="text-xs text-gray-400 shrink-0">{e.room}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
