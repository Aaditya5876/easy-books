import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, ArrowLeftRight, Users, UserCheck,
  Package, ShoppingCart, Receipt, FileText, MessageSquare,
  FileSpreadsheet, CalendarCheck, Banknote,
  ChevronLeft, ChevronRight, ChevronDown, ClipboardList, BarChart2,
  Kanban, UserCircle, Settings, Shield,
  GraduationCap, School, BookMarked, DollarSign, Trophy,
  Megaphone, CalendarDays, CalendarCheck2,
  FolderOpen, Library, Home, Bus
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { useTranslation } from 'react-i18next';
import { useRole } from "@/lib/useRole";
import { usePreferences, isColorDark } from '@/lib/PreferencesContext';
import { useAuth } from '@/lib/AuthContext';

const navSections = [
  {
    label: 'Main',
    labelColor: 'text-sidebar-muted',
    activeClass: 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
      { icon: BarChart2, label: 'Reports', path: '/reports' },
    ]
  },
  {
    label: 'Accounts',
    labelColor: 'text-blue-400',
    activeClass: 'bg-blue-600 text-white shadow-sm shadow-blue-900/30',
    // Ledger/Transactions endpoints are ACCOUNTANT/ADMIN-only on the backend —
    // keep STAFF from seeing a dead link.
    minRole: 'accountant',
    items: [
      { icon: BookOpen, label: 'Ledger', path: '/ledger', module: 'FINANCE' },
      { icon: ArrowLeftRight, label: 'Transactions', path: '/transactions', module: 'FINANCE' },
    ]
  },
  {
    label: 'Business',
    labelColor: 'text-emerald-400',
    activeClass: 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/30',
    items: [
      { icon: Users, label: 'Vendors', path: '/vendors' },
      { icon: UserCheck, label: 'Clients', path: '/clients' },
      { icon: Package, label: 'Inventory', path: '/inventory', module: 'INVENTORY' },
      { icon: ShoppingCart, label: 'Purchase', path: '/purchase' },
      { icon: Receipt, label: 'Sales', path: '/sales' },
      { icon: ClipboardList, label: 'Quotations', path: '/quotations' },
    ]
  },
  {
    label: 'Workflow',
    labelColor: 'text-amber-400',
    activeClass: 'bg-amber-600 text-white shadow-sm shadow-amber-900/30',
    items: [
      { icon: Kanban, label: 'Workflow', path: '/workflow' },
    ]
  },
  {
    label: 'Records',
    labelColor: 'text-violet-400',
    activeClass: 'bg-violet-600 text-white shadow-sm shadow-violet-900/30',
    items: [
      { icon: FileText, label: 'Memo', path: '/memo', module: 'COMMUNICATION' },
      { icon: MessageSquare, label: 'Communication', path: '/communication', module: 'COMMUNICATION' },
      { icon: FileSpreadsheet, label: 'Templates', path: '/templates' },
    ]
  },
  {
    label: 'HR',
    labelColor: 'text-sky-400',
    activeClass: 'bg-sky-600 text-white shadow-sm shadow-sky-900/30',
    // visible to ACCOUNTANT + ADMIN
    minRole: 'accountant',
    items: [
      { icon: UserCircle, label: 'Employees', path: '/employees', module: 'HRMS' },
      { icon: CalendarCheck, label: 'Attendance', path: '/attendance', module: 'HRMS' },
      { icon: Banknote, label: 'Payroll', path: '/payroll', module: 'HRMS' },
    ]
  },
  {
    label: 'Admin',
    labelColor: 'text-rose-400',
    activeClass: 'bg-rose-600 text-white shadow-sm shadow-rose-900/30',
    minRole: 'admin',
    items: [
      { icon: Settings, label: 'Settings', path: '/settings' },
      { icon: Shield, label: 'Audit Log', path: '/audit-log' },
    ]
  },
];

