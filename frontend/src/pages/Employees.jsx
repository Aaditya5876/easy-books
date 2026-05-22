import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/api/adapter';
import { getActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import {
  UserCircle, User, Phone, Mail, MapPin, Hash,
  Building2, Award, Calendar, Briefcase, FileText,
} from 'lucide-react';
import { useRole } from "@/lib/useRole";

const statusColors = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-slate-100 text-slate-600',
  on_leave: 'bg-amber-100 text-amber-700',
  resigned: 'bg-red-100 text-red-700',
};

const EMPTY_FORM = {
  name: '',
  employee_id: '',
  department: '',
  designation: '',
  phone: '',
  email: '',
  address: '',
  date_of_joining: '',
  salary: '',
  status: 'active',
  notes: '',
};

/* ── Reusable two-column dialog body ─────────────────────────────────── */
function EmployeeFormBody({ data, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-0 mt-1">
      {/* LEFT column — Personal Info */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="space-y-3"
      >
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b pb-1.5 mb-2">
          <UserCircle className="w-3.5 h-3.5" />Personal Info
        </h4>

        {/* Full Name */}
        <div className="space-y-1">
          <Label className="text-xs">Full Name *</Label>
          <div className="relative">
            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-9 text-sm"
              value={data.name}
              onChange={e => onChange('name', e.target.value)}
            />
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <Label className="text-xs">Phone</Label>
          <div className="relative">
            <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-9 text-sm"
              value={data.phone}
              onChange={e => onChange('phone', e.target.value)}
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1">
          <Label className="text-xs">Email</Label>
          <div className="relative">
            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="email"
              className="pl-8 h-9 text-sm"
              value={data.email}
              onChange={e => onChange('email', e.target.value)}
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-1">
          <Label className="text-xs">Address</Label>
          <div className="relative">
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-9 text-sm"
              value={data.address}
              onChange={e => onChange('address', e.target.value)}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <Label className="text-xs">Notes</Label>
          <div className="relative">
            <FileText className="absolute left-2.5 top-3 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Textarea
              className="pl-8 text-sm resize-none"
              rows={3}
              placeholder="Any additional notes..."
              value={data.notes}
              onChange={e => onChange('notes', e.target.value)}
            />
          </div>
        </div>
      </motion.div>

      {/* RIGHT column — Employment Details */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut', delay: 0.06 }}
        className="space-y-3"
      >
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b pb-1.5 mb-2">
          <Briefcase className="w-3.5 h-3.5" />Employment Details
        </h4>

        {/* Employee ID */}
        <div className="space-y-1">
          <Label className="text-xs">Employee ID</Label>
          <div className="relative">
            <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-9 text-sm"
              value={data.employee_id}
              onChange={e => onChange('employee_id', e.target.value)}
            />
          </div>
        </div>

        {/* Department */}
        <div className="space-y-1">
          <Label className="text-xs">Department</Label>
          <div className="relative">
            <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-9 text-sm"
              value={data.department}
              onChange={e => onChange('department', e.target.value)}
            />
          </div>
        </div>

        {/* Designation */}
        <div className="space-y-1">
          <Label className="text-xs">Designation</Label>
          <div className="relative">
            <Award className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-9 text-sm"
              value={data.designation}
              onChange={e => onChange('designation', e.target.value)}
            />
          </div>
        </div>

        {/* Date of Joining */}
        <div className="space-y-1">
          <Label className="text-xs">Date of Joining</Label>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              className="pl-8 h-9 text-sm"
              value={data.date_of_joining}
              onChange={e => onChange('date_of_joining', e.target.value)}
            />
          </div>
        </div>

        {/* Salary */}
        <div className="space-y-1">
          <Label className="text-xs">Salary</Label>
          <div className="flex items-stretch">
            <span className="flex items-center px-2.5 text-xs font-bold text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md select-none shrink-0">
              NPR
            </span>
            <Input
              type="number"
              className="rounded-l-none h-9 text-sm flex-1"
              value={data.salary}
              onChange={e => onChange('salary', e.target.value)}
            />
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={data.status} onValueChange={v => onChange('status', v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
              <SelectItem value="resigned">Resigned</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>
    </div>
  );
}

export default function Employees() {
  const companyId = getActiveCompanyId();
  const { canEdit } = useRole();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [colFilters, setColFilters] = useState({ name: '', department: '', designation: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { if (companyId) load(); }, [companyId]);

  async function load() {
    setLoading(true);
    const data = await api.Employee.filter({ company_id: companyId }, 'name', 100);
    setEmployees(data);
    setLoading(false);
  }

  async function save() {
    await api.Employee.create({ ...form, company_id: companyId, salary: parseFloat(form.salary) || 0 });
    setForm(EMPTY_FORM);
    setShowForm(false);
    load();
  }

  async function updateEmployee() {
    if (!editEmployee) return;
    await api.Employee.update(editEmployee.id, { ...editEmployee, salary: parseFloat(editEmployee.salary) || 0 });
    setEditEmployee(null);
    load();
  }

  const filtered = employees.filter(e =>
    (!colFilters.name || e.name?.toLowerCase().includes(colFilters.name.toLowerCase())) &&
    (!colFilters.department || e.department?.toLowerCase().includes(colFilters.department.toLowerCase())) &&
    (!colFilters.designation || e.designation?.toLowerCase().includes(colFilters.designation.toLowerCase())) &&
    (!colFilters.status || e.status?.toLowerCase().includes(colFilters.status.toLowerCase()))
  );

  const columns = [
    { key: 'employee_id', label: 'ID' },
    {
      key: 'name',
      label: 'Name',
      filterValue: colFilters.name,
      onFilterChange: v => setCol('name', v),
      render: r => <span className="font-medium">{r.name}</span>,
    },
    { key: 'department', label: 'Department', filterValue: colFilters.department, onFilterChange: v => setCol('department', v) },
    { key: 'designation', label: 'Designation', filterValue: colFilters.designation, onFilterChange: v => setCol('designation', v) },
    { key: 'phone', label: 'Phone' },
    { key: 'date_of_joining', label: 'Joined' },
    { key: 'salary', label: 'Salary', render: r => r.salary ? `NPR ${r.salary.toLocaleString()}` : '—' },
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
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Employees"
        subtitle="Manage employee records"
        onAdd={() => setShowForm(true)}
        addLabel="Add Employee"
      />

      {employees.length === 0 ? (
        <EmptyState
          icon={UserCircle}
          title="No employees yet"
          description="Add your first employee to start tracking attendance and payroll."
          action={<Button onClick={() => setShowForm(true)}>Add Employee</Button>}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage="No employees match your search."
          onRowClick={canEdit ? (row) => setEditEmployee({ ...row }) : undefined}
        />
      )}

      {/* Add Employee Dialog */}
      <Dialog open={showForm} onOpenChange={open => { setShowForm(open); if (!open) setForm(EMPTY_FORM); }}>
        <DialogContent className="glass-dialog max-w-3xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-indigo-400 to-blue-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-primary" />Add Employee
            </DialogTitle>
          </DialogHeader>
          <EmployeeFormBody
            data={form}
            onChange={(key, val) => setForm(f => ({ ...f, [key]: val }))}
          />
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancel</Button>
            <Button onClick={save} disabled={!form.name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={!!editEmployee} onOpenChange={open => { if (!open) setEditEmployee(null); }}>
        <DialogContent className="glass-dialog max-w-3xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-indigo-400 to-blue-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-primary" />Edit Employee
            </DialogTitle>
          </DialogHeader>
          {editEmployee && (
            <EmployeeFormBody
              data={editEmployee}
              onChange={(key, val) => setEditEmployee(e => ({ ...e, [key]: val }))}
            />
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditEmployee(null)}>Cancel</Button>
            {canEdit && <Button onClick={updateEmployee} disabled={!editEmployee?.name}>Save Changes</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
