import { useAuth } from './AuthContext';

export function useRole() {
  const { user } = useAuth();
  const role = user?.role || 'STAFF';

  const isAdmin      = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isAccountant = role === 'ACCOUNTANT';
  const isStaff      = role === 'STAFF';

  return {
    role,
    isAdmin,
    isAccountant,
    isStaff,
    isSuperAdmin: role === 'SUPER_ADMIN',
    // What each level can do
    canCreate:      isAdmin || isAccountant,  // ADMIN + ACCOUNTANT
    canEdit:        isAdmin || isAccountant,  // ADMIN + ACCOUNTANT
    canDelete:      isAdmin,                  // ADMIN only
    canManageUsers: isAdmin,                  // ADMIN only
    canProcessPayroll: isAdmin,               // ADMIN only
    canViewPayroll: isAdmin || isAccountant,  // ADMIN + ACCOUNTANT
  };
}
