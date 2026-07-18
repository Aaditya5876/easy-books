import { useState, useEffect } from 'react';
import { api } from '@/api/adapter';
import { payrollApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import { Button } from "@/components/ui/button";
import { SmartNumberInput } from "@/components/ui/smart-number-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, RefreshCw, Download, Calculator, Save, CalendarDays, Banknote, PauseCircle, PlayCircle, CheckCircle2 } from 'lucide-react';
import { useRole } from "@/lib/useRole";
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import NepaliDate from 'nepali-date-converter';

const statusColors = {
  PENDING: 'bg-slate-100 text-slate-600',
  PROCESSED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  ON_HOLD: 'bg-amber-100 text-amber-700',
};
const statusLabels = { PENDING: 'Pending', PROCESSED: 'Processed', PAID: 'Paid', ON_HOLD: 'On Hold' };

const num = (v) => Number(v) || 0;
const npr = (v) => `NPR ${num(v).toLocaleString()}`;

// Payroll months are Bikram Sambat (the backend engine converts BS month -> AD attendance range)
function getBsMonthOptions() {
  const months = [];
  const today = new NepaliDate();
  let y = today.getYear();
  let m = today.getMonth() + 1; // NepaliDate months are 0-indexed
  for (let i = 0; i < 12; i++) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m < 1) { m = 12; y -= 1; }
  }
  return months;
}

