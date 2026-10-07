import { SetMetadata } from '@nestjs/common';
import { StaffTag } from '../../../core/modules/staff-tags';

// Narrows a route already open to STAFF (via class or method @Roles()) down
// to STAFF members carrying this specific tag — e.g. the library endpoints
// stay @Roles('STAFF','ACCOUNTANT','ADMIN') but only a STAFF user tagged
// LIBRARY gets through. ADMIN/ACCOUNTANT (and SUPER_ADMIN) are unaffected —
// see RolesGuard, which only applies this check when the caller's role is
// literally 'STAFF'.
export const STAFF_TAG_KEY = 'requiresStaffTag';
export const RequiresStaffTag = (tag: StaffTag) => SetMetadata(STAFF_TAG_KEY, tag);
