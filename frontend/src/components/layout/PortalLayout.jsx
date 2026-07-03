import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarCheck, DollarSign, Trophy,
  ClipboardList, Megaphone, Clock, LogOut, BookOpen, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/portal' },
  { icon: CalendarCheck,   label: 'Attendance',  path: '/portal/attendance' },
  { icon: DollarSign,      label: 'Fees',         path: '/portal/fees' },
  { icon: Trophy,          label: 'Results',       path: '/portal/results' },
  { icon: ClipboardList,   label: 'Homework',     path: '/portal/homework' },
  { icon: Megaphone,       label: 'Notices',       path: '/portal/notices' },
  { icon: Clock,           label: 'Timetable',     path: '/portal/timetable' },
];

export default function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [student, setStudent] = useState(null);
  const [portalType, setPortalType] = useState('PARENT');

  useEffect(() => {
    const token = localStorage.getItem('portal_token');
    if (!token) { navigate('/portal/login', { replace: true }); return; }
    try {
      const s = JSON.parse(localStorage.getItem('portal_student') || 'null');
      setStudent(s);
      setPortalType(localStorage.getItem('portal_type') || 'PARENT');
    } catch { navigate('/portal/login', { replace: true }); }
  }, [navigate]);

  function logout() {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_student');
    localStorage.removeItem('portal_type');
    navigate('/portal/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col fixed h-screen z-30">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">EasyBooks</p>
            <p className="text-[10px] text-gray-400">{portalType === 'STUDENT' ? 'Student Portal' : 'Parent Portal'}</p>
          </div>
        </div>

        {/* Student card */}
        {student && (
          <div className="mx-3 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm mb-2">
              {student.name?.[0]?.toUpperCase() || 'S'}
            </div>
            <p className="text-sm font-semibold text-gray-900 leading-tight">{student.name}</p>
            {student.class && (
              <p className="text-xs text-emerald-700 mt-0.5">
                {student.class.name}{student.class.section ? ` (${student.class.section})` : ''}
              </p>
            )}
            {student.rollNumber && <p className="text-xs text-gray-400">Roll: {student.rollNumber}</p>}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/portal' && location.pathname.startsWith(item.path));
            return (
              <Link key={item.path} to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}>
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-gray-100">
          <button onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-60 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
