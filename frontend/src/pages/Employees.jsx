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
import { Badge } from "@/components/ui/badge";
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import {
  UserCircle, User, Phone, Mail, MapPin, Hash,
  Building2, Award, Calendar, Briefcase, Upload, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRole } from "@/lib/useRole";
import BulkImportDialog from '../components/shared/BulkImportDialog';
import { EMPLOYEE_FIELDS } from '../components/shared/bulkImportFields';

// Backend enum (EmployeeStatus in schema.prisma) is uppercase — these keys must
// match exactly or the status badge silently fails to color (and, more importantly,
// sending a lowercase value to the API fails Zod validation entirely, see save()).
const statusColors = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-slate-100 text-slate-600',
  ON_LEAVE: 'bg-amber-100 text-amber-700',
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
  status: 'ACTIVE',
};

/* ── Reusable two-column dialog body ─────────────────────────────────── */
function EmployeeFormBody({ data, onChange, errors = {} }) {
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
          {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
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
          <Label className="text-xs">Employee ID *</Label>
          <div className="relative">
            <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-9 text-sm"
              value={data.employee_id}
              onChange={e => onChange('employee_id', e.target.value)}
            />
          </div>
          {errors.employee_id && <p className="text-xs text-red-600">{errors.employee_id}</p>}
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
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="ON_LEAVE">On Leave</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>
    </div>
  );
}

export default function Employees() {
  const companyId = getActiveCompanyId();
  const { canEdit, canDelete } = useRole();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [colFilters, setColFilters] = useState({ name: '', department: '', designation: '', status: '' });
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [editErrors, setEditErrors] = useState({});

  useEffect(() => { if (companyId) load(); }, [companyId]);

  async function load() {
    setLoading(true);
    const data = await api.Employee.filter({ company_id: companyId }, 'name', 100);
    setEmployees(data);
    setLoading(false);
  }

  // Employee ID is required by the backend (CreateEmployeeSchema) even though
  // nothing in the UI used to say so — validate it here instead of letting the
  // API 400 silently.
  function validateEmployee(data) {
    const errs = {};
    if (!data.name?.trim()) errs.name = 'Full name is required';
    if (!data.employee_id?.trim()) errs.employee_id = 'Employee ID is required';
    return errs;
  }

  async function save() {
    const errs = validateEmployee(form);
    if (Object.keys(errs).length) {
      setFormErrors(errs);
      toast.error('Please fix the highlighted fields');
      return;
    }
    setFormErrors({});
    // salary in the DTO is named `basicSalary` — the UI field is called
    // "Salary" for the user but must be renamed on the way out.
    const { salary, ...rest } = form;
    try {
      await api.Employee.create({ ...rest, company_id: companyId, basic_salary: parseFloat(salary) || 0 });
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast.success('Employee added');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save employee');
    }
  }

  async function updateEmployee() {
    if (!editEmployee) return;
    const errs = validateEmployee(editEmployee);
    if (Object.keys(errs).length) {
      setEditErrors(errs);
      toast.error('Please fix the highlighted fields');
      return;
    }
    setEditErrors({});
    const { salary, ...rest } = editEmployee;
    try {
      await api.Employee.update(editEmployee.id, { ...rest, basic_salary: parseFloat(salary) || 0 });
      setEditEmployee(null);
      toast.success('Employee updated');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update employee');
    }
  }

  async function removeEmployee(emp) {
    if (!window.confirm(`Remove ${emp.name}? They will no longer appear in this list (use this when a staff member or teacher leaves the school).`)) return;
    try {
      await api.Employee.delete(emp.id);
      toast.success('Employee removed');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to remove employee');
    }
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
    { key: 'basic_salary', label: 'Salary', render: r => r.basic_salary ? `NPR ${Number(r.basic_salary).toLocaleString()}` : '—' },
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
    ...(canDelete ? [{
      key: 'actions',
      label: '',
      render: r => (
        <div className="flex justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); removeEmployee(r); }}
            className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
            title="Remove employee"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    }] : []),
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Employees"
        subtitle="Manage employee records"
        onAdd={() => setShowForm(true)}
        addLabel="Add Employee"
      >
        {canEdit && (
          <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4" /> Import
          </Button>
        )}
      </PageHeader>

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="employees"
        title="Import Employees"
        fields={EMPLOYEE_FIELDS}
        onDone={load}
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
          onRowClick={canEdit ? (row) => setEditEmployee({ ...row, salary: row.basic_salary ?? '' }) : undefined}
        />
      )}

      {/* Add Employee Dialog */}
      <Dialog open={showForm} onOpenChange={open => { setShowForm(open); if (!open) setForm(EMPTY_FORM); }}>
        <DialogContent className="glass-dialog max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="h-1 bg-gradient-to-r from-indigo-400 to-blue-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-primary" />Add Employee
            </DialogTitle>
          </DialogHeader>
          <EmployeeFormBody
            data={form}
            onChange={(key, val) => setForm(f => ({ ...f, [key]: val }))}
            errors={formErrors}
          />
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormErrors({}); }}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={!!editEmployee} onOpenChange={open => { if (!open) setEditEmployee(null); }}>
        <DialogContent className="glass-dialog max-w-3xl max-h-[90vh] overflow-y-auto">
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
              errors={editErrors}
            />
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setEditEmployee(null); setEditErrors({}); }}>Cancel</Button>
            {canEdit && <Button onClick={updateEmployee}>Save Changes</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
