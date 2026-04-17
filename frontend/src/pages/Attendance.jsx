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

const statusColors = { present: 'bg-green-100 text-green-700', absent: 'bg-red-100 text-red-700', half_day: 'bg-amber-100 text-amber-700', on_leave: 'bg-blue-100 text-blue-700' };

export default function Attendance() {
  const companyId = getActiveCompanyId();
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [colFilters, setColFilters] = useState({ employee_name: '', date: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [form, setForm] = useState({ employee_id: '', employee_name: '', date: new Date().toISOString().split('T')[0], check_in: '', check_out: '', status: 'present', notes: '' });

  useEffect(() => { if (companyId) load(); }, [companyId]);

  async function load() {
    setLoading(true);
    const [att, emp] = await Promise.all([
      base44.entities.Attendance.filter({ company_id: companyId }, '-date', 100),
      base44.entities.Employee.filter({ company_id: companyId }, 'name', 100),
    ]);
    setRecords(att);
    setEmployees(emp);
    setLoading(false);
  }

  async function save() {
    await base44.entities.Attendance.create({ ...form, company_id: companyId });
    setForm({ employee_id: '', employee_name: '', date: new Date().toISOString().split('T')[0], check_in: '', check_out: '', status: 'present', notes: '' });
    setShowForm(false);
    load();
  }

  function selectEmployee(empId) {
    const emp = employees.find(e => e.id === empId);
    setForm(f => ({ ...f, employee_id: empId, employee_name: emp?.name || '' }));
  }

  const filtered = records.filter(r =>
    (!colFilters.employee_name || r.employee_name?.toLowerCase().includes(colFilters.employee_name.toLowerCase())) &&
    (!colFilters.date || (r.date || '').includes(colFilters.date)) &&
    (!colFilters.status || r.status?.toLowerCase().includes(colFilters.status.toLowerCase()))
  );

  const columns = [
    { key: 'date', label: 'Date', filterValue: colFilters.date, filterType: 'date', onFilterChange: v => setCol('date', v) },
    { key: 'employee_name', label: 'Employee', filterValue: colFilters.employee_name, onFilterChange: v => setCol('employee_name', v), render: r => <span className="font-medium">{r.employee_name}</span> },
    { key: 'check_in', label: 'Check In' },
    { key: 'check_out', label: 'Check Out' },
    { key: 'status', label: 'Status', filterValue: colFilters.status, onFilterChange: v => setCol('status', v), render: r => (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[r.status] || ''}`}>{r.status?.replace('_', ' ')}</span>
    )},
    { key: 'notes', label: 'Notes', render: r => <span className="text-muted-foreground text-xs">{r.notes || '—'}</span> },
  ];

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Attendance" subtitle="Track employee attendance" onAdd={() => setShowForm(true)} addLabel="Mark Attendance" />
      <DataTable columns={columns} data={filtered} emptyMessage="No attendance records yet" />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Mark Attendance</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Employee *</Label>
              <Select value={form.employee_id} onValueChange={selectEmployee}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Check In</Label><Input type="time" value={form.check_in} onChange={e => setForm({ ...form, check_in: e.target.value })} /></div>
              <div><Label>Check Out</Label><Input type="time" value={form.check_out} onChange={e => setForm({ ...form, check_out: e.target.value })} /></div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.employee_id || !form.date}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}