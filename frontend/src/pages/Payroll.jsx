import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, RefreshCw, Download } from 'lucide-react';
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
  const companyId = getActiveCompanyId();
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getMonthOptions()[0]);
  const [showDetail, setShowDetail] = useState(null);
  const [colFilters, setColFilters] = useState({ employee_name: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));

  useEffect(() => { if (companyId) load(); }, [companyId]);

  async function load() {
    setLoading(true);
    const [pr, emp] = await Promise.all([
      base44.entities.Payroll.filter({ company_id: companyId }, '-month', 200),
      base44.entities.Employee.filter({ company_id: companyId }, 'name', 100),
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

    const attendance = await base44.entities.Attendance.filter({ company_id: companyId }, 'date', 500);
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

      await base44.entities.Payroll.create({
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

  async function updateStatus(id, status) {
    await base44.entities.Payroll.update(id, { status });
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
        <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setShowDetail(r); }}>Details</Button>
        <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); exportPDF(r); }}>
          <Download className="w-3 h-3 mr-1" /> PDF
        </Button>
      </div>
    )},
  ];

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

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
          <Button onClick={generatePayroll} disabled={generating} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating...' : 'Generate Payroll'}
          </Button>
        </div>
      </PageHeader>

      {monthPayrolls.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No payroll for {selectedMonth}. Click "Generate Payroll" to calculate.</p>
        </div>
      )}

      {monthPayrolls.length > 0 && (
        <DataTable columns={columns} data={monthPayrolls} emptyMessage="No payroll records" />
      )}

      {/* Detail Dialog */}
      {showDetail && (
        <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Pay Slip — {showDetail.employee_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 bg-secondary/40 rounded-lg p-3">
                <div><span className="text-muted-foreground">Month</span><p className="font-medium">{showDetail.month}</p></div>
                <div><span className="text-muted-foreground">Working Days</span><p className="font-medium">{showDetail.working_days}</p></div>
                <div><span className="text-muted-foreground">Present</span><p className="font-medium text-green-700">{showDetail.days_present}</p></div>
                <div><span className="text-muted-foreground">Absent</span><p className="font-medium text-red-600">{showDetail.days_absent}</p></div>
                <div><span className="text-muted-foreground">Half Days</span><p className="font-medium text-amber-600">{showDetail.days_half}</p></div>
                <div><span className="text-muted-foreground">Late (min)</span><p className="font-medium">{showDetail.late_minutes}</p></div>
              </div>
              <div className="border rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between"><span>Base Salary</span><span className="font-medium">NPR {showDetail.base_salary?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Bonus</span><span className="font-medium text-green-700">+ NPR {(showDetail.bonus || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Absent Deduction</span><span className="font-medium text-red-600">- NPR {showDetail.absent_deduction?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Late Deduction</span><span className="font-medium text-red-600">- NPR {showDetail.late_deduction?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Other Deductions</span><span className="font-medium text-red-600">- NPR {(showDetail.other_deductions || 0).toLocaleString()}</span></div>
                <div className="border-t pt-1.5 flex justify-between font-bold text-base"><span>Net Salary</span><span className="text-green-700">NPR {showDetail.net_salary?.toLocaleString()}</span></div>
              </div>
              <div className="flex gap-2">
                <Select value={showDetail.status} onValueChange={v => { updateStatus(showDetail.id, v); setShowDetail({ ...showDetail, status: v }); }}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetail(null)}>Close</Button>
              <Button onClick={() => exportPDF(showDetail)} className="gap-2"><Download className="w-4 h-4" /> Export PDF</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}