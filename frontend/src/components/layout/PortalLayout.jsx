import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, CalendarCheck, DollarSign, Trophy,
  ClipboardList, Megaphone, Clock, LogOut, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const NAV = [
  { icon: LayoutDashboard, label: 'Home',       labelKey: 'portal.home',       path: '/portal',            color: '#3B82F6' },
  { icon: CalendarCheck,   label: 'Attendance', labelKey: 'portal.attendance', path: '/portal/attendance', color: '#10B981' },
  { icon: DollarSign,      label: 'Fees',       labelKey: 'portal.fees',       path: '/portal/fees',       color: '#F59E0B' },
  { icon: Trophy,          label: 'Results',    labelKey: 'portal.results',    path: '/portal/results',    color: '#8B5CF6' },
  { icon: ClipboardList,   label: 'Homework',   labelKey: 'portal.homework',   path: '/portal/homework',   color: '#F97316' },
  { icon: Megaphone,       label: 'Notices',    labelKey: 'portal.notices',    path: '/portal/notices',    color: '#F43F5E' },
  { icon: Clock,           label: 'Timetable',  labelKey: 'portal.timetable',  path: '/portal/timetable',  color: '#14B8A6' },
];

function isActive(item, pathname) {
  return item.path === '/portal'
    ? pathname === '/portal'
    : pathname.startsWith(item.path);
}

export default function PortalLayout() {
  const { t } = useTranslation();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [student, setStudent]     = useState(null);
  const [portalType, setPortalType] = useState('PARENT');

  useEffect(() => {
    const token = localStorage.getItem('portal_token');
    if (!token) { navigate('/portal/login', { replace: true }); return; }
    try {
      setStudent(JSON.parse(localStorage.getItem('portal_student') || 'null'));
      setPortalType(localStorage.getItem('portal_type') || 'PARENT');
    } catch { navigate('/portal/login', { replace: true }); }
  }, [navigate]);

  function logout() {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_student');
    localStorage.removeItem('portal_type');
    navigate('/portal/login', { replace: true });
  }

  const initials = student?.name?.[0]?.toUpperCase() || 'S';

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-64 bg-slate-900 flex-col fixed h-screen z-30">

        {/* Brand */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">EasyBooks</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {portalType === 'STUDENT'
                ? t('portal.studentPortal', { defaultValue: 'Student Portal' })
                : t('portal.parentPortal', { defaultValue: 'Parent Portal' })}
            </p>
          </div>
        </div>

        {/* Student card */}
        {student && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mx-4 mt-5 p-4 rounded-2xl bg-slate-800 border border-slate-700"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-tight">{student.name}</p>
                {student.class && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {student.class.name}{student.class.section ? ` · ${student.class.section}` : ''}
                  </p>
                )}
                {student.rollNumber && (
                  <p className="text-xs text-slate-500">{t('portal.roll', { defaultValue: 'Roll {{roll}}', roll: student.rollNumber })}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map((item, i) => {
            const Icon    = item.icon;
            const active  = isActive(item, location.pathname);
            return (
              <motion.div
                key={item.path}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.3 }}
              >
                <Link
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                    active ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  )}
                  style={active ? { background: `${item.color}22` } : {}}
                >
                  <Icon
                    className="w-4 h-4 shrink-0 transition-colors"
                    style={active ? { color: item.color } : {}}
                  />
                  <span>{t(item.labelKey, { defaultValue: item.label })}</span>
                  {active && (
                    <motion.div
                      layoutId="sidebar-indicator"
                      className="ml-auto w-1.5 h-1.5 rounded-full"
                      style={{ background: item.color }}
                    />
                  )}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t('portal.signOut', { defaultValue: 'Sign Out' })}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 md:ml-64 min-h-screen pb-20 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t border-gray-100 shadow-xl">
        <div className="flex items-stretch">
          {NAV.map(item => {
            const Icon   = item.icon;
            const active = isActive(item, location.pathname);
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative"
              >
                {active && (
                  <motion.div
                    layoutId="bottom-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                    style={{ background: item.color }}
                  />
                )}
                <Icon
                  className="w-5 h-5 transition-colors"
                  style={active ? { color: item.color } : { color: '#94A3B8' }}
                />
                <span
                  className="text-[9px] font-medium transition-colors leading-none"
                  style={active ? { color: item.color } : { color: '#94A3B8' }}
                >
                  {t(item.labelKey, { defaultValue: item.label })}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
