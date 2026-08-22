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
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
