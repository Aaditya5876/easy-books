import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trophy, Pencil, Trash2, FileText, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { examResultsApi, studentsApi, subjectsApi, aiApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';

const EMPTY_FORM = { studentId: '', subjectId: '', examName: '', marksObtained: '', totalMarks: '', grade: '', remarks: '', examDate: '' };

function ExamDialog({ open, onClose, initial, students, subjects, companyId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(initial ? { ...EMPTY_FORM, ...initial, marksObtained: String(initial.marksObtained), totalMarks: String(initial.totalMarks) } : EMPTY_FORM);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (data) =>
      isEdit ? examResultsApi.update(initial.id, data) : examResultsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exam-results'] });
      toast.success(isEdit ? t('exams.resultUpdated', { defaultValue: 'Result updated' }) : t('exams.resultAdded', { defaultValue: 'Result added' }));
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('exams.failedToSaveResult', { defaultValue: 'Failed to save result' })),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.studentId) { toast.error(t('exams.selectAStudent', { defaultValue: 'Select a student' })); return; }
    if (!form.examName.trim()) { toast.error(t('exams.examNameRequired', { defaultValue: 'Exam name is required' })); return; }
    if (!form.marksObtained || !form.totalMarks) { toast.error(t('exams.enterMarks', { defaultValue: 'Enter marks' })); return; }
    save.mutate({
      ...form,
      marksObtained: parseFloat(form.marksObtained),
      totalMarks: parseFloat(form.totalMarks),
      companyId,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{isEdit ? t('exams.editResult', { defaultValue: 'Edit Result' }) : t('exams.addExamResult', { defaultValue: 'Add Exam Result' })}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>{t('exams.studentRequired', { defaultValue: 'Student *' })}</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={form.studentId} onChange={e => set('studentId', e.target.value)}>
              <option value="">{t('exams.selectStudent', { defaultValue: 'Select student…' })}</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.rollNumber ? `(${s.rollNumber})` : ''}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('exams.subject', { defaultValue: 'Subject' })}</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={form.subjectId} onChange={e => set('subjectId', e.target.value)}>
              <option value="">{t('exams.selectSubject', { defaultValue: 'Select subject…' })}</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('exams.examNameRequiredLabel', { defaultValue: 'Exam Name *' })}</Label>
            <Input placeholder={t('exams.examNamePlaceholder', { defaultValue: 'e.g. First Terminal 2081' })} value={form.examName} onChange={e => set('examName', e.target.value)} />
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
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('exams.saving', { defaultValue: 'Saving…' }) : isEdit ? t('exams.save', { defaultValue: 'Save' }) : t('exams.addResult', { defaultValue: 'Add Result' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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

function ReportCardDialog({ open, onClose, students, examNames }) {
  const { t } = useTranslation();
  const companyId = getActiveCompanyId();
  const [studentId, setStudentId] = useState('');
  const [examName, setExamName] = useState('');
  const [fetching, setFetching] = useState(false);
  const [aiComment, setAiComment] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const { data: cardData, isLoading } = useQuery({
    queryKey: ['report-card', studentId, examName],
    queryFn: () => examResultsApi.reportCard(studentId, examName).then(r => r.data),
    enabled: fetching && !!studentId && !!examName,
  });

  const handleGenerate = () => {
    if (!studentId) { toast.error(t('exams.selectAStudent', { defaultValue: 'Select a student' })); return; }
    if (!examName) { toast.error(t('exams.selectAnExam', { defaultValue: 'Select an exam' })); return; }
    setFetching(true);
  };

  async function generateComment() {
    if (!cardData) { toast.error(t('exams.generateReportCardFirst', { defaultValue: 'Generate report card first' })); return; }
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
        <DialogHeader><DialogTitle>{t('exams.generateReportCard', { defaultValue: 'Generate Report Card' })}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>{t('exams.studentRequired', { defaultValue: 'Student *' })}</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={studentId}
              onChange={e => { setStudentId(e.target.value); setFetching(false); }}
            >
              <option value="">{t('exams.selectStudent', { defaultValue: 'Select student…' })}</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.rollNumber ? `(${s.rollNumber})` : ''}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>{t('exams.examRequired', { defaultValue: 'Exam *' })}</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={examName}
              onChange={e => { setExamName(e.target.value); setFetching(false); }}
            >
              <option value="">{t('exams.selectExam', { defaultValue: 'Select exam…' })}</option>
              {examNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {isLoading && <div className="text-sm text-muted-foreground">{t('exams.loadingReportCard', { defaultValue: 'Loading report card…' })}</div>}
          {cardData && !isLoading && (
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
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('exams.close', { defaultValue: 'Close' })}</Button>
          <Button onClick={handleGenerate} disabled={isLoading}>
            {isLoading ? t('exams.loading', { defaultValue: 'Loading…' }) : t('exams.generate', { defaultValue: 'Generate' })}
          </Button>
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
  const [dialog, setDialog] = useState(null);
  const [reportCardDialog, setReportCardDialog] = useState(false);
  const [filterExam, setFilterExam] = useState('');

  const { data: students = [] } = useQuery({
    queryKey: ['students', companyId],
    queryFn: () => studentsApi.list().then(r => r.data),
    enabled: !!companyId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', companyId],
    queryFn: () => subjectsApi.list().then(r => r.data),
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

  const examNames = [...new Set(results.map(r => r.examName))];
  const filtered = filterExam ? results.filter(r => r.examName === filterExam) : results;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('exams.title', { defaultValue: 'Exams & Results' })}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('exams.resultsRecorded', { count: results.length, defaultValue: '{{count}} results recorded' })}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setReportCardDialog(true)}>
            <FileText className="w-4 h-4 mr-2" /> {t('exams.reportCard', { defaultValue: 'Report Card' })}
          </Button>
          <Button onClick={() => setDialog({ mode: 'add' })}>
            <Plus className="w-4 h-4 mr-2" /> {t('exams.addResult', { defaultValue: 'Add Result' })}
          </Button>
        </div>
      </div>

      {examNames.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterExam('')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!filterExam ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
          >
            {t('exams.allExams', { defaultValue: 'All Exams' })}
          </button>
          {examNames.map(name => (
            <button
              key={name}
              onClick={() => setFilterExam(name)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterExam === name ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
            >
              {name}
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
            <Button className="mt-4" size="sm" onClick={() => setDialog({ mode: 'add' })}>{t('exams.addFirstResult', { defaultValue: 'Add First Result' })}</Button>
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
                        <button onClick={() => setDialog({ mode: 'edit', result: r })} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
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

      {dialog && (
        <ExamDialog
          open={!!dialog}
          onClose={() => setDialog(null)}
          initial={dialog.mode === 'edit' ? dialog.result : null}
          students={students}
          subjects={subjects}
          companyId={companyId}
        />
      )}

      {reportCardDialog && (
        <ReportCardDialog
          open={reportCardDialog}
          onClose={() => setReportCardDialog(false)}
          students={students}
          examNames={examNames}
        />
      )}
    </div>
  );
}
