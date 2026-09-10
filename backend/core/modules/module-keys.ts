// Optional shared modules that a company's plan can include or exclude.
// Identity/Admin and Settings are foundational — every company gets them,
// they're never toggled. Business-only and school-only feature sets aren't
// part of this list either — those come with whichever product a company
// is on. This list is only for the modules originally borrowed from Easy
// Books that are also sellable on their own (see the separation plan).
export const MODULE_KEYS = [
  'FINANCE', // legacy aggregate key; new plans use the child keys below
  'FINANCE_FEES',
  'FINANCE_TRANSACTIONS',
  'FINANCE_LEDGER',
  'HRMS', // employees, staff attendance, leave, payroll
  'HRMS_EMPLOYEES',
  'HRMS_ATTENDANCE',
  'HRMS_LEAVE',
  'HRMS_PAYROLL',
  'COMMUNICATION', // notifications, memo, notices/announcements, SMS
  'COMMUNICATION_MEMO',
  'INVENTORY',
  'INVENTORY_STOCK',
  'AI',
  'AI_NOTICES',
  'AI_INSIGHTS',
  'AI_REPORT_CARDS',
  'BULK_IMPORT',
  'BULK_IMPORT_STUDENTS',
  'BULK_IMPORT_EMPLOYEES',
  'BULK_IMPORT_ITEMS',
  // School package tiers (Base/Standard/Premium) — see the Settings package
  // selector. BASE is a no-op sentinel: no endpoint ever requires it, it only
  // exists so a Base-tier company's enabledModules is non-empty (an empty
  // list means "unrestricted/legacy" to ModuleAccessGuard, the opposite of
  // what Base should mean).
  'BASE',
  'SCHOOL_ACADEMICS', // exams, homework, study materials, routine/timetable
  'SCHOOL_ACADEMICS_ROUTINE',
  'SCHOOL_ACADEMICS_EXAMS',
  'SCHOOL_ACADEMICS_STUDY_MATERIALS',
  'SCHOOL_ACADEMICS_HOMEWORK',
  'FACILITIES', // library, hostel, transport
  'FACILITIES_LIBRARY',
  'FACILITIES_HOSTEL',
  'FACILITIES_TRANSPORT',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
