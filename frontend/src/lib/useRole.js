import { useAuth } from './AuthContext';

export function useRole() {
  const { user } = useAuth();
  const role = user?.role || 'STAFF';

  const isAdmin      = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isAccountant = role === 'ACCOUNTANT';
  const isStaff      = role === 'STAFF';
  const isTeacher    = role === 'TEACHER';
  const isLibrarian  = role === 'LIBRARIAN';

  return {
    role,
    isAdmin,
    isAccountant,
    isStaff,
    isTeacher,
    isLibrarian,
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
  };
}
