// Optional shared modules that a company's plan can include or exclude.
// Identity/Admin and Settings are foundational — every company gets them,
// they're never toggled. Business-only and school-only feature sets aren't
// part of this list either — those come with whichever product a company
// is on. This list is only for the modules originally borrowed from Easy
// Books that are also sellable on their own (see the separation plan).
export const MODULE_KEYS = [
  'FINANCE', // ledger, transactions, accounting
  'HRMS', // employees, staff attendance, leave, payroll
  'COMMUNICATION', // notifications, memo, notices/announcements, SMS
  'INVENTORY',
  'AI',
  'BULK_IMPORT',
  // School package tiers (Base/Standard/Premium) — see the Settings package
  // selector. BASE is a no-op sentinel: no endpoint ever requires it, it only
  // exists so a Base-tier company's enabledModules is non-empty (an empty
  // list means "unrestricted/legacy" to ModuleAccessGuard, the opposite of
  // what Base should mean).
  'BASE',
  'SCHOOL_ACADEMICS', // exams, homework, study materials, routine/timetable
  'FACILITIES', // library, hostel, transport
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
