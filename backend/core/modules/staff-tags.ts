// Assignable duties within the shared STAFF role — narrows a STAFF login down
// to specific facility/HR modules instead of granting all of them by default.
// Only meaningful when User.role === 'STAFF'; ADMIN/ACCOUNTANT/TEACHER are
// never tag-gated. See RolesGuard + @RequiresStaffTag() for enforcement.
export const STAFF_TAGS = ['LIBRARY', 'HOSTEL', 'TRANSPORT', 'HR', 'FRONT_OFFICE'] as const;

export type StaffTag = (typeof STAFF_TAGS)[number];
