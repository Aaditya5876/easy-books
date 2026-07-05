import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { studentAttendanceApi, classesApi, academicYearsApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserCheck, Save, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_OPTIONS = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
const STATUS_COLORS = {
  PRESENT: 'bg-green-100 text-green-800 border-green-200',
  ABSENT: 'bg-red-100 text-red-800 border-red-200',
  LATE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  EXCUSED: 'bg-blue-100 text-blue-800 border-blue-200',
};

const companyId = () => localStorage.getItem('easybooks_active_company') || '';

export default function StudentAttendance() {
  const { t } = useTranslation();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(today);
  const [statuses, setStatuses] = useState({});

  // Report state
  const [reportClassId, setReportClassId] = useState('');
  const [reportStart, setReportStart] = useState('');
  const [reportEnd, setReportEnd] = useState('');
  const [reportFetch, setReportFetch] = useState(false);

  const { data: classes = [] } = useQuery({
    queryKey: ['school-classes'],
    queryFn: () => classesApi.list().then(r => r.data),
  });

  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => academicYearsApi.list().then(r => r.data),
  });

  const currentYear = useMemo(() => academicYears.find(y => y.isCurrent), [academicYears]);

  const { data: attendanceRows = [], isLoading, refetch } = useQuery({
    queryKey: ['student-attendance', classId, date],
    queryFn: () => studentAttendanceApi.get(classId, date).then(r => r.data),
    enabled: !!classId && !!date,
    onSuccess: (rows) => {
      const map = {};
      rows.forEach(r => { map[r.studentId] = r.status; });
      setStatuses(map);
    },
  });

  // Initialize statuses from fetched data
  const rows = useMemo(() => {
    return attendanceRows.map(r => ({
      ...r,
      currentStatus: statuses[r.studentId] ?? r.status,
    }));
  }, [attendanceRows, statuses]);

  const save = useMutation({
    mutationFn: (entries) =>
      studentAttendanceApi.save({
        companyId: companyId(),
        classId,
        date,
        academicYearId: currentYear?.id,
        entries,
      }),
    onSuccess: () => {
      toast.success(t('attendance.saved', { defaultValue: 'Attendance saved' }));
      refetch();
    },
    onError: (e) => toast.error(e.response?.data?.message || t('attendance.failedToSave', { defaultValue: 'Failed to save' })),
  });

  const handleSave = () => {
    if (!classId) return toast.error(t('attendance.selectClassFirst', { defaultValue: 'Select a class first' }));
    const entries = rows.map(r => ({ studentId: r.studentId, status: statuses[r.studentId] || 'PRESENT' }));
    save.mutate(entries);
  };

  const markAll = (status) => {
    const map = {};
    rows.forEach(r => { map[r.studentId] = status; });
    setStatuses(map);
  };

  const { data: reportData = [], isLoading: reportLoading } = useQuery({
    queryKey: ['attendance-report', reportClassId, reportStart, reportEnd],
    queryFn: () => studentAttendanceApi.report(reportClassId, reportStart, reportEnd).then(r => r.data),
    enabled: reportFetch && !!reportClassId && !!reportStart && !!reportEnd,
  });

  const presentCount = rows.filter(r => (statuses[r.studentId] || r.status) === 'PRESENT').length;
  const absentCount = rows.filter(r => (statuses[r.studentId] || r.status) === 'ABSENT').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <UserCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">{t('attendance.title', { defaultValue: 'Student Attendance' })}</h1>
      </div>

      <Tabs defaultValue="mark">
        <TabsList>
          <TabsTrigger value="mark">{t('attendance.markTab', { defaultValue: 'Mark Attendance' })}</TabsTrigger>
          <TabsTrigger value="report">{t('attendance.reportTab', { defaultValue: 'Report' })}</TabsTrigger>
        </TabsList>

        <TabsContent value="mark" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-card rounded-lg border p-4">
            <div className="space-y-1">
              <Label>{t('attendance.classRequired', { defaultValue: 'Class *' })}</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder={t('attendance.selectClass', { defaultValue: 'Select class' })} /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.section ? ` (${c.section})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('attendance.date', { defaultValue: 'Date' })}</Label>
              <input
                type="date"
                value={date}
                max={today}
                onChange={e => setDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              />
            </div>
            <div className="flex items-end gap-2 col-span-2">
              <Button variant="outline" size="sm" onClick={() => markAll('PRESENT')}>{t('attendance.allPresent', { defaultValue: 'All Present' })}</Button>
              <Button variant="outline" size="sm" onClick={() => markAll('ABSENT')}>{t('attendance.allAbsent', { defaultValue: 'All Absent' })}</Button>
              <Button onClick={handleSave} disabled={save.isPending || rows.length === 0} className="ml-auto">
                <Save className="h-4 w-4 mr-1" />
                {save.isPending ? t('attendance.saving', { defaultValue: 'Saving…' }) : t('attendance.save', { defaultValue: 'Save' })}
              </Button>
            </div>
          </div>

          {classId && rows.length > 0 && (
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span className="font-medium text-green-700">{t('attendance.presentCount', { defaultValue: 'Present: {{count}}', count: presentCount })}</span>
              <span className="font-medium text-red-700">{t('attendance.absentCount', { defaultValue: 'Absent: {{count}}', count: absentCount })}</span>
              <span>{t('attendance.totalCount', { defaultValue: 'Total: {{count}}', count: rows.length })}</span>
            </div>
          )}

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>{t('attendance.rollNo', { defaultValue: 'Roll No' })}</TableHead>
                  <TableHead>{t('attendance.studentName', { defaultValue: 'Student Name' })}</TableHead>
                  <TableHead>{t('attendance.status', { defaultValue: 'Status' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!classId ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      {t('attendance.selectClassAndDate', { defaultValue: 'Select a class and date to mark attendance' })}
                    </TableCell>
                  </TableRow>
                ) : isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t('attendance.loading', { defaultValue: 'Loading…' })}</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      {t('attendance.noActiveStudents', { defaultValue: 'No active students in this class' })}
                    </TableCell>
                  </TableRow>
                ) : rows.map((r, i) => (
                  <TableRow key={r.studentId}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-mono text-sm">{r.rollNumber || '—'}</TableCell>
                    <TableCell className="font-medium">{r.studentName}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {STATUS_OPTIONS.map(s => (
                          <button
                            key={s}
                            onClick={() => setStatuses(p => ({ ...p, [r.studentId]: s }))}
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all ${
                              (statuses[r.studentId] || r.status) === s
                                ? STATUS_COLORS[s]
                                : 'bg-muted text-muted-foreground border-transparent hover:border-border'
                            }`}
                          >
                            {t(`attendance.status_${s}`, { defaultValue: s.charAt(0) + s.slice(1).toLowerCase() })}
                          </button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="report" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-card rounded-lg border p-4">
            <div className="space-y-1">
              <Label>{t('attendance.class', { defaultValue: 'Class' })}</Label>
              <Select value={reportClassId} onValueChange={v => { setReportClassId(v); setReportFetch(false); }}>
                <SelectTrigger><SelectValue placeholder={t('attendance.selectClass', { defaultValue: 'Select class' })} /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.section ? ` (${c.section})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('attendance.fromDate', { defaultValue: 'From Date' })}</Label>
              <input type="date" value={reportStart} onChange={e => { setReportStart(e.target.value); setReportFetch(false); }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" />
            </div>
            <div className="space-y-1">
              <Label>{t('attendance.toDate', { defaultValue: 'To Date' })}</Label>
              <input type="date" value={reportEnd} onChange={e => { setReportEnd(e.target.value); setReportFetch(false); }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" />
            </div>
            <div className="flex items-end">
              <Button onClick={() => setReportFetch(true)} disabled={!reportClassId || !reportStart || !reportEnd}>
                <BarChart2 className="h-4 w-4 mr-1" /> {t('attendance.generate', { defaultValue: 'Generate' })}
              </Button>
            </div>
          </div>

          {reportFetch && (
            <div className="rounded-md border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('attendance.rollNo', { defaultValue: 'Roll No' })}</TableHead>
                    <TableHead>{t('attendance.studentName', { defaultValue: 'Student Name' })}</TableHead>
                    <TableHead className="text-center">{t('attendance.present', { defaultValue: 'Present' })}</TableHead>
                    <TableHead className="text-center">{t('attendance.absent', { defaultValue: 'Absent' })}</TableHead>
                    <TableHead className="text-center">{t('attendance.late', { defaultValue: 'Late' })}</TableHead>
                    <TableHead className="text-center">{t('attendance.excused', { defaultValue: 'Excused' })}</TableHead>
                    <TableHead className="text-center">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t('attendance.loading', { defaultValue: 'Loading…' })}</TableCell></TableRow>
                  ) : reportData.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t('attendance.noRecords', { defaultValue: 'No records found' })}</TableCell></TableRow>
                  ) : reportData.map(r => {
                    const total = r.present + r.absent + r.late + r.excused;
                    const pct = total > 0 ? Math.round(((r.present + r.late) / total) * 100) : 0;
                    return (
                      <TableRow key={r.studentId}>
                        <TableCell className="font-mono text-sm">{r.rollNumber || '—'}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-center text-green-700 font-semibold">{r.present}</TableCell>
                        <TableCell className="text-center text-red-700 font-semibold">{r.absent}</TableCell>
                        <TableCell className="text-center text-yellow-700">{r.late}</TableCell>
                        <TableCell className="text-center text-blue-700">{r.excused}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={pct >= 75 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {pct}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