// `roles` on an item = also visible to these restricted roles (TEACHER / LIBRARIAN).
// Items without `roles` are hidden from restricted roles entirely.
// `minRole` on an item mirrors the section-level gate (admin / accountant).
// Sections are ordered by first-run dependency: Setup holds what everything
// else needs (year → teachers → classes → subjects), then daily-use modules.
const schoolNavSections = [
  {
    label: 'Main',
    labelColor: 'text-sidebar-muted',
    activeClass: 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['TEACHER', 'LIBRARIAN'] },
      // Reports is split by tab for TEACHER (see SchoolReports.jsx) — the backend
      // only grants TEACHER the Attendance/Academics analytics endpoints, not
      // Fees/Operations/Audit. LIBRARIAN has no backend access to any tab, so stays hidden.
      { icon: BarChart2, label: 'Reports', path: '/reports', roles: ['TEACHER'] },
    ]
  },
  {
    label: 'Setup',
    labelColor: 'text-rose-400',
    activeClass: 'bg-rose-600 text-white shadow-sm shadow-rose-900/30',
    items: [
      { icon: CalendarDays, label: 'Calendar and Events', path: '/calendar-events', roles: ['TEACHER', 'LIBRARIAN'] },
      { icon: UserCircle, label: 'Teachers', path: '/employees', minRole: 'accountant' },
      { icon: School, label: 'Classes', path: '/classes', roles: ['TEACHER'] },
      { icon: BookMarked, label: 'Subjects', path: '/subjects', roles: ['TEACHER'] },
    ]
  },
  {
    label: 'Academic',
    labelColor: 'text-emerald-400',
    activeClass: 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/30',
    items: [
      { icon: GraduationCap, label: 'Students', path: '/students', roles: ['TEACHER', 'LIBRARIAN'] },
      { icon: CalendarCheck2, label: 'Attendance', path: '/student-attendance', roles: ['TEACHER'] },
      { icon: CalendarDays, label: 'Routine', path: '/routine', roles: ['TEACHER'] },
      { icon: Trophy, label: 'Exam', path: '/exams', roles: ['TEACHER'] },
      { icon: FolderOpen, label: 'Study Material', path: '/study-materials', roles: ['TEACHER'] },
      { icon: ClipboardList, label: 'Homework', path: '/homework', roles: ['TEACHER'] },
    ]
  },
  {
    label: 'Finance',
    labelColor: 'text-blue-400',
    activeClass: 'bg-blue-600 text-white shadow-sm shadow-blue-900/30',
    items: [
      { icon: DollarSign, label: 'Fees', path: '/fees' },
      // Ledger/Transactions endpoints are ACCOUNTANT/ADMIN-only on the backend —
      // keep STAFF from seeing a dead link (Fees stays open to STAFF for front-desk use).
      { icon: BookOpen, label: 'Ledger', path: '/ledger', minRole: 'accountant', module: 'FINANCE' },
      { icon: ArrowLeftRight, label: 'Transactions', path: '/transactions', minRole: 'accountant', module: 'FINANCE' },
    ]
  },
  {
    label: 'Communication',
    labelColor: 'text-amber-400',
    activeClass: 'bg-amber-600 text-white shadow-sm shadow-amber-900/30',
    items: [
      // Notices is SMS's own notice board — the shared Communication/Memo modules
      // (client/vendor task tracking, quotation/bill filing) don't reach students
      // or parents and are deliberately excluded here; both stay intact for
      // business companies via the non-school sidebar/routes.
      { icon: Megaphone, label: 'Notices', path: '/notices', roles: ['TEACHER', 'LIBRARIAN'] },
    ]
  },
  {
    label: 'Facilities',
    labelColor: 'text-violet-400',
    activeClass: 'bg-violet-600 text-white shadow-sm shadow-violet-900/30',
    items: [
      { icon: Library, label: 'Library', path: '/library', roles: ['LIBRARIAN'] },
      { icon: Home, label: 'Hostel', path: '/hostel' },
      { icon: Bus, label: 'Transport', path: '/transport' },
    ]
  },
  {
    label: 'HR',
    labelColor: 'text-sky-400',
    activeClass: 'bg-sky-600 text-white shadow-sm shadow-sky-900/30',
    minRole: 'accountant',
    items: [
      { icon: CalendarCheck, label: 'Staff Attendance', path: '/attendance', module: 'HRMS' },
      { icon: Banknote, label: 'Payroll', path: '/payroll', module: 'HRMS' },
    ]
  },
  {
    label: 'Admin',
    labelColor: 'text-rose-400',
    activeClass: 'bg-rose-600 text-white shadow-sm shadow-rose-900/30',
    minRole: 'admin',
    items: [
      { icon: Settings, label: 'Settings', path: '/settings' },
      { icon: Shield, label: 'Audit Log', path: '/audit-log' },
    ]
  },
];

