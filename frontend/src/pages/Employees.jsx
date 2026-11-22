import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { api } from '@/api/adapter';
import { getActiveCompanyId } from '@/lib/companyContext';
import { formatDate } from '@/lib/utils';
import { confirm } from '@/lib/confirm';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import {
  UserCircle, User, Phone, Mail, MapPin,
  Building2, Award, Calendar, Briefcase, Upload, Trash2, KeyRound, Lock,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { usersApi } from '@/api';
import { apiErrorMessage } from '@/lib/bills';
import { designationOptions } from '@/lib/designations';
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
  department: '',
  designation: '',
  phone: '',
  email: '',
  address: '',
  date_of_joining: '',
  salary: '',
  status: 'ACTIVE',
  employment_type: 'FULL_TIME',
  contracted_hours_per_day: '',
};

const ROLE_LABELS = { ADMIN: 'Admin', ACCOUNTANT: 'Accountant', STAFF: 'Staff', TEACHER: 'Teacher' };
const DUTY_LABELS = { HR: 'HR', SALES: 'Sales / Counter', LIBRARY: 'Library', HOSTEL: 'Hostel', TRANSPORT: 'Transport', FRONT_OFFICE: 'Front Office' };

function accessText(t, login) {
  if (!login) return null;
  const role = t(`employees.role${login.role}`, { defaultValue: ROLE_LABELS[login.role] || login.role });
  const duties = (login.staff_tags || []).map((d) => t(`employees.duty${d}`, { defaultValue: DUTY_LABELS[d] || d }));
  return duties.length ? `${role} · ${duties.join(', ')}` : role;
}

