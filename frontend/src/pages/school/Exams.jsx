import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trophy, Pencil, Trash2, Eye, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { examResultsApi, examsApi, subjectsApi, studentsApi, aiApi } from '@/api';
import { filterSubjectsByClass } from '@/lib/subjectFilter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ExamSchedulePage from './ExamSchedule';
import StudentCombobox from '@/components/shared/StudentCombobox';
import { getActiveCompanyId } from '@/lib/companyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

// ── Add Exam (creates a tab like "First Terminal" — no marks entry here) ───────

function AddExamDialog({ open, onClose, companyId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', examDate: '', notes: '' });

  const save = useMutation({
    mutationFn: () => examsApi.create({ name: form.name.trim(), examDate: form.examDate || undefined, notes: form.notes || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exams', companyId] });
      toast.success(t('exams.examAdded', { defaultValue: 'Exam added' }));
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('exams.failedToSaveExam', { defaultValue: 'Failed to save exam' })),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error(t('exams.examNameRequired', { defaultValue: 'Exam name is required' })); return; }
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('exams.addExam', { defaultValue: 'Add Exam' })}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          {t('exams.addExamHint', { defaultValue: 'Creates an exam tab (e.g. "First Terminal"). Add each student\'s marks afterwards using "Add Report Card".' })}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>{t('exams.examNameRequiredLabel', { defaultValue: 'Exam Name *' })}</Label>
            <Input placeholder={t('exams.examNamePlaceholder', { defaultValue: 'e.g. First Terminal 2081' })} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('exams.examDate', { defaultValue: 'Exam Date' })}</Label>
            <Input type="date" value={form.examDate} onChange={e => setForm(f => ({ ...f, examDate: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('exams.remarks', { defaultValue: 'Notes' })}</Label>
            <Input placeholder={t('exams.notesPlaceholder', { defaultValue: 'Optional notes' })} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('exams.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('exams.saving', { defaultValue: 'Saving…' }) : t('exams.addExam', { defaultValue: 'Add Exam' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Add / Edit Report Card (one subject's marks for one student in one exam) ───

function ReportCardEntryDialog({ open, onClose, initial, exams, companyId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [studentId, setStudentId] = useState(initial?.studentId || '');
  const [form, setForm] = useState({
    examId: initial?.examId || '',
    subjectId: initial?.subjectId || '',
    marksObtained: initial ? String(initial.marksObtained) : '',
    totalMarks: initial ? String(initial.totalMarks) : '',
    grade: initial?.grade || '',
    remarks: initial?.remarks || '',
    examDate: initial?.examDate ? initial.examDate.split('T')[0] : '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: student } = useQuery({
    queryKey: ['student-by-id', studentId],
    queryFn: () => studentsApi.get(studentId).then(r => r.data),
    enabled: !!studentId,
    staleTime: 60_000,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', companyId],
    queryFn: () => subjectsApi.list().then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (data) => isEdit ? examResultsApi.update(initial.id, data) : examResultsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exam-results'] });
      toast.success(isEdit ? t('exams.resultUpdated', { defaultValue: 'Result updated' }) : t('exams.resultAdded', { defaultValue: 'Report card entry added' }));
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('exams.failedToSaveResult', { defaultValue: 'Failed to save result' })),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!studentId) { toast.error(t('exams.selectAStudent', { defaultValue: 'Select a student' })); return; }
    if (!form.examId) { toast.error(t('exams.selectAnExam', { defaultValue: 'Select an exam' })); return; }
    if (!form.subjectId) { toast.error(t('exams.selectASubject', { defaultValue: 'Select a subject' })); return; }
    if (!form.marksObtained || !form.totalMarks) { toast.error(t('exams.enterMarks', { defaultValue: 'Enter marks' })); return; }
    save.mutate({
      studentId,
      examId: form.examId,
      subjectId: form.subjectId,
      marksObtained: parseFloat(form.marksObtained),
      totalMarks: parseFloat(form.totalMarks),
      grade: form.grade || undefined,
      remarks: form.remarks || undefined,
      examDate: form.examDate || undefined,
    });
  }

  const classLabel = student?.class ? `${student.class.name}${student.class.section ? ` (${student.class.section})` : ''}` : '—';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? t('exams.editReportCardEntry', { defaultValue: 'Edit Report Card Entry' }) : t('exams.addReportCard', { defaultValue: 'Add Report Card' })}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>{t('exams.studentRequired', { defaultValue: 'Student *' })}</Label>
            <StudentCombobox
              value={studentId}
              onChange={setStudentId}
              status=""
              placeholder={t('exams.selectStudent', { defaultValue: 'Search by name or roll number…' })}
              disabled={isEdit}
            />
            <p className="text-xs text-muted-foreground">{t('exams.sameNameHint', { defaultValue: 'If more than one student shares a name, keep typing their roll number to narrow it down.' })}</p>
          </div>

          {student && (
            <div className="grid grid-cols-3 gap-2 bg-muted/40 rounded-md p-2.5 text-xs">
              <div><span className="text-muted-foreground block">{t('exams.class', { defaultValue: 'Class' })}</span><span className="font-medium">{classLabel}</span></div>
              <div><span className="text-muted-foreground block">{t('exams.rollNumber', { defaultValue: 'Roll No.' })}</span><span className="font-medium">{student.rollNumber || '—'}</span></div>
              <div><span className="text-muted-foreground block">{t('exams.examRollNumber', { defaultValue: 'Exam Roll No.' })}</span><span className="font-medium">{student.examRollNumber || '—'}</span></div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('exams.examRequired', { defaultValue: 'Exam *' })}</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.examId} onChange={e => set('examId', e.target.value)}>
                <option value="">{t('exams.selectExam', { defaultValue: 'Select exam…' })}</option>
                {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('exams.subjectRequired', { defaultValue: 'Subject *' })}</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.subjectId} onChange={e => set('subjectId', e.target.value)} disabled={!studentId}>
                <option value="">{t('exams.selectSubject', { defaultValue: 'Select subject…' })}</option>
                {filterSubjectsByClass(subjects, student?.classId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('exams.marksObtainedRequired', { defaultValue: 'Marks Obtained *' })}</Label>
              <Input type="number" placeholder="75" value={form.marksObtained} onChange={e => set('marksObtained', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('exams.totalMarksRequired', { defaultValue: 'Total Marks *' })}</Label>
              <Input type="number" placeholder="100" value={form.totalMarks} onChange={e => set('totalMarks', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('exams.grade', { defaultValue: 'Grade' })}</Label>
              <Input placeholder={t('exams.gradePlaceholder', { defaultValue: 'A+, A, B…' })} value={form.grade} onChange={e => set('grade', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('exams.examDate', { defaultValue: 'Exam Date' })}</Label>
              <Input type="date" value={form.examDate} onChange={e => set('examDate', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('exams.remarks', { defaultValue: 'Remarks' })}</Label>
            <Input placeholder={t('exams.remarksPlaceholder', { defaultValue: 'Optional remarks' })} value={form.remarks} onChange={e => set('remarks', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('exams.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('exams.saving', { defaultValue: 'Saving…' }) : isEdit ? t('exams.save', { defaultValue: 'Save' }) : t('exams.addReportCard', { defaultValue: 'Add Report Card' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── View Report Card (read-only, aggregates all subjects for one student+exam) ─

function printReportCard(data) {
  const { student, results, company, examName, totalObtained, totalMax, percentage } = data;
  const className = student.class ? `${student.class.name}${student.class.section ? ` (${student.class.section})` : ''}` : '—';
  const rows = results.map(r => `
    <tr>
      <td style="border:1px solid #ddd;padding:8px">${r.subject?.name || '—'}</td>
      <td style="border:1px solid #ddd;padding:8px;text-align:center">${Number(r.totalMarks).toFixed(0)}</td>
      <td style="border:1px solid #ddd;padding:8px;text-align:center">${Number(r.marksObtained).toFixed(0)}</td>
      <td style="border:1px solid #ddd;padding:8px;text-align:center">${r.grade || '—'}</td>
      <td style="border:1px solid #ddd;padding:8px;text-align:center">${((Number(r.marksObtained) / Number(r.totalMarks)) * 100).toFixed(1)}%</td>
      <td style="border:1px solid #ddd;padding:8px">${r.remarks || ''}</td>
    </tr>
  `).join('');

  const w = window.open('', '_blank');
  w.document.write(`
    <html><head><title>Report Card</title>
    <style>
      body{font-family:serif;max-width:720px;margin:30px auto;padding:0 20px}
      h2{text-align:center;margin:0}
      .school{text-align:center;margin-bottom:20px}
      .info{display:flex;justify-content:space-between;margin:16px 0;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px}
      th{background:#f0f0f0;border:1px solid #ddd;padding:8px;text-align:left}
      .total{font-weight:bold;background:#f8f8f8}
      .footer{margin-top:50px;display:flex;justify-content:space-between;font-size:13px}
      @media print{button{display:none}}
    </style></head>
    <body>
    <div class="school">
      <h2>${company?.name || 'School'}</h2>
      ${company?.address ? `<p style="margin:4px 0;font-size:13px">${company.address}</p>` : ''}
      <h3 style="margin-top:12px">Report Card — ${examName}</h3>
    </div>
    <div class="info">
      <div><strong>Student:</strong> ${student.name}</div>
      <div><strong>Roll No:</strong> ${student.rollNumber || '—'}</div>
      <div><strong>Exam Roll No:</strong> ${student.examRollNumber || '—'}</div>
      <div><strong>Class:</strong> ${className}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Subject</th><th style="text-align:center">Full Marks</th><th style="text-align:center">Obtained</th><th style="text-align:center">Grade</th><th style="text-align:center">%</th><th>Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total">
          <td style="border:1px solid #ddd;padding:8px"><strong>Total</strong></td>
          <td style="border:1px solid #ddd;padding:8px;text-align:center"><strong>${totalMax}</strong></td>
          <td style="border:1px solid #ddd;padding:8px;text-align:center"><strong>${totalObtained}</strong></td>
          <td style="border:1px solid #ddd;padding:8px;text-align:center">—</td>
          <td style="border:1px solid #ddd;padding:8px;text-align:center"><strong>${percentage}%</strong></td>
          <td style="border:1px solid #ddd;padding:8px"></td>
        </tr>
      </tbody>
    </table>
    <div class="footer">
      <div>Class Teacher: _______________</div>
      <div>Principal: _______________</div>
    </div>
    <br><button onclick="window.print()">Print Report Card</button>
    </body></html>
  `);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

function ViewReportCardDialog({ open, onClose, studentId, examName }) {
  const { t } = useTranslation();
  const [aiComment, setAiComment] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const { data: cardData, isLoading } = useQuery({
    queryKey: ['report-card', studentId, examName],
    queryFn: () => examResultsApi.reportCard(studentId, examName).then(r => r.data),
    enabled: open && !!studentId && !!examName,
  });

  async function generateComment() {
    if (!cardData) return;
    setAiLoading(true);
    try {
      const res = await aiApi.reportCardComment({
        studentName: cardData.student?.name,
        examResults: cardData.results?.map(r => ({
          subject: r.subject?.name || 'Subject',
          marksObtained: r.marksObtained,
          totalMarks: r.totalMarks,
          grade: r.grade,
        })) || [],
      });
      setAiComment(res.data.comment);
    } catch (e) {
      toast.error(e?.response?.data?.message || t('exams.aiCommentFailed', { defaultValue: 'AI comment failed' }));
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('exams.reportCard', { defaultValue: 'Report Card' })} — {examName}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">{t('exams.loadingReportCard', { defaultValue: 'Loading report card…' })}</div>
          ) : cardData ? (
            <div className="text-sm bg-muted rounded-md p-3 space-y-2">
              <div className="font-medium">{cardData.student?.name}</div>
              <div className="text-muted-foreground">{t('exams.subjectsOverall', { count: cardData.results?.length, percentage: cardData.percentage, defaultValue: '{{count}} subjects · {{percentage}}% overall' })}</div>
              <button
                type="button"
                onClick={generateComment}
                disabled={aiLoading}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors disabled:opacity-50 mt-1"
              >
                <Sparkles className="w-3 h-3" />
                {aiLoading ? t('exams.writing', { defaultValue: 'Writing…' }) : t('exams.aiRemark', { defaultValue: 'AI Remark' })}
              </button>
              {aiComment && (
                <div className="mt-2 p-2 bg-violet-50 rounded border border-violet-100 text-xs text-gray-700 italic">
                  "{aiComment}"
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{t('exams.noRecordsFound', { defaultValue: 'No records found' })}</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('exams.close', { defaultValue: 'Close' })}</Button>
          {cardData && (
            <Button onClick={() => printReportCard(cardData)}>
              {t('exams.print', { defaultValue: 'Print' })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Exams() {
  const { t } = useTranslation();
  const companyId = getActiveCompanyId();
  const qc = useQueryClient();
  const [examDialog, setExamDialog] = useState(false);
  const [entryDialog, setEntryDialog] = useState(null);
  const [viewDialog, setViewDialog] = useState(null);
  const [filterExam, setFilterExam] = useState('');
  const [activeTab, setActiveTab] = useState('results');

  const { data: exams = [] } = useQuery({
    queryKey: ['exams', companyId],
    queryFn: () => examsApi.list().then(r => r.data),
    enabled: !!companyId,
  });

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['exam-results', companyId, filterExam],
    queryFn: () => examResultsApi.list(filterExam ? { examName: filterExam } : {}).then(r => r.data),
    enabled: !!companyId,
  });

  const remove = useMutation({
    mutationFn: (id) => examResultsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-results'] }); toast.success(t('exams.resultDeleted', { defaultValue: 'Result deleted' })); },
    onError: () => toast.error(t('exams.failedToDelete', { defaultValue: 'Failed to delete' })),
  });

  const filtered = filterExam ? results.filter(r => r.examName === filterExam) : results;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('exams.title', { defaultValue: 'Exam' })}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('exams.resultsRecorded', { count: results.length, defaultValue: '{{count}} results recorded' })}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setExamDialog(true)}>
              <Plus className="w-4 h-4 mr-2" /> {t('exams.addExam', { defaultValue: 'Add Exam' })}
            </Button>
            <Button onClick={() => setEntryDialog({ mode: 'add' })}>
              <Plus className="w-4 h-4 mr-2" /> {t('exams.addReportCard', { defaultValue: 'Add Report Card' })}
            </Button>
          </div>

          {exams.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterExam('')}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!filterExam ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
              >
                {t('exams.allExams', { defaultValue: 'All Exams' })}
              </button>
              {exams.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => setFilterExam(ex.name)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterExam === ex.name ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                >
                  {ex.name}
                </button>
              ))}
            </div>
          )}

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground text-sm">{t('exams.loadingResults', { defaultValue: 'Loading results…' })}</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">{t('exams.noExamResultsYet', { defaultValue: 'No exam results yet' })}</p>
                <Button className="mt-4" size="sm" onClick={() => setEntryDialog({ mode: 'add' })}>{t('exams.addReportCard', { defaultValue: 'Add Report Card' })}</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('exams.student', { defaultValue: 'Student' })}</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('exams.class', { defaultValue: 'Class' })}</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('exams.exam', { defaultValue: 'Exam' })}</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('exams.subject', { defaultValue: 'Subject' })}</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('exams.marks', { defaultValue: 'Marks' })}</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('exams.grade', { defaultValue: 'Grade' })}</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map(r => (
                      <tr key={r.id} className="hover:bg-muted/20">
                        <td className="px-5 py-3 font-medium">{r.student?.name || '—'}</td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">
                          {r.student?.class ? `${r.student.class.name}${r.student.class.section ? ` (${r.student.class.section})` : ''}` : '—'}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{r.examName}</td>
                        <td className="px-5 py-3 text-muted-foreground">{r.subject?.name || '—'}</td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {Number(r.marksObtained).toFixed(0)} / {Number(r.totalMarks).toFixed(0)}
                          <span className="text-muted-foreground ml-1 text-xs">
                            ({((Number(r.marksObtained) / Number(r.totalMarks)) * 100).toFixed(1)}%)
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {r.grade ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">{r.grade}</span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setViewDialog({ studentId: r.studentId, examName: r.examName })} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title={t('exams.viewReportCard', { defaultValue: 'View report card' })}>
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEntryDialog({ mode: 'edit', result: r })} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { if (window.confirm(t('exams.deleteThisResult', { defaultValue: 'Delete this result?' }))) remove.mutate(r.id); }} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-5">
          <ExamSchedulePage />
        </TabsContent>
      </Tabs>

      {examDialog && (
        <AddExamDialog open={examDialog} onClose={() => setExamDialog(false)} companyId={companyId} />
      )}

      {entryDialog && (
        <ReportCardEntryDialog
          open={!!entryDialog}
          onClose={() => setEntryDialog(null)}
          initial={entryDialog.mode === 'edit' ? entryDialog.result : null}
          exams={exams}
          companyId={companyId}
        />
      )}

      {viewDialog && (
        <ViewReportCardDialog
          open={!!viewDialog}
          onClose={() => setViewDialog(null)}
          studentId={viewDialog.studentId}
          examName={viewDialog.examName}
        />
      )}
    </div>
  );
}
