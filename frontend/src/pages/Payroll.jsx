import { useState, useEffect } from 'react';
import { api } from '@/api/adapter';
import { payrollApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SmartNumberInput } from "@/components/ui/smart-number-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, RefreshCw, Download, Calculator, Save, CalendarDays, Banknote } from 'lucide-react';
import { useRole } from "@/lib/useRole";
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';

const statusColors = { draft: 'bg-slate-100 text-slate-600', approved: 'bg-blue-100 text-blue-700', paid: 'bg-green-100 text-green-700' };

function getMonthOptions() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function calcLateMinutes(checkIn, expectedIn = '09:00') {
  if (!checkIn) return 0;
  const [eh, em] = expectedIn.split(':').map(Number);
  const [ah, am] = checkIn.split(':').map(Number);
  const diff = (ah * 60 + am) - (eh * 60 + em);
  return diff > 0 ? diff : 0;
}

export default function Payroll() {
  const { canEdit, canProcessPayroll } = useRole();
  const companyId = getActiveCompanyId();
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getMonthOptions()[0]);
  const [showDetail, setShowDetail] = useState(null);
  const [detailBonus, setDetailBonus] = useState(0);
  const [detailOtherDed, setDetailOtherDed] = useState(0);
  const [colFilters, setColFilters] = useState({ employee_name: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showGratuity, setShowGratuity] = useState(false);
  const [gratuityEmpId, setGratuityEmpId] = useState('');
  const [gratuityResult, setGratuityResult] = useState(null);
  const [gratuityLoading, setGratuityLoading] = useState(false);

  useEffect(() => { if (companyId) load(); }, [companyId]);

  async function load() {
    setLoading(true);
    const [pr, emp] = await Promise.all([
      api.Payroll.filter({ company_id: companyId }, '-month', 200),
      api.Employee.filter({ company_id: companyId }, 'name', 100),
    ]);
    setPayrolls(pr);
    setEmployees(emp);
    setLoading(false);
  }

  async function generatePayroll() {
    setGenerating(true);
    const [y, m] = selectedMonth.split('-').map(Number);
    const startDate = `${selectedMonth}-01`;
    const endDate = new Date(y, m, 0).toISOString().split('T')[0];

    const attendance = await api.Attendance.filter({ company_id: companyId }, 'date', 500);
    const monthAtt = attendance.filter(a => a.date >= startDate && a.date <= endDate);

    const daysInMonth = new Date(y, m, 0).getDate();
    const workingDays = Math.round(daysInMonth * 26 / 30); // approx working days

    for (const emp of employees) {
      const existing = payrolls.find(p => p.employee_id === emp.id && p.month === selectedMonth);
      if (existing) continue;

      const empAtt = monthAtt.filter(a => a.employee_id === emp.id);
      const present = empAtt.filter(a => a.status === 'present').length;
      const absent = empAtt.filter(a => a.status === 'absent').length;
      const half = empAtt.filter(a => a.status === 'half_day').length;

      const lateMinutes = empAtt.reduce((sum, a) => sum + calcLateMinutes(a.check_in), 0);

      const baseSalary = emp.salary || 0;
      const perDay = baseSalary / workingDays;
      const perMinute = baseSalary / (workingDays * 8 * 60);

      const absentDeduction = absent * perDay + half * perDay * 0.5;
      const lateDeduction = lateMinutes * perMinute;
      const netSalary = Math.max(0, baseSalary - absentDeduction - lateDeduction);

      await api.Payroll.create({
        company_id: companyId,
        employee_id: emp.id,
        employee_name: emp.name,
        month: selectedMonth,
        base_salary: baseSalary,
        working_days: workingDays,
        days_present: present,
        days_absent: absent,
        days_half: half,
        late_minutes: Math.round(lateMinutes),
        absent_deduction: Math.round(absentDeduction),
        late_deduction: Math.round(lateDeduction),
        other_deductions: 0,
        bonus: 0,
        net_salary: Math.round(netSalary),
        status: 'draft',
      });
    }
    setGenerating(false);
    load();
  }

  async function calculateGratuity() {
    if (!gratuityEmpId) return;
    setGratuityLoading(true);
    setGratuityResult(null);
    try {
      const res = await payrollApi.gratuity(gratuityEmpId);
      setGratuityResult(res.data?.data ?? res.data);
    } catch (err) {
      setGratuityResult({ error: err?.response?.data?.message || 'Calculation failed' });
    } finally {
      setGratuityLoading(false);
    }
  }

  const liveNet = showDetail ? Math.max(0,
    (showDetail.base_salary || 0) + detailBonus
    - (showDetail.absent_deduction || 0)
    - (showDetail.late_deduction || 0)
    - detailOtherDed
  ) : 0;

  async function savePayrollAdjustments() {
    if (!showDetail) return;
    await api.Payroll.update(showDetail.id, {
      bonus: detailBonus,
      other_deductions: detailOtherDed,
      net_salary: liveNet,
    });
    setShowDetail(null);
    load();
  }

  async function updateStatus(id, status) {
    await api.Payroll.update(id, { status });
    load();
  }

  function exportPDF(p) {
    const doc = new jsPDF();
    const company = employees.find(e => e.id === p.employee_id);

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('PAY SLIP', 105, 20, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Month: ${p.month}`, 20, 35);
    doc.text(`Employee: ${p.employee_name}`, 20, 43);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 51);

    doc.line(20, 57, 190, 57);

    doc.setFont(undefined, 'bold');
    doc.text('Earnings', 20, 66);
    doc.setFont(undefined, 'normal');
    doc.text('Base Salary', 25, 74);
    doc.text(`NPR ${p.base_salary?.toLocaleString()}`, 150, 74, { align: 'right' });
    doc.text('Bonus', 25, 82);
    doc.text(`NPR ${(p.bonus || 0).toLocaleString()}`, 150, 82, { align: 'right' });

    doc.line(20, 88, 190, 88);

    doc.setFont(undefined, 'bold');
    doc.text('Deductions', 20, 97);
    doc.setFont(undefined, 'normal');
    doc.text(`Absent (${p.days_absent} days)`, 25, 105);
    doc.text(`- NPR ${p.absent_deduction?.toLocaleString()}`, 150, 105, { align: 'right' });
    doc.text(`Late (${p.late_minutes} mins)`, 25, 113);
    doc.text(`- NPR ${p.late_deduction?.toLocaleString()}`, 150, 113, { align: 'right' });
    doc.text('Other Deductions', 25, 121);
    doc.text(`- NPR ${(p.other_deductions || 0).toLocaleString()}`, 150, 121, { align: 'right' });

    doc.line(20, 127, 190, 127);

    doc.setFont(undefined, 'bold');
    doc.setFontSize(13);
    doc.text('Net Salary', 20, 138);
    doc.text(`NPR ${p.net_salary?.toLocaleString()}`, 150, 138, { align: 'right' });

    doc.line(20, 143, 190, 143);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Attendance: ${p.days_present} Present | ${p.days_absent} Absent | ${p.days_half} Half Days`, 20, 155);
    doc.text(`Working Days: ${p.working_days}`, 20, 163);
    if (p.notes) doc.text(`Notes: ${p.notes}`, 20, 171);

    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text('This is a computer generated pay slip.', 105, 285, { align: 'center' });

    doc.save(`payslip_${p.employee_name?.replace(/\s+/g, '_')}_${p.month}.pdf`);
  }

  const monthPayrolls = payrolls.filter(p =>
    p.month === selectedMonth &&
    (!colFilters.employee_name || p.employee_name?.toLowerCase().includes(colFilters.employee_name.toLowerCase())) &&
    (!colFilters.status || p.status?.includes(colFilters.status))
  );

  const columns = [
    { key: 'employee_name', label: 'Employee', filterValue: colFilters.employee_name, onFilterChange: v => setCol('employee_name', v), render: r => <span className="font-medium">{r.employee_name}</span> },
    { key: 'base_salary', label: 'Base Salary', render: r => `NPR ${r.base_salary?.toLocaleString()}` },
    { key: 'days_present', label: 'Present' },
    { key: 'days_absent', label: 'Absent' },
    { key: 'late_minutes', label: 'Late (min)' },
    { key: 'absent_deduction', label: 'Absent Deduction', render: r => <span className="text-red-600">- NPR {r.absent_deduction?.toLocaleString()}</span> },
    { key: 'late_deduction', label: 'Late Deduction', render: r => <span className="text-red-600">- NPR {r.late_deduction?.toLocaleString()}</span> },
    { key: 'net_salary', label: 'Net Salary', render: r => <span className="font-semibold text-green-700">NPR {r.net_salary?.toLocaleString()}</span> },
    { key: 'status', label: 'Status', filterValue: colFilters.status, onFilterChange: v => setCol('status', v), render: r => (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[r.status] || ''}`}>{r.status}</span>
    )},
    { key: 'actions', label: 'Actions', render: r => (
      <div className="flex gap-2">
        {canEdit && (
          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setShowDetail(r); setDetailBonus(r.bonus || 0); setDetailOtherDed(r.other_deductions || 0); }}>Details</Button>
        )}
        <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); exportPDF(r); }}>
          <Download className="w-3 h-3 mr-1" /> PDF
        </Button>
      </div>
    )},
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Payroll" subtitle="Monthly salary calculation and pay slips">
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {getMonthOptions().map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => { setShowGratuity(true); setGratuityResult(null); setGratuityEmpId(''); }} className="gap-2">
            <Calculator className="w-4 h-4" /> Gratuity
          </Button>
          {canProcessPayroll && (
            <Button onClick={generatePayroll} disabled={generating} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Generating...' : 'Generate Payroll'}
            </Button>
          )}
        </div>
      </PageHeader>

      {monthPayrolls.length === 0 && (
        <EmptyState
          icon={FileText}
          title={`No payroll for ${selectedMonth}`}
          description='Click "Generate Payroll" to calculate salaries for this month.'
          action={canProcessPayroll ? (
            <Button onClick={generatePayroll} disabled={generating} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Generating...' : 'Generate Payroll'}
            </Button>
          ) : null}
        />
      )}

      {monthPayrolls.length > 0 && (
        <DataTable columns={columns} data={monthPayrolls} emptyMessage="No payroll records" />
      )}

      {/* Gratuity Dialog */}
      <Dialog open={showGratuity} onOpenChange={setShowGratuity}>
        <DialogContent className="glass-dialog max-w-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-purple-400 to-violet-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Calculator className="w-5 h-5 text-primary" /> Gratuity Calculator</DialogTitle>
          </DialogHeader>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Nepal Labour Act 2074 — requires 3+ years of continuous service.</p>
              <div className="space-y-1.5">
                <Label>Select Employee</Label>
                <Select value={gratuityEmpId} onValueChange={setGratuityEmpId}>
                  <SelectTrigger><SelectValue placeholder="Choose employee…" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={calculateGratuity} disabled={!gratuityEmpId || gratuityLoading} className="w-full gap-2">
                {gratuityLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                {gratuityLoading ? 'Calculating…' : 'Calculate'}
              </Button>
              {gratuityResult && !gratuityResult.error && (
                <div className="glass-card rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Eligible</span>
                    <span className={gratuityResult.eligible ? 'text-green-600 font-semibold' : 'text-red-500'}>
                      {gratuityResult.eligible ? 'Yes' : 'No (< 3 years)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service</span>
                    <span className="font-medium">{gratuityResult.monthsWorked ?? gratuityResult.months_worked ?? 0} months</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">Gratuity Amount</span>
                    <span className="font-bold text-lg text-green-700">
                      NPR {(gratuityResult.gratuityAmount ?? gratuityResult.gratuity_amount ?? 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              {gratuityResult?.error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{gratuityResult.error}</p>
              )}
            </div>
          </motion.div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGratuity(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {showDetail && (
        <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
          <DialogContent className="glass-dialog max-w-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-purple-400 to-violet-500 -mx-6 -mt-6 mb-4" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />Pay Slip — {showDetail.employee_name}
              </DialogTitle>
            </DialogHeader>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
              <div className="grid grid-cols-2 gap-5">
                {/* LEFT — Attendance Summary */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b pb-1.5 mb-2">
                    <CalendarDays className="w-3.5 h-3.5" />Attendance
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Month', value: showDetail.month, color: '' },
                      { label: 'Working Days', value: showDetail.working_days, color: '' },
                      { label: 'Present', value: showDetail.days_present, color: 'text-green-600 font-semibold' },
                      { label: 'Absent', value: showDetail.days_absent, color: 'text-red-500 font-semibold' },
                      { label: 'Half Days', value: showDetail.days_half, color: 'text-amber-600 font-semibold' },
                      { label: 'Late (min)', value: showDetail.late_minutes, color: '' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="glass-card rounded-lg p-2.5">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className={`text-sm font-semibold mt-0.5 ${color}`}>{value ?? '—'}</p>
                      </div>
                    ))}
                  </div>
                  <Select value={showDetail.status} onValueChange={v => { updateStatus(showDetail.id, v); setShowDetail({ ...showDetail, status: v }); }}>
                    <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* RIGHT — Salary Breakdown */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b pb-1.5 mb-2">
                    <Banknote className="w-3.5 h-3.5" />Salary Breakdown
                  </h4>
                  <div className="bg-secondary/50 rounded-xl p-3 space-y-2.5 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Base Salary</span>
                      <span className="font-semibold">NPR {showDetail.base_salary?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Bonus</span>
                      <SmartNumberInput value={detailBonus} onChange={e => setDetailBonus(parseFloat(e.target.value) || 0)} className="w-32 h-8 text-sm text-right" />
                    </div>
                    <div className="flex justify-between items-center text-red-600">
                      <span>Absent Deduction</span>
                      <span className="font-medium">− NPR {showDetail.absent_deduction?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-600">
                      <span>Late Deduction</span>
                      <span className="font-medium">− NPR {showDetail.late_deduction?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Other Deductions</span>
                      <SmartNumberInput value={detailOtherDed} onChange={e => setDetailOtherDed(parseFloat(e.target.value) || 0)} className="w-32 h-8 text-sm text-right" />
                    </div>
                    <div className="border-t pt-2.5 flex justify-between items-center">
                      <span className="font-bold text-base">Net Salary</span>
                      <span className="font-bold text-xl text-green-700">NPR {liveNet.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetail(null)}>Close</Button>
              <Button variant="outline" onClick={savePayrollAdjustments} className="gap-2"><Save className="w-4 h-4" />Save Adjustments</Button>
              <Button onClick={() => exportPDF(showDetail)} className="gap-2"><Download className="w-4 h-4" />Export PDF</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}