// App access of an employee: their login (role, duties) — or, for an admin, a
// way to give this employee a login without going to Settings → Users. The
// invite links to THIS record (matched by email), never a duplicate.
function AppAccessPanel({ employee, isSchool, canManageUsers, onInvited }) {
  const { t } = useTranslation();
  const [role, setRole] = useState('STAFF');
  const [duties, setDuties] = useState([]);
  const [sending, setSending] = useState(false);
  const login = employee.login;
  const dutyOptions = isSchool ? ['HR', 'LIBRARY', 'HOSTEL', 'TRANSPORT', 'FRONT_OFFICE'] : ['HR', 'SALES'];

  async function invite() {
    if (!employee.email?.trim()) {
      toast.error(t('employees.accessNeedsEmail', { defaultValue: 'Add an email address first — the login details are sent there.' }));
      return;
    }
    setSending(true);
    try {
      const res = await usersApi.invite(getActiveCompanyId(), {
        name: employee.name, email: employee.email.trim(), role, staffTags: role === 'STAFF' ? duties : [],
      });
      if (res.data?.tempPassword && !res.data?.emailSent) {
        toast.warning(t('employees.accessEmailFailed', { defaultValue: 'Login created, but the email failed. Temporary password: {{p}}', p: res.data.tempPassword }), { duration: 60000 });
      } else {
        toast.success(t('employees.accessGranted', { defaultValue: 'App access given — login details emailed to {{email}}', email: employee.email }));
      }
      onInvited();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('employees.accessFailed', { defaultValue: 'Could not give app access' })));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border p-3 space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <KeyRound className="w-3.5 h-3.5" />{t('employees.appAccess', { defaultValue: 'App access' })}
      </h4>
      {login ? (
        <>
          <p className="text-sm">
            <span className="font-medium">{accessText(t, login)}</span>
            {login.is_active === false && <span className="ml-2 text-xs text-red-600">{t('employees.suspended', { defaultValue: 'Suspended' })}</span>}
          </p>
          <p className="text-xs text-muted-foreground">{t('employees.accessManageHint', { defaultValue: 'Role and duties are changed in Settings → Users. Designation above is only the job title.' })}</p>
        </>
      ) : canManageUsers ? (
        <>
          <p className="text-xs text-muted-foreground">{t('employees.noLoginHint', { defaultValue: "This employee doesn't use the app. Give them a login if they need to (e.g. cashier, accountant)." })}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STAFF">{t('employees.roleSTAFF', { defaultValue: 'Staff' })}</SelectItem>
                <SelectItem value="ACCOUNTANT">{t('employees.roleACCOUNTANT', { defaultValue: 'Accountant' })}</SelectItem>
                {isSchool && <SelectItem value="TEACHER">{t('employees.roleTEACHER', { defaultValue: 'Teacher' })}</SelectItem>}
              </SelectContent>
            </Select>
            {role === 'STAFF' && dutyOptions.map((d) => (
              <button key={d} type="button" onClick={() => setDuties((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}
                className={`rounded-full border px-2 py-0.5 text-[11px] ${duties.includes(d) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                {t(`employees.duty${d}`, { defaultValue: DUTY_LABELS[d] })}
              </button>
            ))}
            <Button type="button" size="sm" className="h-8 ml-auto" disabled={sending} onClick={invite}>
              {sending ? t('employees.sending', { defaultValue: 'Sending…' }) : t('employees.giveAccess', { defaultValue: 'Give app access' })}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{t('employees.noLogin', { defaultValue: 'No login' })}</p>
      )}
    </div>
  );
}

/* ── Reusable two-column dialog body ─────────────────────────────────── */
function EmployeeFormBody({ data, onChange, errors = {}, designations = [], emailLocked = false, footer = null }) {
  const { t } = useTranslation();
  // Designation: pick a job title, or "Other…" to type one.
  const [customTitle, setCustomTitle] = useState(() => !!data.designation && !designations.includes(data.designation));
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
          <UserCircle className="w-3.5 h-3.5" />{t('employees.personalInfo', { defaultValue: 'Personal Info' })}
        </h4>

        {/* Full Name */}
        <div className="space-y-1">
          <Label className="text-xs">{t('employees.fullName', { defaultValue: 'Full Name' })} *</Label>
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
          <Label className="text-xs">{t('employees.phone', { defaultValue: 'Phone' })}</Label>
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
          <Label className="text-xs">{t('employees.email', { defaultValue: 'Email' })}</Label>
          <div className="relative">
            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="email"
              className="pl-8 h-9 text-sm"
              value={data.email || ''}
              disabled={emailLocked}
              onChange={e => onChange('email', e.target.value)}
            />
            {emailLocked && <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />}
          </div>
          {emailLocked && <p className="text-[11px] text-muted-foreground">{t('employees.emailLockedHint', { defaultValue: 'Linked to their app login — change it in Settings → Users.' })}</p>}
        </div>

        {/* Address */}
        <div className="space-y-1">
          <Label className="text-xs">{t('employees.address', { defaultValue: 'Address' })}</Label>
          <div className="relative">
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-9 text-sm"
              value={data.address}
              onChange={e => onChange('address', e.target.value)}
            />
          </div>
        </div>

        {footer}
      </motion.div>

      {/* RIGHT column — Employment Details */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut', delay: 0.06 }}
        className="space-y-3"
      >
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b pb-1.5 mb-2">
          <Briefcase className="w-3.5 h-3.5" />{t('employees.employmentDetails', { defaultValue: 'Employment Details' })}
        </h4>

        {/* Department */}
        <div className="space-y-1">
          <Label className="text-xs">{t('employees.department', { defaultValue: 'Department' })}</Label>
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
          <Label className="text-xs">{t('employees.designation', { defaultValue: 'Designation' })}</Label>
          {customTitle ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Award className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input className="pl-8 h-9 text-sm" autoFocus value={data.designation || ''} placeholder={t('employees.designationCustomPlaceholder', { defaultValue: 'Type a job title' })}
                  onChange={e => onChange('designation', e.target.value)} />
              </div>
              <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setCustomTitle(false)}>↩</Button>
            </div>
          ) : (
            <Select value={data.designation || '__none'} onValueChange={(v) => {
              if (v === '__other') { setCustomTitle(true); onChange('designation', ''); }
              else onChange('designation', v === '__none' ? '' : v);
            }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t('employees.chooseDesignation', { defaultValue: 'Choose a job title' })} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{t('employees.noDesignation', { defaultValue: '— Not set —' })}</SelectItem>
                {designations.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                <SelectItem value="__other">{t('employees.otherDesignation', { defaultValue: 'Other…' })}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Date of Joining */}
        <div className="space-y-1">
          <Label className="text-xs">{t('employees.dateOfJoining', { defaultValue: 'Date of Joining' })}</Label>
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
          <Label className="text-xs">{t('employees.salary', { defaultValue: 'Salary' })}</Label>
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
          <Label className="text-xs">{t('employees.status', { defaultValue: 'Status' })}</Label>
          <Select value={data.status} onValueChange={v => onChange('status', v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">{t('employees.active', { defaultValue: 'Active' })}</SelectItem>
              <SelectItem value="INACTIVE">{t('employees.inactive', { defaultValue: 'Inactive' })}</SelectItem>
              <SelectItem value="ON_LEAVE">{t('employees.onLeave', { defaultValue: 'On Leave' })}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Employment Type */}
        <div className="space-y-1">
          <Label className="text-xs">{t('employees.employmentType', { defaultValue: 'Employment Type' })}</Label>
          <Select value={data.employment_type || 'FULL_TIME'} onValueChange={v => onChange('employment_type', v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FULL_TIME">{t('employees.fullTime', { defaultValue: 'Full-time' })}</SelectItem>
              <SelectItem value="PART_TIME">{t('employees.partTime', { defaultValue: 'Part-time' })}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Contracted Hours/Day — part-time only */}
        {data.employment_type === 'PART_TIME' && (
          <div className="space-y-1">
            <Label className="text-xs">{t('employees.contractedHoursPerDay', { defaultValue: 'Contracted Hours / Day' })} *</Label>
            <Input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              className="h-9 text-sm"
              value={data.contracted_hours_per_day}
              onChange={e => onChange('contracted_hours_per_day', e.target.value)}
              placeholder={t('employees.contractedHoursPlaceholder', { defaultValue: 'e.g. 4' })}
            />
            {errors.contracted_hours_per_day && <p className="text-xs text-red-600">{errors.contracted_hours_per_day}</p>}
            <p className="text-xs text-muted-foreground">{t('employees.contractedHoursHint', { defaultValue: 'Used to prorate salary if attendance-based deduction is enabled (Settings → Preferences).' })}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function Employees() {
  const { t } = useTranslation();
  const companyId = getActiveCompanyId();
  const { canEdit, canDelete, canManageUsers } = useRole();
  const { user } = useAuth();
  const businessType = user?.defaultCompany?.businessType;
  const isSchool = businessType === 'SCHOOL';
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

  // Job titles for the dropdown: the company type's presets + titles in use.
  const designations = designationOptions(businessType, employees.map((e) => e.designation));

  function validateEmployee(data) {
    const errs = {};
    if (!data.name?.trim()) errs.name = t('employees.fullNameRequired', { defaultValue: 'Full name is required' });
    if (data.employment_type === 'PART_TIME' && !(parseFloat(data.contracted_hours_per_day) > 0)) {
      errs.contracted_hours_per_day = t('employees.contractedHoursRequired', { defaultValue: 'Contracted hours/day is required for part-time employees' });
    }
    return errs;
  }

  async function save() {
    const errs = validateEmployee(form);
    if (Object.keys(errs).length) {
      setFormErrors(errs);
      toast.error(t('employees.fixHighlightedFields', { defaultValue: 'Please fix the highlighted fields' }));
      return;
    }
    setFormErrors({});
    // salary in the DTO is named `basicSalary` — the UI field is called
    // "Salary" for the user but must be renamed on the way out.
    const { salary, contracted_hours_per_day, ...rest } = form;
    try {
      await api.Employee.create({
        ...rest,
        company_id: companyId,
        basic_salary: parseFloat(salary) || 0,
        ...(rest.employment_type === 'PART_TIME' ? { contracted_hours_per_day: parseFloat(contracted_hours_per_day) } : {}),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast.success(t('employees.employeeAdded', { defaultValue: 'Employee added' }));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('employees.failedToSaveEmployee', { defaultValue: 'Failed to save employee' }));
    }
  }

  async function updateEmployee() {
    if (!editEmployee) return;
    const errs = validateEmployee(editEmployee);
    if (Object.keys(errs).length) {
      setEditErrors(errs);
      toast.error(t('employees.fixHighlightedFields', { defaultValue: 'Please fix the highlighted fields' }));
      return;
    }
    setEditErrors({});
    const { salary, contracted_hours_per_day, login: _login, employee_id: _id, ...rest } = editEmployee;
    try {
      await api.Employee.update(editEmployee.id, {
        ...rest,
        basic_salary: parseFloat(salary) || 0,
        ...(rest.employment_type === 'PART_TIME' ? { contracted_hours_per_day: parseFloat(contracted_hours_per_day) } : {}),
      }, { company_id: companyId });
      setEditEmployee(null);
      toast.success(t('employees.employeeUpdated', { defaultValue: 'Employee updated' }));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('employees.failedToUpdateEmployee', { defaultValue: 'Failed to update employee' }));
    }
  }

  async function removeEmployee(emp) {
    const ok = await confirm({
      title: t('employees.removeEmployeeTitle', { defaultValue: 'Remove employee?' }),
      description: t('employees.removeEmployeeDescription', {
        defaultValue: 'Remove {{name}}? They will no longer appear in this list (use this when a staff member or teacher leaves the school).',
        name: emp.name,
      }),
      confirmLabel: t('employees.remove', { defaultValue: 'Remove' }),
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.Employee.delete(emp.id);
      toast.success(t('employees.employeeRemoved', { defaultValue: 'Employee removed' }));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('employees.failedToRemoveEmployee', { defaultValue: 'Failed to remove employee' }));
    }
  }

  const filtered = employees.filter(e =>
    (!colFilters.name || e.name?.toLowerCase().includes(colFilters.name.toLowerCase())) &&
    (!colFilters.department || e.department?.toLowerCase().includes(colFilters.department.toLowerCase())) &&
    (!colFilters.designation || e.designation?.toLowerCase().includes(colFilters.designation.toLowerCase())) &&
    (!colFilters.status || e.status?.toLowerCase().includes(colFilters.status.toLowerCase()))
  );

  const statusLabels = {
    ACTIVE: t('employees.active', { defaultValue: 'Active' }),
    INACTIVE: t('employees.inactive', { defaultValue: 'Inactive' }),
    ON_LEAVE: t('employees.onLeave', { defaultValue: 'On Leave' }),
  };

  const columns = [
    {
      key: 'name',
      label: t('employees.name', { defaultValue: 'Name' }),
      filterValue: colFilters.name,
      onFilterChange: v => setCol('name', v),
      render: r => <span className="font-medium">{r.name}</span>,
    },
    { key: 'department', label: t('employees.department', { defaultValue: 'Department' }), filterValue: colFilters.department, onFilterChange: v => setCol('department', v) },
    { key: 'designation', label: t('employees.designation', { defaultValue: 'Designation' }), filterValue: colFilters.designation, onFilterChange: v => setCol('designation', v) },
    {
      key: 'login',
      label: t('employees.appAccess', { defaultValue: 'App access' }),
      render: r => r.login ? (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.login.is_active === false ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'}`}>
          {accessText(t, r.login)}{r.login.is_active === false ? ` · ${t('employees.suspended', { defaultValue: 'Suspended' })}` : ''}
        </span>
      ) : <span className="text-xs text-muted-foreground">{t('employees.noLogin', { defaultValue: 'No login' })}</span>,
    },
    { key: 'phone', label: t('employees.phone', { defaultValue: 'Phone' }) },
    { key: 'date_of_joining', label: t('employees.joined', { defaultValue: 'Joined' }), render: r => formatDate(r.date_of_joining) },
    { key: 'basic_salary', label: t('employees.salary', { defaultValue: 'Salary' }), render: r => r.basic_salary ? `NPR ${Number(r.basic_salary).toLocaleString()}` : '—' },
    {
      key: 'employment_type',
      label: t('employees.employmentType', { defaultValue: 'Employment Type' }),
      render: r => (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
          {r.employment_type === 'PART_TIME' ? t('employees.partTime', { defaultValue: 'Part-time' }) : t('employees.fullTime', { defaultValue: 'Full-time' })}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('employees.status', { defaultValue: 'Status' }),
      filterValue: colFilters.status,
      onFilterChange: v => setCol('status', v),
      render: r => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[r.status] || ''}`}>
          {statusLabels[r.status] || r.status?.replace('_', ' ')}
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
            title={t('employees.removeEmployeeTooltip', { defaultValue: 'Remove employee' })}
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
        title={t('employees.title', { defaultValue: 'Employees' })}
        subtitle={t('employees.subtitle', { defaultValue: 'Manage employee records' })}
        onAdd={() => setShowForm(true)}
        addLabel={t('employees.addEmployee', { defaultValue: 'Add Employee' })}
      >
        {canEdit && (
          <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4" /> {t('employees.import', { defaultValue: 'Import' })}
          </Button>
        )}
      </PageHeader>

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="employees"
        title={t('employees.importEmployees', { defaultValue: 'Import Employees' })}
        fields={EMPLOYEE_FIELDS}
        onDone={load}
      />

      {employees.length === 0 ? (
        <EmptyState
          icon={UserCircle}
          title={t('employees.noEmployeesYet', { defaultValue: 'No employees yet' })}
          description={t('employees.noEmployeesYetHint', { defaultValue: 'Add your first employee to start tracking attendance and payroll.' })}
          action={<Button onClick={() => setShowForm(true)}>{t('employees.addEmployee', { defaultValue: 'Add Employee' })}</Button>}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage={t('employees.noEmployeesMatch', { defaultValue: 'No employees match your search.' })}
          onRowClick={canEdit ? (row) => setEditEmployee({ ...row, salary: row.basic_salary ?? '' }) : undefined}
        />
      )}

      {/* Add Employee Dialog */}
      <Dialog open={showForm} onOpenChange={open => { setShowForm(open); if (!open) setForm(EMPTY_FORM); }}>
        <DialogContent className="glass-dialog max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="h-1 bg-gradient-to-r from-indigo-400 to-blue-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-primary" />{t('employees.addEmployee', { defaultValue: 'Add Employee' })}
            </DialogTitle>
          </DialogHeader>
          <EmployeeFormBody
            data={form}
            onChange={(key, val) => setForm(f => ({ ...f, [key]: val }))}
            errors={formErrors}
            designations={designations}
          />
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormErrors({}); }}>{t('employees.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={save}>{t('employees.save', { defaultValue: 'Save' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={!!editEmployee} onOpenChange={open => { if (!open) setEditEmployee(null); }}>
        <DialogContent className="glass-dialog max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="h-1 bg-gradient-to-r from-indigo-400 to-blue-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-primary" />{t('employees.editEmployee', { defaultValue: 'Edit Employee' })}
            </DialogTitle>
          </DialogHeader>
          {editEmployee && (
            <EmployeeFormBody
              key={editEmployee.id}
              data={editEmployee}
              onChange={(key, val) => setEditEmployee(e => ({ ...e, [key]: val }))}
              errors={editErrors}
              designations={designations}
              emailLocked={!!editEmployee.login}
              footer={(
                <AppAccessPanel
                  employee={editEmployee}
                  isSchool={isSchool}
                  canManageUsers={canManageUsers}
                  onInvited={async () => {
                    const fresh = await api.Employee.filter({ company_id: companyId });
                    setEmployees(fresh);
                    const me = fresh.find((x) => x.id === editEmployee.id);
                    if (me) setEditEmployee((e) => ({ ...e, login: me.login }));
                  }}
                />
              )}
            />
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setEditEmployee(null); setEditErrors({}); }}>{t('employees.cancel', { defaultValue: 'Cancel' })}</Button>
            {canEdit && <Button onClick={updateEmployee}>{t('employees.saveChanges', { defaultValue: 'Save Changes' })}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
