// Content for the first-login tour (OnboardingTour) and the Help & Guide page.
// Every string is rendered through t(`guide.<key>`, { defaultValue }) so Nepali
// can be added to ne.json under "guide.*" without touching this file.
//
// Tour steps point at real UI via `target` (a data-tour attribute value):
// sidebar links use their route path ("/students"), other spots use names
// like "company-switcher". A step whose target isn't on screen — module not
// in the package, or the role can't see it — is dropped automatically, so the
// tour always matches what this user can actually click.

export const TOUR_VERSION = 1;

// ── Tours ────────────────────────────────────────────────────────────────

const welcome = (mode) => ({
  id: 'welcome',
  emoji: '👋',
  title: 'Welcome to OneBook!',
  body: mode === 'platform'
    ? 'You are the platform owner. This quick tour shows how to set up a client and step into their account. It takes about a minute.'
    : 'This quick tour shows where everything lives and what to do first. It takes about a minute, and you can skip it anytime.',
});

const finish = {
  id: 'finish',
  emoji: '🎉',
  title: "You're all set!",
  body: 'Whenever you are unsure, open Help & Guide. It explains every page step by step, and you can replay this tour from there.',
  finish: true,
};

const helpStep = {
  id: 'help',
  target: 'help',
  title: 'Help is always here',
  body: 'Click this button anytime to open the full guide: every page explained, step by step, with a search box.',
};