export default function Payroll() {
  const { canEdit, canProcessPayroll } = useRole();
  const companyId = getActiveCompanyId();
  const [payrolls, setPayrolls] = useState([]);
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getBsMonthOptions()[0]);
  const [showDetail, setShowDetail] = useState(null);
  const [detailOtherDed, setDetailOtherDed] = useState(0);
  const [colFilters, setColFilters] = useState({ employee_name: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [showGratuity, setShowGratuity] = useState(false);
  const [gratuityEmpId, setGratuityEmpId] = useState('');
  const [gratuityResult, setGratuityResult] = useState(null);
  const [gratuityLoading, setGratuityLoading] = useState(false);

  useEffect(() => { if (companyId) load(); }, [companyId, selectedMonth]);

  async function load() {
    setLoading(true);
    try {
      const [prRes, emp] = await Promise.all([
        payrollApi.summary(selectedMonth),
        api.Employee.filter({ company_id: companyId }, 'name', 100),
      ]);
      const payload = prRes.data?.data ?? prRes.data;
      setPayrolls(payload?.payrolls ?? []);
      setSummary(payload?.summary ?? null);
      setEmployees(emp);
    } finally {
      setLoading(false);
    }
  }

  async function generatePayroll() {
    setGenerating(true);
    try {
      await payrollApi.process(selectedMonth);
      // Processing runs async via BullMQ — poll briefly until rows show up
      const activeCount = employees.filter(e => (e.status || 'ACTIVE') === 'ACTIVE').length;
      for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 700));
        const res = await payrollApi.summary(selectedMonth);
        const payload = res.data?.data ?? res.data;
        if ((payload?.payrolls?.length || 0) >= activeCount) break;
      }
      await load();
      toast.success('Payroll generated');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to generate payroll');
    } finally {
      setGenerating(false);
    }
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

  const dashainBonusOf = (p) => (p.isDashainBonus ? num(p.basicSalary) : 0);

  const liveNet = showDetail ? Math.max(0,
    num(showDetail.grossSalary)
    - num(showDetail.absentDeduction)
    - num(showDetail.ssfEmployee)
    - num(showDetail.pit)
    + num(showDetail.overtimeAmount)
    + dashainBonusOf(showDetail)
    - detailOtherDed
  ) : 0;

  async function savePayrollAdjustments() {
    if (!showDetail) return;
    try {
      await payrollApi.adjust(showDetail.id, detailOtherDed);
      toast.success('Adjustments saved');
      setShowDetail(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to save adjustments');
    }
  }

  async function markPaid(id) {
    try {
      await payrollApi.markPaid(id);
      toast.success('Marked as paid');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to mark as paid');
    }
  }

  async function toggleHold(p) {
    try {
      await payrollApi.setHold(p.id, !p.isOnHold);
      toast.success(p.isOnHold ? 'Hold released' : 'Payroll put on hold');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to update hold status');
    }
  }

  function exportPDF(p) {
    const doc = new jsPDF();
    const name = p.employee?.name || '—';

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('PAY SLIP', 105, 20, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Month (BS): ${p.month}`, 20, 35);
    doc.text(`Employee: ${name}`, 20, 43);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 51);

    doc.line(20, 57, 190, 57);

    doc.setFont(undefined, 'bold');
    doc.text('Earnings', 20, 66);
    doc.setFont(undefined, 'normal');
    doc.text('Basic Salary', 25, 74);
    doc.text(npr(p.basicSalary), 150, 74, { align: 'right' });
    doc.text('Allowances', 25, 82);
    doc.text(npr(p.allowances), 150, 82, { align: 'right' });
    if (p.isDashainBonus) {
      doc.text('Dashain Bonus', 25, 90);
      doc.text(npr(p.basicSalary), 150, 90, { align: 'right' });
    }
    doc.text('Overtime', 25, 98);
    doc.text(npr(p.overtimeAmount), 150, 98, { align: 'right' });

    doc.line(20, 104, 190, 104);

    doc.setFont(undefined, 'bold');
    doc.text('Deductions', 20, 113);
    doc.setFont(undefined, 'normal');
    doc.text(`Absent / Half Days (${p.absentDays}/${p.halfDays})`, 25, 121);
    doc.text(`- ${npr(p.absentDeduction)}`, 150, 121, { align: 'right' });
    doc.text('SSF (Employee)', 25, 129);
    doc.text(`- ${npr(p.ssfEmployee)}`, 150, 129, { align: 'right' });
    doc.text('Income Tax (PIT)', 25, 137);
    doc.text(`- ${npr(p.pit)}`, 150, 137, { align: 'right' });
    doc.text('Other Deductions', 25, 145);
    doc.text(`- ${npr(p.otherDeductions)}`, 150, 145, { align: 'right' });

    doc.line(20, 151, 190, 151);

    doc.setFont(undefined, 'bold');
    doc.setFontSize(13);
    doc.text('Net Salary', 20, 162);
    doc.text(npr(p.netSalary), 150, 162, { align: 'right' });

    doc.line(20, 167, 190, 167);

    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text('This is a computer generated pay slip.', 105, 285, { align: 'center' });

    doc.save(`payslip_${name.replace(/\s+/g, '_')}_${p.month}.pdf`);
  }

  const filteredPayrolls = payrolls.filter(p =>
    (!colFilters.employee_name || p.employee?.name?.toLowerCase().includes(colFilters.employee_name.toLowerCase())) &&
    (!colFilters.status || p.status === colFilters.status)
  );

  const columns = [
    { key: 'employee_name', label: 'Employee', filterValue: colFilters.employee_name, onFilterChange: v => setCol('employee_name', v), render: r => <span className="font-medium">{r.employee?.name || '—'}</span> },
    { key: 'basicSalary', label: 'Basic Salary', render: r => npr(r.basicSalary) },
    { key: 'grossSalary', label: 'Gross Salary', render: r => npr(r.grossSalary) },
    { key: 'absentDays', label: 'Absent', render: r => r.absentDays },
    { key: 'halfDays', label: 'Half Day', render: r => r.halfDays },
    { key: 'ssfEmployee', label: 'SSF', render: r => npr(r.ssfEmployee) },
    { key: 'pit', label: 'Tax (PIT)', render: r => npr(r.pit) },
    { key: 'netSalary', label: 'Net Salary', render: r => <span className="font-semibold text-green-700">{npr(r.netSalary)}</span> },
    { key: 'status', label: 'Status', filterValue: colFilters.status, onFilterChange: v => setCol('status', v), render: r => (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[r.status] || ''}`}>{statusLabels[r.status] || r.status}</span>
    )},
    { key: 'actions', label: 'Actions', render: r => (
      <div className="flex gap-2">
        {canEdit && (
          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setShowDetail(r); setDetailOtherDed(num(r.otherDeductions)); }}>Details</Button>
        )}
        {canProcessPayroll && r.status === 'PROCESSED' && (
          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); markPaid(r.id); }}>
            <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Paid
          </Button>
        )}
        {canProcessPayroll && r.status !== 'PAID' && (
          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); toggleHold(r); }}>
            {r.isOnHold ? <PlayCircle className="w-3 h-3 mr-1" /> : <PauseCircle className="w-3 h-3 mr-1" />}
            {r.isOnHold ? 'Release' : 'Hold'}
          </Button>
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
      <PageHeader title="Payroll" subtitle="Monthly salary calculation and pay slips (BS month)">
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {getBsMonthOptions().map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
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

      {summary && payrolls.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass-card rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Employees</p>
            <p className="text-lg font-semibold">{summary.count}</p>
          </div>
          <div className="glass-card rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Total Gross</p>
            <p className="text-lg font-semibold">{npr(summary.totalGross)}</p>
          </div>
          <div className="glass-card rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Total Net Payable</p>
            <p className="text-lg font-semibold text-green-700">{npr(summary.totalNetSalary)}</p>
          </div>
          <div className="glass-card rounded-lg p-3">
            <p className="text-xs text-muted-foreground">On Hold</p>
            <p className="text-lg font-semibold">{summary.onHoldCount}</p>
          </div>
        </div>
      )}

      {payrolls.length === 0 && (
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

      {payrolls.length > 0 && (
        <DataTable columns={columns} data={filteredPayrolls} emptyMessage="No payroll records" />
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
                    <span className="font-medium">{gratuityResult.monthsWorked ?? 0} months</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">Gratuity Amount</span>
                    <span className="font-bold text-lg text-green-700">
                      {npr(gratuityResult.gratuityAmount ?? 0)}
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
                <FileText className="w-5 h-5 text-primary" />Pay Slip — {showDetail.employee?.name || '—'}
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
                      { label: 'Month (BS)', value: showDetail.month, color: '' },
                      { label: 'Absent Days', value: showDetail.absentDays, color: 'text-red-500 font-semibold' },
                      { label: 'Half Days', value: showDetail.halfDays, color: 'text-amber-600 font-semibold' },
                      { label: 'Dashain Bonus', value: showDetail.isDashainBonus ? 'Yes' : 'No', color: '' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="glass-card rounded-lg p-2.5">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className={`text-sm font-semibold mt-0.5 ${color}`}>{value ?? '—'}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs px-1">
                    Status: <span className={`px-2 py-0.5 rounded-full font-medium ${statusColors[showDetail.status] || ''}`}>{statusLabels[showDetail.status] || showDetail.status}</span>
                  </p>
                </div>

                {/* RIGHT — Salary Breakdown */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b pb-1.5 mb-2">
                    <Banknote className="w-3.5 h-3.5" />Salary Breakdown
                  </h4>
                  <div className="bg-secondary/50 rounded-xl p-3 space-y-2.5 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Gross Salary</span>
                      <span className="font-semibold">{npr(showDetail.grossSalary)}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-600">
                      <span>Absent Deduction</span>
                      <span className="font-medium">− {npr(showDetail.absentDeduction)}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-600">
                      <span>SSF (Employee)</span>
                      <span className="font-medium">− {npr(showDetail.ssfEmployee)}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-600">
                      <span>Income Tax (PIT)</span>
                      <span className="font-medium">− {npr(showDetail.pit)}</span>
                    </div>
                    <div className="flex justify-between items-center text-green-700">
                      <span>Overtime</span>
                      <span className="font-medium">+ {npr(showDetail.overtimeAmount)}</span>
                    </div>
                    {showDetail.isDashainBonus && (
                      <div className="flex justify-between items-center text-green-700">
                        <span>Dashain Bonus</span>
                        <span className="font-medium">+ {npr(showDetail.basicSalary)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span>Other Deductions</span>
                      <SmartNumberInput value={detailOtherDed} onChange={e => setDetailOtherDed(parseFloat(e.target.value) || 0)} className="w-32 h-8 text-sm text-right" />
                    </div>
                    <div className="border-t pt-2.5 flex justify-between items-center">
                      <span className="font-bold text-base">Net Salary</span>
                      <span className="font-bold text-xl text-green-700">{npr(liveNet)}</span>
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
