import { useEffect, useState } from 'react';
import { useOutlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, CalendarCheck, DollarSign, Trophy,
  ClipboardList, Megaphone, Clock, LogOut, BookOpen,
  FolderOpen, GraduationCap, CalendarDays, Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { portalApi } from '@/api';

const NAV = [
  { icon: LayoutDashboard, label: 'Home',           labelKey: 'portal.home',          path: '/portal',                 color: '#3B82F6' },
  { icon: CalendarCheck,   label: 'Attendance',     labelKey: 'portal.attendance',    path: '/portal/attendance',      color: '#10B981' },
  { icon: DollarSign,      label: 'Fees',           labelKey: 'portal.fees',          path: '/portal/fees',            color: '#F59E0B' },
  { icon: Trophy,          label: 'Results',        labelKey: 'portal.results',       path: '/portal/results',         color: '#8B5CF6' },
  { icon: GraduationCap,   label: 'Exam Schedule',  labelKey: 'portal.examSchedule',  path: '/portal/exam-schedule',   color: '#8B5CF6' },
  { icon: ClipboardList,   label: 'Homework',       labelKey: 'portal.homework',      path: '/portal/homework',        color: '#F97316' },
  { icon: FolderOpen,      label: 'Study Materials',labelKey: 'portal.studyMaterials',path: '/portal/study-materials', color: '#3B82F6' },
  { icon: Megaphone,       label: 'Notices',        labelKey: 'portal.notices',       path: '/portal/notices',         color: '#F43F5E' },
  { icon: CalendarDays,    label: 'Events',         labelKey: 'portal.schoolEvents',  path: '/portal/events',          color: '#F43F5E' },
  { icon: Clock,           label: 'Routine',        labelKey: 'portal.routine',       path: '/portal/timetable',       color: '#14B8A6' },
];

function isActive(item, pathname) {
  return item.path === '/portal'
    ? pathname === '/portal'
    : pathname.startsWith(item.path);
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationBell({ isMobile = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['portal-notifications-unread'],
    queryFn: () => portalApi.notificationsUnreadCount().then(r => r.data),
    // A notification usually comes from someone else's action (a teacher/admin
    // in another session) — this poll is the only way this tab finds out.
    // 60s felt sluggish during testing; 15s is still light for a school-sized
    // portal and reads as close to instant.
    refetchInterval: 15000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['portal-notifications'],
    queryFn: () => portalApi.notifications().then(r => r.data),
    enabled: open,
  });

  async function handleClick(n) {
    if (!n.isRead) {
      await portalApi.markNotificationRead(n.id);
      qc.invalidateQueries({ queryKey: ['portal-notifications-unread'] });
      qc.invalidateQueries({ queryKey: ['portal-notifications'] });
    }
    setOpen(false);
    if (n.link) {
      // navigate() is a no-op if already on that route (e.g. clicking a fee
      // notification while sitting on /portal/fees) — nothing would otherwise
      // remount the page or refetch its data, so the new invoice/receipt just
      // silently wouldn't appear until a manual refresh. Invalidate everything
      // portal-side on click so the destination page is always fresh.
      qc.invalidateQueries();
      navigate(n.link);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'relative flex items-center justify-center rounded-xl transition-colors',
          isMobile ? 'w-9 h-9 text-slate-600 hover:bg-slate-100' : 'w-9 h-9 text-slate-400 hover:text-white hover:bg-slate-800'
        )}
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={cn(
            'absolute z-50 mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl',
            isMobile ? 'right-0' : 'left-0'
          )}>
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">{t('portal.notifications', { defaultValue: 'Notifications' })}</p>
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">{t('portal.noNotificationsYet', { defaultValue: 'No notifications yet' })}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-2"
                  >
                    {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                    <div className={cn('min-w-0', n.isRead && 'ml-3.5')}>
                      <p className="text-sm font-medium text-slate-800 truncate">{n.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function PortalLayout() {
  const { t } = useTranslation();
  const navigate  = useNavigate();
  const location  = useLocation();
  const outlet    = useOutlet();
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('portal_token');
    if (!token) { navigate('/portal/login', { replace: true }); return; }
    setHasToken(true);
  }, [navigate]);

  // Live, not the localStorage snapshot cached at login — see PortalStudyMaterials.jsx.
  const { data: student } = useQuery({
    queryKey: ['portal-me'],
    queryFn: () => portalApi.me().then(r => r.data),
    enabled: hasToken,
  });

  function logout() {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_student');
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
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-none">OneBook</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {t('portal.studentPortal', { defaultValue: 'Student Portal' })}
            </p>
          </div>
          <NotificationBell />
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

      {/* ── Mobile top bar (sidebar is hidden on mobile — this is the only place for the bell) ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-white border-b border-slate-100 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
            <BookOpen className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-sm font-bold text-slate-900">OneBook</p>
        </div>
        <NotificationBell isMobile />
      </div>

      {/* ── Main ── */}
      <main className="flex-1 md:ml-64 min-h-screen pb-20 md:pb-0 pt-14 md:pt-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Mobile bottom nav (horizontally scrollable — too many sections to fit one screen width) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t border-gray-100 shadow-xl">
        <div className="flex items-stretch overflow-x-auto">
          {NAV.map(item => {
            const Icon   = item.icon;
            const active = isActive(item, location.pathname);
            return (
              <Link
                key={item.path}
                to={item.path}
                className="shrink-0 basis-[19%] min-w-[64px] flex flex-col items-center justify-center py-2 gap-0.5 relative"
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
