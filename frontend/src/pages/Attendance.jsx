import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/api/adapter';
import { getActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageLoader from '../components/PageLoader';
import { CalendarDays, Calendar, Clock, Users, MessageSquare } from 'lucide-react';

const statusColors = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  half_day: 'bg-amber-100 text-amber-700',
  on_leave: 'bg-blue-100 text-blue-700',
};

export default function Attendance() {
  const companyId = getActiveCompanyId();
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [colFilters, setColFilters] = useState({ employee_name: '', date: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [form, setForm] = useState({
    employee_id: '',
    employee_name: '',
    date: new Date().toISOString().split('T')[0],
    check_in: '',
    check_out: '',
    status: 'present',
    notes: '',
  });

  useEffect(() => { if (companyId) load(); }, [companyId]);

  async function load() {
    setLoading(true);
    const [att, emp] = await Promise.all([
      api.Attendance.filter({ company_id: companyId }, '-date', 100),
      api.Employee.filter({ company_id: companyId }, 'name', 100),
    ]);
    setRecords(att);
    setEmployees(emp);
    setLoading(false);
  }

  async function save() {
    await api.Attendance.create({ ...form, company_id: companyId });
    setForm({
      employee_id: '',
      employee_name: '',
      date: new Date().toISOString().split('T')[0],
      check_in: '',
      check_out: '',
      status: 'present',
      notes: '',
    });
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
    {
      key: 'employee_name',
      label: 'Employee',
      filterValue: colFilters.employee_name,
      onFilterChange: v => setCol('employee_name', v),
      render: r => <span className="font-medium">{r.employee_name}</span>,
    },
    { key: 'check_in', label: 'Check In' },
    { key: 'check_out', label: 'Check Out' },
    {
      key: 'status',
      label: 'Status',
      filterValue: colFilters.status,
      onFilterChange: v => setCol('status', v),
      render: r => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[r.status] || ''}`}>
          {r.status?.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      render: r => <span className="text-muted-foreground text-xs">{r.notes || '—'}</span>,
    },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Attendance"
        subtitle="Track employee attendance"
        onAdd={() => setShowForm(true)}
        addLabel="Mark Attendance"
      />
      <DataTable columns={columns} data={filtered} emptyMessage="No attendance records yet" />

      <Dialog open={showForm} onOpenChange={open => { setShowForm(open); }}>
        <DialogContent className="glass-dialog max-w-xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />Mark Attendance
            </DialogTitle>
          </DialogHeader>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="space-y-3 mt-1"
          >
            {/* Employee section */}
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b pb-1.5 mb-2">
              <Users className="w-3.5 h-3.5" />Select Employee
            </h4>

            <div className="space-y-1">
              <Label className="text-xs">Employee *</Label>
              <Select value={form.employee_id} onValueChange={selectEmployee}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Date *</Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  className="pl-8 h-9 text-sm"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>
            </div>

            {/* Time & Status section */}
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b pb-1.5 mb-2 pt-1">
              <Clock className="w-3.5 h-3.5" />Time &amp; Status
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Check In</Label>
                <div className="relative">
                  <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="time"
                    className="pl-8 h-9 text-sm"
                    value={form.check_in}
                    onChange={e => setForm({ ...form, check_in: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Check Out</Label>
                <div className="relative">
                  <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="time"
                    className="pl-8 h-9 text-sm"
                    value={form.check_out}
                    onChange={e => setForm({ ...form, check_out: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <div className="relative">
                <MessageSquare className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-8 h-9 text-sm"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
          </motion.div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.employee_id || !form.date}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