export default function SidebarNav({ collapsed, onToggle }) {
  const location = useLocation();
  const { t } = useTranslation();
  const nt = (label) => t(`nav.${label}`, { defaultValue: label });
  const { isAdmin, canViewPayroll, isTeacher, isLibrarian, role } = useRole();
  const { prefs } = usePreferences();
  const { user } = useAuth();
  const isSchool = user?.defaultCompany?.businessType === 'SCHOOL';
  // Empty/missing enabledModules = unrestricted (legacy/full-access plan) —
  // mirrors ModuleAccessGuard's backend behavior for the same field.
  const enabledModules = user?.defaultCompany?.enabledModules || [];
  const isModuleEnabled = (moduleKey) => !moduleKey || enabledModules.length === 0 || enabledModules.includes(moduleKey);
  const [expandedSections, setExpandedSections] = useState(
    Array(Math.max(navSections.length, schoolNavSections.length)).fill(true)
  );

  const hasBgColor = !!prefs.sidebarColor;
  const bgIsDark = hasBgColor ? isColorDark(prefs.sidebarColor) : true;

  const toggleSection = (index) => {
    setExpandedSections(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const activeSections = isSchool ? schoolNavSections : navSections;

  // TEACHER / LIBRARIAN only see items explicitly tagged with their role
  const restrictedRole = isTeacher || isLibrarian;

  const visibleSections = activeSections
    .filter(section => {
      if (section.minRole === 'admin') return isAdmin;
      if (section.minRole === 'accountant') return canViewPayroll;
      return true;
    })
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (item.minRole === 'admin' && !isAdmin) return false;
        if (item.minRole === 'accountant' && !canViewPayroll) return false;
        if (!isModuleEnabled(item.module)) return false;
        return !restrictedRole || item.roles?.includes(role);
      }),
    }))
    .filter(section => section.items.length > 0);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground z-40 flex flex-col transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
      style={hasBgColor ? { backgroundColor: prefs.sidebarColor } : undefined}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 h-20 border-b shrink-0",
        hasBgColor ? "border-white/10" : "border-sidebar-border"
      )}>
        {prefs.companyLogoUrl ? (
          <img src={prefs.companyLogoUrl} alt="Company" className="w-16 h-16 rounded-lg object-cover shrink-0 ring-1 ring-white/20" />
        ) : (
          <img src="/logo-icon.png" alt="OneBook" className="w-16 h-16 object-contain shrink-0" />
        )}
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className={cn(
              "text-sm font-bold tracking-tight",
              hasBgColor ? (bgIsDark ? "text-white" : "text-gray-900") : "text-sidebar-foreground"
            )}>OneBook</h1>
            <p className={cn(
              "text-[10px] leading-none",
              hasBgColor ? (bgIsDark ? "text-white/50" : "text-gray-600") : "text-sidebar-muted"
            )}>{isSchool ? 'School Management' : 'ERP · CRM · HRM'}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {visibleSections.map((section, sIdx) => (
          <div key={section.label} className="mb-1">
            {!collapsed && (
              <button
                onClick={() => toggleSection(sIdx)}
                className={cn(
                  "flex items-center justify-between w-full px-2 py-1.5 text-[10px] uppercase tracking-widest hover:text-sidebar-foreground transition-colors",
                  section.labelColor
                )}
              >
                <span className="flex items-center gap-1.5">
                  {section.minRole === 'admin' && <Shield className="w-2.5 h-2.5" />}
                  {nt(section.label)}
                </span>
                <ChevronDown className={cn(
                  "w-3 h-3 transition-transform",
                  !expandedSections[sIdx] && "-rotate-90"
                )} />
              </button>
            )}
            {(collapsed || expandedSections[sIdx]) && (
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group relative",
                        isActive
                          ? cn(section.activeClass, "font-semibold shadow-sm")
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && (
                        <span className="truncate text-[13px] font-medium">{nt(item.label)}</span>
                      )}
                      {collapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                          {nt(item.label)}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* GeoInfosys badge */}
      {prefs.companyLogoUrl && !collapsed && (
        <div className={cn(
          "shrink-0 px-4 pb-1.5 text-center border-b",
          hasBgColor ? "border-white/10" : "border-sidebar-border"
        )}>
          <p className={cn(
            "text-[10px]",
            hasBgColor ? (bgIsDark ? "text-white/30" : "text-gray-400") : "text-sidebar-muted/50"
          )}>Powered by GeoInfosys</p>
        </div>
      )}

      {/* Collapse toggle */}
      <div className={cn(
        "shrink-0 p-2 border-t",
        hasBgColor ? "border-white/10" : "border-sidebar-border"
      )}>
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
