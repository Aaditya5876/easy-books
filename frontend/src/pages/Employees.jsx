import { useState, useEffect } from 'react';
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
import { UserCircle } from 'lucide-react';

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

export default function Employees() {
  const companyId = getActiveCompanyId();
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
          onRowClick={(row) => setEditEmployee({ ...row })}
        />
      )}

      {/* Add Employee Dialog */}
      <Dialog open={showForm} onOpenChange={open => { setShowForm(open); if (!open) setForm(EMPTY_FORM); }}>
        <DialogContent className="glass-card max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-primary" />
              Add Employee
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Full Name *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Employee ID</Label>
                <Input value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Department</Label>
                <Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
              </div>
              <div>
                <Label>Designation</Label>
                <Input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 mt-2">
              Employment Details
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date of Joining</Label>
                <Input type="date" value={form.date_of_joining} onChange={e => setForm({ ...form, date_of_joining: e.target.value })} />
              </div>
              <div>
                <Label>Salary (NPR)</Label>
                <Input type="number" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="resigned">Resigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Any additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancel</Button>
            <Button onClick={save} disabled={!form.name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={!!editEmployee} onOpenChange={open => { if (!open) setEditEmployee(null); }}>
        <DialogContent className="glass-card max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-primary" />
              Edit Employee
            </DialogTitle>
          </DialogHeader>
          {editEmployee && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Full Name *</Label>
                  <Input value={editEmployee.name} onChange={e => setEditEmployee({ ...editEmployee, name: e.target.value })} />
                </div>
                <div>
                  <Label>Employee ID</Label>
                  <Input value={editEmployee.employee_id} onChange={e => setEditEmployee({ ...editEmployee, employee_id: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Department</Label>
                  <Input value={editEmployee.department} onChange={e => setEditEmployee({ ...editEmployee, department: e.target.value })} />
                </div>
                <div>
                  <Label>Designation</Label>
                  <Input value={editEmployee.designation} onChange={e => setEditEmployee({ ...editEmployee, designation: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Phone</Label>
                  <Input value={editEmployee.phone} onChange={e => setEditEmployee({ ...editEmployee, phone: e.target.value })} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={editEmployee.email} onChange={e => setEditEmployee({ ...editEmployee, email: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Input value={editEmployee.address} onChange={e => setEditEmployee({ ...editEmployee, address: e.target.value })} />
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 mt-2">
                Employment Details
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date of Joining</Label>
                  <Input type="date" value={editEmployee.date_of_joining} onChange={e => setEditEmployee({ ...editEmployee, date_of_joining: e.target.value })} />
                </div>
                <div>
                  <Label>Salary (NPR)</Label>
                  <Input type="number" value={editEmployee.salary} onChange={e => setEditEmployee({ ...editEmployee, salary: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editEmployee.status} onValueChange={v => setEditEmployee({ ...editEmployee, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="resigned">Resigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={editEmployee.notes}
                  onChange={e => setEditEmployee({ ...editEmployee, notes: e.target.value })}
                  rows={3}
                  placeholder="Any additional notes..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmployee(null)}>Cancel</Button>
            <Button onClick={updateEmployee} disabled={!editEmployee?.name}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
