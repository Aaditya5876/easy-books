import { Toaster } from "@/components/ui/toaster"
import { ConfirmDialogHost } from "@/lib/confirm"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { ThemeProvider } from 'next-themes'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { PreferencesProvider } from '@/lib/PreferencesContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Ledger from './pages/Ledger';
import Transactions from './pages/Transactions';
import Vendors from './pages/Vendors';
import Clients from './pages/Clients';
import Inventory from './pages/Inventory';
import Purchase from './pages/Purchase';
import Sales from './pages/Sales';
import Memo from './pages/Memo';
import Communication from './pages/Communication';
import Templates from './pages/Templates';
import Calculator from './pages/Calculator';
import CalendarPage from './pages/CalendarPage';
import CurrencyConverter from './pages/CurrencyConverter';
import Settings from './pages/Settings';
import AuditLog from './pages/AuditLog';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Payroll from './pages/Payroll';
import Quotations from './pages/Quotations';
import Reports from './pages/Reports';
import Workflow from './pages/Workflow';
import SchoolDashboard from './pages/school/SchoolDashboard';
import Students from './pages/school/Students';
import Classes from './pages/school/Classes';
import Fees from './pages/school/Fees';
import Exams from './pages/school/Exams';
import Subjects from './pages/school/Subjects';
import StudentAttendance from './pages/school/StudentAttendance';
import CalendarEvents from './pages/school/CalendarEvents';
import Routine from './pages/school/Routine';
import Notices from './pages/school/Notices';
import Events from './pages/school/Events';
import StudyMaterial from './pages/school/StudyMaterial';
import Homework from './pages/school/Homework';
import Library from './pages/school/Library';
import Hostel from './pages/school/Hostel';
import Transport from './pages/school/Transport';
import SchoolReports from './pages/school/SchoolReports';
import PortalLogin from './pages/portal/PortalLogin';
import PortalLayout from './components/layout/PortalLayout';
import PortalDashboard from './pages/portal/PortalDashboard';
import PortalAttendance from './pages/portal/PortalAttendance';
import PortalFees from './pages/portal/PortalFees';
import PortalResults from './pages/portal/PortalResults';
import PortalHomework from './pages/portal/PortalHomework';
import PortalNotices from './pages/portal/PortalNotices';
import PortalTimetable from './pages/portal/PortalTimetable';
import PortalStudyMaterials from './pages/portal/PortalStudyMaterials';
import PortalExamSchedule from './pages/portal/PortalExamSchedule';
import PortalEvents from './pages/portal/PortalEvents';
import PaymentReturn from './pages/portal/PaymentReturn';

// `roles` = also available to these restricted roles (TEACHER / LIBRARIAN).
// Routes without `roles` are not registered for restricted roles.
const schoolRoutes = [
  { path: '/', page: SchoolDashboard, roles: ['TEACHER', 'LIBRARIAN'] },
  { path: '/students', page: Students, roles: ['TEACHER', 'LIBRARIAN'] },
  { path: '/classes', page: Classes, roles: ['TEACHER'] },
  { path: '/subjects', page: Subjects, roles: ['TEACHER'] },
  { path: '/fees', page: Fees },
  { path: '/exams', page: Exams, roles: ['TEACHER'] },
  { path: '/student-attendance', page: StudentAttendance, roles: ['TEACHER'] },
  { path: '/calendar-events', page: CalendarEvents, roles: ['TEACHER', 'LIBRARIAN'] },
  { path: '/routine', page: Routine, roles: ['TEACHER'] },
  { path: '/notices', page: Notices, roles: ['TEACHER', 'LIBRARIAN'] },
  { path: '/study-materials', page: StudyMaterial, roles: ['TEACHER'] },
  { path: '/homework', page: Homework, roles: ['TEACHER'] },
  { path: '/library', page: Library, roles: ['LIBRARIAN'] },
  { path: '/hostel', page: Hostel },
  { path: '/transport', page: Transport },
  // Communication and Memo are business-ERP modules (client/vendor task
  // tracking, quotation/bill filing) — neither reaches students or parents,
  // and Notices already covers school announcements, so they're deliberately
  // excluded from schoolRoutes. Both remain fully intact for business companies.
  // Shared modules — reused as-is
  { path: '/employees', page: Employees },
  { path: '/attendance', page: Attendance },
  { path: '/payroll', page: Payroll },
  { path: '/ledger', page: Ledger },
  { path: '/transactions', page: Transactions },
  { path: '/reports', page: SchoolReports, roles: ['TEACHER'] },
  { path: '/settings', page: Settings },
  { path: '/audit-log', page: AuditLog },
];

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, navigateToLogin, user } = useAuth();
  const isSchool = user?.defaultCompany?.businessType === 'SCHOOL';
  const role = user?.role;
  const restrictedRole = role === 'TEACHER' || role === 'LIBRARIAN';

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    navigateToLogin();
    return null;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        {isSchool ? (
          <>
            {schoolRoutes
              .filter(r => !restrictedRole || r.roles?.includes(role))
              .map(({ path, page: Page }) => (
                <Route key={path} path={path} element={<Page />} />
              ))}
          </>
        ) : (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/ledger" element={<Ledger />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/purchase" element={<Purchase />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/quotations" element={<Quotations />} />
            <Route path="/memo" element={<Memo />} />
            <Route path="/communication" element={<Communication />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/calculator" element={<Calculator />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/currency" element={<CurrencyConverter />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/audit-log" element={<AuditLog />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/workflow" element={<Workflow />} />
          </>
        )}
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};


function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
      <PreferencesProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              {/* Portal — completely separate auth from admin */}
              <Route path="/portal/login" element={<PortalLogin />} />
              <Route path="/portal" element={<PortalLayout />}>
                <Route index element={<PortalDashboard />} />
                <Route path="attendance" element={<PortalAttendance />} />
                <Route path="fees" element={<PortalFees />} />
                <Route path="results" element={<PortalResults />} />
                <Route path="homework" element={<PortalHomework />} />
                <Route path="notices" element={<PortalNotices />} />
                <Route path="timetable" element={<PortalTimetable />} />
                <Route path="study-materials" element={<PortalStudyMaterials />} />
                <Route path="exam-schedule" element={<PortalExamSchedule />} />
                <Route path="events" element={<PortalEvents />} />
              </Route>
              <Route path="/portal/payment/return" element={<PaymentReturn />} />
              <Route path="*" element={<AuthenticatedApp />} />
            </Routes>
          </Router>
          <Toaster />
          <ConfirmDialogHost />
        </QueryClientProvider>
      </AuthProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
}

export default App