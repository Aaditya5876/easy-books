# Roles & Authorization

## Role Hierarchy

```
SUPER_ADMIN  →  full access, same as ADMIN for current UI
ADMIN        →  full access
ACCOUNTANT   →  create + edit, no delete, no user management
STAFF        →  read-only
```

## Permission Matrix

| Permission | STAFF | ACCOUNTANT | ADMIN | SUPER_ADMIN |
|---|:---:|:---:|:---:|:---:|
| View all pages (except HR/Admin) | ✅ | ✅ | ✅ | ✅ |
| View HR section (Employees, Attendance, Payroll) | ❌ | ✅ | ✅ | ✅ |
| View Admin section (Settings) | ❌ | ❌ | ✅ | ✅ |
| Create records (Add buttons) | ❌ | ✅ | ✅ | ✅ |
| Edit records (Edit buttons, row click) | ❌ | ✅ | ✅ | ✅ |
| Delete records | ❌ | ❌ | ✅ | ✅ |
| Process Payroll | ❌ | ❌ | ✅ | ✅ |
| Manage Users (Invite, Settings) | ❌ | ❌ | ✅ | ✅ |

## Hook — `useRole`

**File:** `frontend/src/lib/useRole.js`

Single source of truth for all frontend permission checks. Import and use in any component:

```js
import { useRole } from "@/lib/useRole";

const { canEdit, canDelete, canCreate, canManageUsers, canProcessPayroll, canViewPayroll } = useRole();
```

### Returned values

| Value | True for |
|---|---|
| `role` | Raw role string: `'STAFF'`, `'ACCOUNTANT'`, `'ADMIN'`, `'SUPER_ADMIN'` |
| `isAdmin` | ADMIN + SUPER_ADMIN |
| `isAccountant` | ACCOUNTANT only |
| `isStaff` | STAFF only |
| `isSuperAdmin` | SUPER_ADMIN only |
| `canCreate` | ADMIN + ACCOUNTANT |
| `canEdit` | ADMIN + ACCOUNTANT |
| `canDelete` | ADMIN only |
| `canManageUsers` | ADMIN only |
| `canProcessPayroll` | ADMIN only |
| `canViewPayroll` | ADMIN + ACCOUNTANT |

## Where Guards Are Applied

### Sidebar (`SidebarNav.jsx`)
HR and Admin nav sections are filtered out entirely based on role — STAFF never sees the links.

```jsx
const visibleSections = navSections.filter(section => {
  if (section.minRole === 'admin') return isAdmin;
  if (section.minRole === 'accountant') return canViewPayroll;
  return true;
});
```

### PageHeader (`components/shared/PageHeader.jsx`)
Handles Add / Delete / Update Price buttons globally across all 15+ pages. STAFF sees a "View only" badge instead of the Add button.

### Per-page guards

| Page | What's guarded | Guard |
|---|---|---|
| **Vendors** | Row click (edit dialog), Save Changes | `canEdit` |
| **Clients** | Row click (edit dialog), Save Changes | `canEdit` |
| **Employees** | Row click (edit dialog), Save Changes | `canEdit` |
| **Inventory** | Adjust Stock button, Update button, Delete button | `canEdit`, `canDelete` |
| **Quotations** | Row click (edit dialog), "To Sale" convert button | `canEdit` |
| **Transactions** | Bank account delete (×) button | `canDelete` |
| **Payroll** | Generate Payroll button, Details button | `canProcessPayroll`, `canEdit` |
| **Settings** | Edit company, Delete company, Invite User | `canEdit`, `canDelete`, `canManageUsers` |

## Backend Guards

All API endpoints use the `@Roles(...)` decorator via `RolesGuard`. The JWT payload carries `{ sub, email, role }` and is verified on every request.

- Read endpoints: `@Roles('STAFF', 'ACCOUNTANT', 'ADMIN')` — all roles
- Write/create endpoints: `@Roles('ACCOUNTANT', 'ADMIN')`
- Delete endpoints: `@Roles('ADMIN')`
- Payroll processing: `@Roles('ADMIN')`
- User management: `@Roles('ADMIN')`

The frontend guards are for UX only — the backend is the true enforcement layer.

## Adding a New Page

1. Import `useRole` at the top of your component.
2. Use `canEdit` / `canDelete` to guard any inline action buttons.
3. Pass `onAdd` / `onDelete` to `PageHeader` — it handles the button visibility automatically.
4. If the page should be hidden from certain roles, add `minRole` to its entry in `navSections` inside `SidebarNav.jsx`.
