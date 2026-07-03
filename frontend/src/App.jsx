import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { ThemeProvider } from 'next-themes'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
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
import AcademicYear from './pages/school/AcademicYear';
import Timetable from './pages/school/Timetable';
import Notices from './pages/school/Notices';
import Events from './pages/school/Events';
import StudyMaterials from './pages/school/StudyMaterials';
import Homework from './pages/school/Homework';
import Library from './pages/school/Library';
import Hostel from './pages/school/Hostel';
import Transport from './pages/school/Transport';
import PortalLogin from './pages/portal/PortalLogin';
import PortalLayout from './components/layout/PortalLayout';
import PortalDashboard from './pages/portal/PortalDashboard';
import PortalAttendance from './pages/portal/PortalAttendance';
import PortalFees from './pages/portal/PortalFees';
import PortalResults from './pages/portal/PortalResults';
import PortalHomework from './pages/portal/PortalHomework';
import PortalNotices from './pages/portal/PortalNotices';
import PortalTimetable from './pages/portal/PortalTimetable';
import PaymentReturn from './pages/portal/PaymentReturn';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, navigateToLogin, user } = useAuth();
  const isSchool = user?.defaultCompany?.businessType === 'SCHOOL';

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
            <Route path="/" element={<SchoolDashboard />} />
            <Route path="/students" element={<Students />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/subjects" element={<Subjects />} />
            <Route path="/fees" element={<Fees />} />
            <Route path="/exams" element={<Exams />} />
            <Route path="/student-attendance" element={<StudentAttendance />} />
            <Route path="/academic-years" element={<AcademicYear />} />
            <Route path="/timetable" element={<Timetable />} />
            <Route path="/notices" element={<Notices />} />
            <Route path="/events" element={<Events />} />
            <Route path="/study-materials" element={<StudyMaterials />} />
            <Route path="/homework" element={<Homework />} />
            <Route path="/library" element={<Library />} />
            <Route path="/hostel" element={<Hostel />} />
            <Route path="/transport" element={<Transport />} />
            {/* Shared modules — reused as-is */}
            <Route path="/employees" element={<Employees />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/ledger" element={<Ledger />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
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
              </Route>
              <Route path="/portal/payment/return" element={<PaymentReturn />} />
              <Route path="*" element={<AuthenticatedApp />} />
            </Routes>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
}

export default App