const TOURS = {
  platform: [
    welcome('platform'),
    { id: 'clients', target: 'clients-panel', title: 'Your clients', body: 'Every school or business you set up appears here, with its admin, package and subscription expiry.' },
    { id: 'create', target: 'create-client', title: 'Step 1: Create a client', body: 'Enter the school or business name, choose the product, and add their admin\'s name and email. They get a login by email.' },
    { id: 'switch', target: 'company-switcher', title: 'Step 2: Step into a client', body: 'Pick a client here (or click "Switch To" on their row) to open their full menu, exactly as their admin sees it.' },
    { id: 'package', target: 'clients-panel', title: 'Step 3: Choose their package', body: 'Base, Standard or Premium decides which modules appear in their menu. Set it before you switch in, so you see everything they paid for.' },
    helpStep,
    finish,
  ],

  school: [
    welcome('school'),
    { id: 'switcher', target: 'company-switcher', title: 'Your school', body: 'The name of the school you are working in. The green dot means the subscription is active.' },
    { id: 'dashboard', target: '/', title: 'Dashboard', body: 'A live summary: students, fee collection, today\'s attendance and what is coming up this week. It fills in as you add data.' },
    { id: 'employees', target: '/employees', title: 'Start here: add your staff', body: 'Add teachers and staff first. Click "Add Employee", or "Import" to upload many at once from Excel.', roles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'STAFF'] },
    { id: 'classes', target: '/classes', title: 'Create your classes', body: 'Click "Add Class" to create each class and section (for example Class 5, section A), and assign a class teacher.', roles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'STAFF'] },
    { id: 'classes-teacher', target: '/classes', title: 'Your classes', body: 'See the classes and sections you teach, with their students.', roles: ['TEACHER'] },
    { id: 'subjects', target: '/subjects', title: 'Add subjects', body: 'Add the subjects taught in each class. Exams, routine and homework all use these.', roles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'STAFF'] },
    { id: 'students', target: '/students', title: 'Enroll students', body: 'Click "Enroll Student" for one student, or "Import Students" to upload a whole list from Excel. Missing classes are created for you.', roles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'STAFF'] },
    { id: 'students-teacher', target: '/students', title: 'Your students', body: 'Look up any student\'s details, guardian contact and class.', roles: ['TEACHER'] },
    { id: 'attendance', target: '/student-attendance', title: 'Daily attendance', body: 'Pick a class and date, tap "All Present", then mark the few who are absent. Parents of absent students can get an SMS.' },
    { id: 'homework', target: '/homework', title: 'Homework', body: 'Click "Assign Homework" to give work to a class. Students and parents see it in their portal.', roles: ['TEACHER'] },
    { id: 'exams', target: '/exams', title: 'Exams and report cards', body: 'Create exams, enter marks ("Bulk Enter Marks" for a whole class), and print report cards.' },
    { id: 'fees', target: '/fees', title: 'Fees', body: 'Set up Fee Heads (tuition, bus, hostel…), then "Run Billing" each month to create every invoice at once. Use "Record Payment" when a parent pays.', roles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'STAFF'] },
    { id: 'ledger', target: '/ledger', title: 'Accounts', body: 'Every fee payment is posted to the ledger automatically. Check balances here and in Transactions.', roles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'] },
    { id: 'notices', target: '/notices', title: 'Notices', body: 'Post announcements for students and parents. They appear in the portal instantly.' },
    { id: 'payroll', target: '/payroll', title: 'Payroll', body: 'Generate monthly salaries for all staff in one click, with SSF and tax calculated for you.', roles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'] },
    { id: 'my-attendance', target: '/my-attendance', title: 'Your own attendance', body: 'Check in when you arrive and check out when you leave. Your leave requests are in "My Leave".', roles: ['TEACHER', 'STAFF', 'ACCOUNTANT'] },
    { id: 'settings', target: '/settings', title: 'Settings', body: 'Invite your team (Users), set invoice prefix and working hours (Preferences), and turn nightly automation on or off (Automation).', roles: ['ADMIN', 'SUPER_ADMIN'] },
    helpStep,
    finish,
  ],

  business: [
    welcome('business'),
    { id: 'switcher', target: 'company-switcher', title: 'Your company', body: 'The company you are working in. The green dot means the subscription is active.' },
    { id: 'dashboard', target: '/', title: 'Dashboard', body: 'Sales, purchases, cash flow and reminders at a glance. It fills in as you add data.' },
    { id: 'clients', target: '/clients', title: 'Start here: clients and vendors', body: 'Add the people you sell to (Clients) and buy from (Vendors). Use "Import" to bring in a list from Excel.' },
    { id: 'inventory', target: '/inventory', title: 'Inventory', body: 'Add your products with prices and stock. Stock goes down with every sale and up with every purchase.' },
    { id: 'sales', target: '/sales', title: 'Sales', body: 'Create invoices for customers. VAT and invoice numbers are handled for you.' },
    { id: 'purchase', target: '/purchase', title: 'Purchase', body: 'Record bills from vendors to track what you owe and update stock.' },
    { id: 'ledger', target: '/ledger', title: 'Accounts', body: 'Sales and purchases post to the ledger automatically. Check balances here and in Transactions.', roles: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'] },
    { id: 'employees', target: '/employees', title: 'Your team', body: 'Add employees, track attendance and run payroll from the HR section.' },
    { id: 'settings', target: '/settings', title: 'Settings', body: 'Invite your team (Users), set your invoice prefix (Preferences) and manage nightly automation.', roles: ['ADMIN', 'SUPER_ADMIN'] },
    helpStep,
    finish,
  ],
};

export function getTourSteps(mode, role) {
  return (TOURS[mode] || []).filter((s) => !s.roles || s.roles.includes(role));
}

// ── Manual ───────────────────────────────────────────────────────────────
// `for`: which products a section applies to ('school' | 'business' | 'platform').
// `roles`: if set, only shown to these roles (SUPER_ADMIN always sees all).
// Blocks: { p }, { steps: [] }, { list: [] }, { tip }, { table: [[a, b], ...] }.

export const GUIDE_GROUPS = [
  { id: 'start', title: 'Getting started' },
  { id: 'academic', title: 'Students & academics' },
  { id: 'money', title: 'Fees & accounts' },
  { id: 'business', title: 'Business' },
  { id: 'people', title: 'Staff & HR' },
  { id: 'facilities', title: 'Facilities' },
  { id: 'admin', title: 'Settings & admin' },
  { id: 'help', title: 'Tips & answers' },
];

export const GUIDE_SECTIONS = [
  // ── Getting started ──
  {
    id: 'platform-clients', group: 'start', for: ['platform'], icon: 'Layers',
    title: 'Setting up a new client',
    summary: 'For the platform owner: create a school or business, choose their package, and step into their account.',
    blocks: [
      { steps: [
        'Open Settings → Clients.',
        'Fill in "Create Client": the school or business name, the product (School Management System or Business), and the admin\'s name and email.',
        'Click "Create Client & Send Login". The admin receives their login by email.',
        'In the client\'s row, choose a package: Base, Standard or Premium. You can also tick individual add-on modules, then click Save.',
        'Optionally set a Subscription Expiry. After that date their staff are locked out until you renew it; their data stays safe.',
        'Click "Switch To" (or pick them from the company selector at the top) to open their account and see their full menu.',
      ] },
      { tip: 'When no client is selected you only see "Clients". That is normal: the full menu appears once you switch into a client.' },
      { p: 'Other actions in a client\'s row: "Reset Password" sends their admin a new password, "Deactivate" pauses their access immediately, and "Max Companies" limits how many branches their admin can create themselves.' },
    ],
  },
  {
    id: 'first-steps-school', group: 'start', for: ['school'], icon: 'Rocket',
    title: 'First steps for a new school',
    summary: 'The best order to set things up, so every page has what it needs.',
    blocks: [
      { p: 'A new school starts empty, so the dashboard shows zeros. Follow these steps in order: each one prepares the next.' },
      { steps: [
        'Employees: add your teachers and staff (Setup → Employees → "Add Employee", or "Import" for Excel).',
        'Users: give the people who need to log in an account (Settings → Users → "Invite User") and choose their role.',
        'Classes: create every class and section, and pick a class teacher (Setup → Classes → "Add Class").',
        'Subjects: add subjects for each class (Setup → Subjects → "Add Subject").',
        'Students: enroll them one by one ("Enroll Student") or upload a list ("Import Students").',
        'Fees: create Fee Heads, set your fee amounts, then "Run Billing" to create this month\'s invoices.',
        'Calendar and Events: add holidays and exam dates so everyone can see them.',
        'Routine: build the weekly timetable ("Add Period").',
      ] },
      { tip: 'Have a spreadsheet already? Use "Import" on Students and Employees. It saves hours of typing.' },
    ],
  },
  {
    id: 'first-steps-business', group: 'start', for: ['business'], icon: 'Rocket',
    title: 'First steps for a new business',
    summary: 'The best order to set things up for sales, purchases and accounts.',
    blocks: [
      { steps: [
        'Settings → Preferences: set your invoice prefix (for example ABC gives ABC/2081-82/0001).',
        'Clients and Vendors: add the people you sell to and buy from, or use "Import".',
        'Inventory: add your products with price and opening stock.',
        'Ledger: check your accounts (cash, bank and so on) and add any you need with "Add Account".',
        'Sales and Purchase: start recording invoices and bills. Everything posts to the ledger for you.',
        'Employees: add staff, then use Attendance and Payroll.',
        'Settings → Users: invite your team with the right role.',
      ] },
    ],
  },
  {
    id: 'roles', group: 'start', for: ['school', 'business', 'platform'], icon: 'Shield',
    title: 'Who can do what (roles)',
    summary: 'Each login has a role. The role decides which menu items a person sees.',
    blocks: [
      { table: [
        ['Admin', 'Everything: settings, users, payroll, deleting records.'],
        ['Accountant', 'Fees, ledger, transactions, payroll and reports. Cannot change settings or users.'],
        ['Staff', 'Front-desk work: students, fees, attendance, notices. Can be given extra duties with tags: HR, Library, Hostel, Transport, or Front Office (gives parents and students their portal login).'],
        ['Teacher', 'Their classes, students, attendance, homework, exams marks, routine, notices and their own attendance and leave.'],
        ['Super Admin', 'The platform owner (GeoInfosys). Creates clients and can step into any of them.'],
      ] },
      { tip: 'A menu item is missing? Either the role cannot use it, or the school\'s package does not include that module. See "Why is a menu item missing?".' },
    ],
  },
  {
    id: 'topbar', group: 'start', for: ['school', 'business'], icon: 'PanelTop',
    title: 'The top bar',
    summary: 'The buttons along the top of every page.',
    blocks: [
      { table: [
        ['Company name', 'The school or company you are working in. Click to switch if you have more than one.'],
        ['Dates', 'Today in Bikram Sambat (BS) and English (AD). The app uses BS for fee months and fiscal years.'],
        ['Wrench', 'Handy tools: calculator, Nepali calendar and currency converter.'],
        ['Gear', 'Settings (admins only).'],
        ['Magnifier', 'Quick search across the app.'],
        ['EN / NE', 'Switch the whole app between English and Nepali.'],
        ['Moon', 'Dark mode on or off.'],
        ['Question mark', 'This guide, and the option to replay the tour.'],
        ['Your name', 'Your account and logout.'],
      ] },
    ],
  },

  // ── Students & academics ──
  {
    id: 'dashboard-school', group: 'academic', for: ['school'], icon: 'LayoutDashboard',
    title: 'Dashboard',
    summary: 'A live overview of the school.',
    blocks: [
      { list: [
        'Totals: students, classes, fees collected this month and this year, pending dues.',
        'Today\'s attendance by class: red means below 75%, grey means not marked yet.',
        'Reminders and "This Week Ahead": upcoming exams, events and homework due.',
        'Students with pending fees, so you can follow up.',
        '"Class Insights" (top right) uses AI to point out classes that need attention.',
      ] },
      { tip: 'Everything shows zero at first. That is normal for a new school: it fills in as you add students, attendance and fees.' },
    ],
  },
  {
    id: 'classes', group: 'academic', for: ['school'], icon: 'School',
    title: 'Classes and subjects',
    summary: 'The structure everything else is built on.',
    blocks: [
      { steps: [
        'Setup → Classes → "Add Class". Enter the class name and section, and choose a class teacher.',
        'Setup → Subjects → "Add Subject". Pick the class and enter the subject details.',
      ] },
      { tip: 'Teachers can see and manage subjects and routine for their own classes. Only an admin can delete a class.' },
    ],
  },
  {
    id: 'students', group: 'academic', for: ['school'], icon: 'GraduationCap',
    title: 'Students',
    summary: 'Enroll, import, promote and give portal access.',
    blocks: [
      { steps: [
        'Academic → Students → "Enroll Student". Fill in the student and guardian details and choose a class.',
        'For many students: "Import Students" and upload an Excel/CSV file. Classes that don\'t exist yet are created for you.',
        'Search and filter by class at the top of the list.',
      ] },
      { p: 'At the end of the year, use "Promote Students" to move a whole class up in one step.' },
      { p: 'Removing a student marks them Inactive: they are no longer billed, but their records, invoices and results are kept. Use the Reactivate button on their row to bring them back.' },
      { p: 'Portal access: open a student and set their portal login. Students and parents can then log in at the portal to see attendance, fees, results, homework and notices, and pay fees online with eSewa or Khalti.' },
    ],
  },
  {
    id: 'attendance', group: 'academic', for: ['school'], icon: 'CalendarCheck2',
    title: 'Student attendance',
    summary: 'Mark the class register in seconds.',
    blocks: [
      { steps: [
        'Academic → Attendance. Choose the class and date.',
        'Tap "All Present", then switch the few absent students to Absent.',
        'Click "Mark Attendance" to save.',
      ] },
      { p: 'Parents of absent students can receive an SMS (if SMS is set up for your school). Use "Report" to see attendance over a period.' },
    ],
  },
  {
    id: 'routine', group: 'academic', for: ['school'], icon: 'CalendarDays',
    title: 'Routine (timetable)',
    summary: 'The weekly class schedule.',
    blocks: [
      { steps: ['Academic → Routine. Choose the class.', 'Click "Add Period" and set the day, time, subject and teacher.'] },
      { p: 'Students and parents see the timetable in their portal.' },
    ],
  },
  {
    id: 'exams', group: 'academic', for: ['school'], icon: 'Trophy',
    title: 'Exams and report cards',
    summary: 'Create exams, enter marks and print report cards.',
    blocks: [
      { steps: [
        'Academic → Exam → "Add Exam" (for example First Terminal).',
        'Enter marks with "Bulk Enter Marks" for a whole class at once.',
        'Open "Report Card" to see and print each student\'s result. AI can suggest the teacher\'s comment.',
      ] },
      { p: 'Results appear in the student portal once published.' },
    ],
  },
  {
    id: 'homework', group: 'academic', for: ['school'], icon: 'ClipboardList',
    title: 'Homework and study material',
    summary: 'Share work and notes with students.',
    blocks: [
      { list: [
        'Homework → "Assign Homework": choose the class, subject and due date. AI can help write it.',
        'Study Material → "Upload Study Material": share notes, PDFs and images with a class.',
        'Both appear in the student and parent portal.',
      ] },
    ],
  },
  {
    id: 'notices', group: 'academic', for: ['school'], icon: 'Megaphone',
    title: 'Notices, calendar and events',
    summary: 'Keep everyone informed.',
    blocks: [
      { list: [
        'Communication → Notices → "Post Notice". AI can draft the notice for you. Notices appear in the portal instantly.',
        'Setup → Calendar and Events → "Add Event" for holidays, exams and school events.',
      ] },
    ],
  },

  // ── Fees & accounts ──
  {
    id: 'fees', group: 'money', for: ['school'], icon: 'DollarSign',
    title: 'Fees: from setup to receipt',
    summary: 'How fee billing works, step by step.',
    roles: ['ADMIN', 'ACCOUNTANT', 'STAFF'],
    blocks: [
      { p: 'The Fees page has several tabs. Set them up once, then billing is one click a month.' },
      { table: [
        ['Fee Heads', 'Types of fee: tuition, admission, exam, bus, hostel… Each one goes to its own income account.'],
        ['Fee Structures', 'How much each class pays for each fee head.'],
        ['Packages', 'Ready-made bundles of fees you can give to a student.'],
        ['Fee Profile', 'One student\'s fees, including scholarships. Bus and hostel fees are detected automatically.'],
        ['Fee Invoices', 'The bills. "Run Billing" creates this month\'s invoice for every student at once.'],
        ['Pending Proofs', 'Payment screenshots from parents, waiting for you to check. (Payments made with the eSewa/Khalti buttons in the portal are confirmed automatically.)'],
      ] },
      { steps: [
        'Create your Fee Heads.',
        'Set amounts in Fee Structures (and Packages or scholarships if needed).',
        'On Fee Invoices, click "Run Billing" and choose the BS month (for example 2083-Kartik). Students already billed for that month are skipped.',
        'When a parent pays at the desk, click "Record Payment". A receipt number like R-2083-0001 is created.',
        'Use "Send SMS Reminder" for students with pending fees.',
      ] },
      { tip: 'Invoices can be held for review or released to the student portal ("Release to student portal"). Payments are posted to the ledger automatically: you never need to make a journal entry for fees.' },
    ],
  },
  {
    id: 'ledger', group: 'money', for: ['school', 'business'], icon: 'BookOpen',
    title: 'Ledger and transactions',
    summary: 'Your accounts, kept up to date automatically.',
    roles: ['ADMIN', 'ACCOUNTANT'],
    blocks: [
      { list: [
        'Ledger: every account (cash, bank, income, expenses) with its balance. "Add Account" to create one.',
        'Transactions: every payment in and out. "New Transaction" for anything not recorded elsewhere, like rent or electricity.',
        'Fee payments, sales, purchases and payroll post here by themselves, with matching debit and credit entries.',
      ] },
    ],
  },
  {
    id: 'reports', group: 'money', for: ['school', 'business'], icon: 'BarChart2',
    title: 'Reports',
    summary: 'Charts and summaries you can print.',
    blocks: [
      { p: 'Main → Reports. Schools get attendance, academics, fees and operations reports. Teachers see the attendance and academic tabs only.' },
    ],
  },

  // ── Business ──
  {
    id: 'sales', group: 'business', for: ['business'], icon: 'Receipt',
    title: 'Sales, quotations and clients',
    summary: 'Selling to your customers.',
    blocks: [
      { list: [
        'Clients: your customers, with contact details and what they owe you.',
        'Quotations: price offers you can later turn into a sale.',
        'Sales: invoices with VAT and automatic numbering. Stock is reduced for you.',
        'Credit notes for returns are available from a sale.',
      ] },
    ],
  },
  {
    id: 'purchase', group: 'business', for: ['business'], icon: 'ShoppingCart',
    title: 'Purchases, vendors and inventory',
    summary: 'Buying and keeping stock.',
    blocks: [
      { list: [
        'Vendors: your suppliers and what you owe them.',
        'Purchase: record bills from vendors. Stock goes up for you.',
        'Inventory: products, prices and stock levels. You get an alert when stock runs low.',
      ] },
    ],
  },
  {
    id: 'records', group: 'business', for: ['business'], icon: 'FileText',
    title: 'Memo, communication, templates and workflow',
    summary: 'Paperwork and team tasks.',
    blocks: [
      { list: [
        'Memo: internal notes and filed documents.',
        'Communication: track calls and follow-ups with clients and vendors.',
        'Templates: reusable document layouts.',
        'Workflow: a task board to move work from "to do" to "done".',
      ] },
    ],
  },

  // ── Staff & HR ──
  {
    id: 'employees', group: 'people', for: ['school', 'business'], icon: 'UserCircle',
    title: 'Employees and logins',
    summary: 'Adding staff, and giving them access to the app.',
    blocks: [
      { steps: [
        'Employees → "Add Employee" (or "Import" from Excel). This creates their staff record for attendance and payroll.',
        'To let someone log in, go to Settings → Users → "Invite User" and choose their role.',
      ] },
      { tip: 'Not every employee needs a login: drivers, guards and cleaners can exist as employees only, for attendance and payroll.' },
      { p: 'Staff tags give a Staff login extra duties: HR (employees and staff attendance), Library, Hostel, Transport, or Front Office (setting up student and parent portal access).' },
    ],
  },
  {
    id: 'staff-attendance', group: 'people', for: ['school', 'business'], icon: 'Fingerprint',
    title: 'Staff attendance and leave',
    summary: 'Check in, check out and request leave.',
    blocks: [
      { list: [
        'My Attendance: tap "Check In" when you arrive and "Check Out" when you leave.',
        'My Leave: request leave. An admin or accountant approves it. Approved days show as Leave in staff attendance; unpaid leave is deducted from salary.',
        "Leave balances: each leave type's days per year is everyone's allowance. Admins can change one person's allowance in My Leave → Leave Balances.",
        'Staff Attendance (HR): see and correct everyone\'s attendance, or mark it for staff without a login.',
        'You can also mark attendance from the login screen ("Quick Attendance") without signing in fully.',
      ] },
    ],
  },
  {
    id: 'payroll', group: 'people', for: ['school', 'business'], icon: 'Banknote',
    title: 'Payroll',
    summary: 'Monthly salaries in one click.',
    roles: ['ADMIN', 'ACCOUNTANT'],
    blocks: [
      { steps: [
        'Make sure each employee has their salary set on the Employees page.',
        'HR → Payroll → choose the month → "Generate Payroll".',
        'Review each payslip. SSF and income tax are calculated for you, and absences are deducted using your working-day settings.',
      ] },
      { p: 'Salaries are posted to the ledger automatically. Payroll can also run by itself every month (see Automation); re-running it never changes a payslip that is paid, on hold, or adjusted.' },
      { tip: 'Hold a salary to stop it being paid until you release it. A paid payslip is locked and can no longer be adjusted.' },
    ],
  },

  // ── Facilities ──
  {
    id: 'facilities', group: 'facilities', for: ['school'], icon: 'Library',
    title: 'Library, hostel and transport',
    summary: 'Optional modules (Standard and Premium packages).',
    blocks: [
      { table: [
        ['Library', '"Add Book" to build the catalogue, "Issue Book" to lend one. Students get a reminder 3 days before it\'s due.'],
        ['Hostel', '"Add Room" and assign students. Their hostel fee is added to their fee profile automatically.'],
        ['Transport', '"Add Route" with stops and a vehicle, then assign students. Their bus fee is added automatically.'],
      ] },
    ],
  },

  // ── Settings & admin ──
  {
    id: 'settings', group: 'admin', for: ['school', 'business'], icon: 'Settings',
    title: 'Settings',
    summary: 'Everything on the Settings page, tab by tab.',
    roles: ['ADMIN'],
    blocks: [
      { table: [
        ['Users', 'Invite team members, change their role, reset passwords, suspend or remove them.'],
        ['Preferences', 'Invoice prefix, working days and hours (for salary deductions), fiscal year, appearance and notifications.'],
        ['Automation', 'Jobs that run by themselves every night. See "Nightly automation".'],
        ['Recycle Bin', 'Deleted records wait here and can be restored. Choose how many days before they are removed for good.'],
      ] },
      { p: 'Preferences in detail:' },
      { list: [
        'Invoice Prefix: appears in invoice numbers, for example ABC/2081-82/0001.',
        'Working Days per Month: used to deduct salary for absent days (default 26).',
        'Working Hours: if turned on, staff who work fewer hours than expected get a small prorated deduction.',
        'Fiscal Year: Shrawan 1 to Ashadh end. When a year ends, close it here (needs your password). It can be reopened if needed.',
        'Appearance: your logo, sidebar and top bar colours, and font size.',
        'Notifications: choose which alerts you receive.',
      ] },
    ],
  },
  {
    id: 'automation', group: 'admin', for: ['school', 'business'], icon: 'Clock',
    title: 'Nightly automation',
    summary: 'What runs by itself every night, and what each switch does.',
    blocks: [
      { p: 'Once every night, before the working day starts, OneBook does routine work for you. Each job can be turned on or off in Settings → Automation. It is safe to leave them on: every job skips anything already done, so nothing is ever billed or paid twice.' },
      { table: [
        ['Auto fee billing', 'Creates the month\'s fee invoice for every active student. It runs nightly but only bills once per BS month.'],
        ['Auto invoice release', 'Sends those new invoices to the student portal straight away. Turn off to review them first.'],
        ['Library reminders', 'Sends a friendly "book due in 3 days" reminder to students.'],
        ['Payment proof reminders', 'Reminds admins and accountants about online payment screenshots waiting for review. It never approves payments itself.'],
        ['Auto payroll', 'Processes the month\'s salaries for all employees, once per month.'],
        ['Daily reconciliation', 'A morning summary of yesterday\'s income and expenses, overdue invoices, and a check that the ledger balances.'],
      ] },
      { p: 'When the night\'s work changes anything, admins receive one notification ("Nightly automation completed") listing what was done.' },
    ],
  },
  {
    id: 'audit', group: 'admin', for: ['school', 'business'], icon: 'Shield',
    title: 'Audit log',
    summary: 'Who changed what, and when.',
    roles: ['ADMIN'],
    blocks: [{ p: 'Admin → Audit Log lists every important change: who did it, when, and what changed. Useful for checking mistakes or suspicious activity.' }],
  },
  {
    id: 'subscription', group: 'admin', for: ['school', 'business'], icon: 'CreditCard',
    title: 'Subscription and packages',
    summary: 'What happens when a subscription ends, and how packages work.',
    blocks: [
      { list: [
        'Your package (Base, Standard or Premium) decides which modules appear in the menu.',
        'When a subscription expires, access pauses until it is renewed. Your data is never deleted.',
        'You can request a renewal from the banner at the top of the app.',
      ] },
    ],
  },

  // ── Tips & answers ──
  {
    id: 'faq', group: 'help', for: ['school', 'business', 'platform'], icon: 'HelpCircle',
    title: 'Common questions',
    summary: 'Quick answers to things people often ask.',
    blocks: [
      { table: [
        ['Why is a menu item missing?', 'Either your role cannot use it, or your package does not include it. Ask your admin, or GeoInfosys to upgrade the package.'],
        ['Why does everything show zero?', 'Nothing has been added yet. Follow "First steps" and the numbers fill in.'],
        ['Which dates does the app use?', 'Bikram Sambat (BS) for fee months and fiscal years. English (AD) dates are shown next to them.'],
        ['I deleted something by mistake.', 'Most records can be restored from Settings → Recycle Bin. A removed student is just marked Inactive — use Reactivate on their row.'],
        ['How do I switch to Nepali?', 'Click EN in the top bar.'],
        ['How do parents pay online?', 'In the student portal, with eSewa or Khalti. You confirm screenshot payments under Fees → Pending Proofs.'],
        ['Can I see the tour again?', 'Yes: Help & Guide → "Replay the tour".'],
      ] },
    ],
  },
];

export function getGuideSections({ mode, role }) {
  return GUIDE_SECTIONS.filter((s) =>
    s.for.includes(mode) && (!s.roles || role === 'SUPER_ADMIN' || s.roles.includes(role)));
}
