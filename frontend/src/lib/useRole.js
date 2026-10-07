import { useAuth } from './AuthContext';

export function useRole() {
  const { user } = useAuth();
  const role = user?.role || 'STAFF';
  const staffTags = user?.staffTags || [];

  const isAdmin      = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isAccountant = role === 'ACCOUNTANT';
  const isStaff      = role === 'STAFF';
  const isTeacher    = role === 'TEACHER';

  // Only meaningful when isStaff — narrows the shared STAFF role down to
  // specific facility/HR duties (see backend core/modules/staff-tags.ts for
  // the whitelist). ADMIN/ACCOUNTANT are never tag-gated.
  const hasStaffTag = (tag) => isStaff && staffTags.includes(tag);

  return {
    role,
    staffTags,
    hasStaffTag,
    isAdmin,
    isAccountant,
    isStaff,
    isTeacher,
    isSuperAdmin: role === 'SUPER_ADMIN',
    // What each level can do
    canCreate:      isAdmin || isAccountant,  // ADMIN + ACCOUNTANT
    canEdit:        isAdmin || isAccountant,  // ADMIN + ACCOUNTANT
    canDelete:      isAdmin,                  // ADMIN only
    // A handful of delete endpoints (students, school events, ...) have no
    // @Roles() override and inherit the school controller's class-level
    // @Roles('STAFF','ACCOUNTANT','ADMIN') — wider than the generic
    // ADMIN-only `canDelete` above. Use this instead on those specific pages.
    canDeleteRecords: isAdmin || isAccountant || isStaff,
    // Bank accounts / inventory deletes are explicitly @Roles('ACCOUNTANT','ADMIN')
    // on the backend — narrower than canDeleteRecords, wider than canDelete.
    canDeleteFinancialRecords: isAdmin || isAccountant,
    // A few create/update endpoints (school notices, ...) have no @Roles()
    // override and inherit @Roles('STAFF','ACCOUNTANT','ADMIN') — wider than
    // the generic ADMIN+ACCOUNTANT-only `canCreate`/`canEdit` above.
    canCreateRecords: isAdmin || isAccountant || isStaff,
    canEditRecords: isAdmin || isAccountant || isStaff,
    // Classes/Subjects/Routine/Study Materials grant create/update to
    // STAFF/ACCOUNTANT/ADMIN/TEACHER on the backend (TEACHER additionally,
    // since these are also teacher self-service pages) — use this instead of
    // canCreate/canEdit on those four pages only. (deleteClass stays ADMIN-only
    // — keep using canDelete for that one action.)
    canManageAcademicContent: isAdmin || isAccountant || isStaff || isTeacher,
    canManageUsers: isAdmin,                  // ADMIN only
    canProcessPayroll: isAdmin,               // ADMIN only
    canViewPayroll: isAdmin || isAccountant,  // ADMIN + ACCOUNTANT
    // Employees (full record) + Staff Attendance (mark/correct for others) —
    // ADMIN/ACCOUNTANT always, or a STAFF member tagged HR (covers non-login
    // employees like drivers/guards/janitors who only exist as Employee rows).
    // Leave approval deliberately stays ADMIN/ACCOUNTANT-only — HR does not
    // get it, matching the backend's leave.controller.ts.
    canManageEmployees: isAdmin || isAccountant || hasStaffTag('HR'),
    canManageStaffAttendance: isAdmin || isAccountant || hasStaffTag('HR'),
  };
}
