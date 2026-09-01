import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { attendanceApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, Fingerprint, AlertTriangle } from 'lucide-react';

export default function MyAttendance() {
  const { t } = useTranslation();
  const companyId = getActiveCompanyId();
  const qc = useQueryClient();
  const [marking, setMarking] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['my-attendance-today', companyId],
    queryFn: () => attendanceApi.selfToday().then(r => r.data),
    enabled: !!companyId,
  });

  async function mark(action) {
    setMarking(true);
    try {
      await attendanceApi.selfMark(action);
      toast.success(action === 'IN'
        ? t('myAttendance.checkedIn', { defaultValue: 'Checked in successfully' })
        : t('myAttendance.checkedOut', { defaultValue: 'Checked out successfully' }));
      qc.invalidateQueries({ queryKey: ['my-attendance-today'] });
    } catch (err) {
      toast.error(err?.response?.data?.message || t('myAttendance.markFailed', { defaultValue: 'Could not mark attendance' }));
    } finally {
      setMarking(false);
    }
  }

  const record = data?.record;
  const notLinked = data && !data.linked;
  const onLeave = record?.status === 'LEAVE';
  const canCheckIn = data?.linked && !onLeave && !record?.checkInTime;
  const canCheckOut = data?.linked && !onLeave && record?.checkInTime && !record?.checkOutTime;
  const doneForToday = data?.linked && record?.checkInTime && record?.checkOutTime;

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title={t('myAttendance.title', { defaultValue: 'My Attendance' })}
        subtitle={t('myAttendance.subtitle', { defaultValue: 'Check yourself in and out for the day' })}
      />

      <div className="bg-white rounded-xl border border-border p-6 max-w-md">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">{t('common.loading', { defaultValue: 'Loading…' })}</div>
        ) : notLinked ? (
          <div className="flex gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              {t('myAttendance.notLinked', { defaultValue: 'No employee record is linked to your account yet. Ask an admin to set your employee email to match your login email.' })}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Fingerprint className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-sm">{data.employeeName}</p>
                <p className="text-xs text-muted-foreground">
                  {onLeave
                    ? t('myAttendance.onLeave', { defaultValue: "You're marked on leave today" })
                    : doneForToday
                      ? t('myAttendance.doneForToday', { defaultValue: 'In {{in}} · Out {{out}}', in: record.checkInTime, out: record.checkOutTime })
                      : record?.checkInTime
                        ? t('myAttendance.checkedInAtStatus', { defaultValue: 'Checked in at {{time}}', time: record.checkInTime })
                        : t('myAttendance.notCheckedInYet', { defaultValue: 'Not checked in yet' })}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 gap-2" disabled={!canCheckIn || marking} onClick={() => mark('IN')}>
                <LogIn className="w-4 h-4" /> {t('myAttendance.checkIn', { defaultValue: 'Check In' })}
              </Button>
              <Button variant="outline" className="flex-1 gap-2" disabled={!canCheckOut || marking} onClick={() => mark('OUT')}>
                <LogOut className="w-4 h-4" /> {t('myAttendance.checkOut', { defaultValue: 'Check Out' })}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
