import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { animate } from 'framer-motion';
import { portalApi } from '@/api';
import { CalendarCheck, DollarSign, ClipboardList, AlertCircle, ChevronRight, Trophy, Megaphone, Clock, CalendarClock, PartyPopper } from 'lucide-react';
import { containerVariants, cardVariants, itemVariants } from '@/lib/portalAnimations';
import { useTranslation } from 'react-i18next';

function CountUp({ to, suffix = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const controls = animate(0, Number(to) || 0, {
      duration: 1.4,
      ease: 'easeOut',
      onUpdate(v) { if (ref.current) ref.current.textContent = Math.round(v) + suffix; },
    });
    return () => controls.stop();
  }, [to, suffix]);
  return <span ref={ref}>0{suffix}</span>;
}

const STAT_CARDS = [
  {
    key: 'attendance',
    label: 'Attendance',
    labelKey: 'portal.attendance',
    icon: CalendarCheck,
    color: '#10B981',
    bg: '#F0FDF4',
    link: '/portal/attendance',
  },
  {
    key: 'fees',
    label: 'Pending Fees',
    labelKey: 'portal.pendingFees',
    icon: DollarSign,
    color: '#F59E0B',
    bg: '#FFFBEB',
    link: '/portal/fees',
  },
  {
    key: 'homework',
    label: 'Overdue Tasks',
    labelKey: 'portal.overdueTasks',
    icon: ClipboardList,
    color: '#F43F5E',
    bg: '#FFF1F2',
    link: '/portal/homework',
  },
];

export default function PortalDashboard() {
  const { t } = useTranslation();
  const [student, setStudent] = useState(null);

  useEffect(() => {
    try { setStudent(JSON.parse(localStorage.getItem('portal_student') || 'null')); } catch {}
  }, []);

  const { data: attendance } = useQuery({
    queryKey: ['portal-attendance'],
    queryFn: () => portalApi.attendance().then(r => r.data),
  });

  const { data: fees = [] } = useQuery({
    queryKey: ['portal-fees'],
    queryFn: () => portalApi.fees().then(r => r.data),
  });

  const { data: homework = [] } = useQuery({
    queryKey: ['portal-homework'],
    queryFn: () => portalApi.homework(student?.classId).then(r => r.data),
    enabled: !!student?.classId,
  });

  const { data: results = [] } = useQuery({
    queryKey: ['portal-results'],
    queryFn: () => portalApi.results().then(r => r.data),
  });

  const { data: notices = [] } = useQuery({
    queryKey: ['portal-notices'],
    queryFn: () => portalApi.notices().then(r => r.data),
  });

  const { data: routine = [] } = useQuery({
    queryKey: ['portal-timetable', student?.classId],
    queryFn: () => portalApi.timetable(student?.classId).then(r => r.data),
    enabled: !!student?.classId,
  });

  const { data: examSchedule = [] } = useQuery({
    queryKey: ['portal-exam-schedule', student?.classId],
    queryFn: () => portalApi.examSchedule(student?.classId).then(r => r.data),
    enabled: !!student?.classId,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['portal-events'],
    queryFn: () => portalApi.events().then(r => r.data),
  });

  const pendingFees  = fees.filter(f => f.status === 'PENDING' || f.status === 'PARTIAL');
  const overdueHw    = homework.filter(h => new Date(h.dueDate) < new Date());
  const fmtAmt = (n) => `Rs. ${Number(n).toLocaleString('en-NP')}`;

  const now = new Date();
  const upcomingExams = examSchedule
    .filter(e => new Date(e.examDate) >= now)
    .sort((a, b) => new Date(a.examDate) - new Date(b.examDate))
    .slice(0, 4);
  const upcomingEvents = events
    .filter(e => new Date(e.startDate) >= now)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    .slice(0, 4);

  const latestExam = results.reduce((latest, r) => (
    !latest || new Date(r.examDate) > new Date(latest.examDate) ? r : latest
  ), null);
  const latestExamResults = latestExam ? results.filter(r => r.examName === latestExam.examName) : [];
  const latestObtained = latestExamResults.reduce((s, r) => s + Number(r.marksObtained), 0);
  const latestMax       = latestExamResults.reduce((s, r) => s + Number(r.totalMarks), 0);
  const latestPct        = latestMax > 0 ? (latestObtained / latestMax) * 100 : 0;

  const todayKey        = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const todaysRoutine    = routine
    .filter(e => e.dayOfWeek === todayKey)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const recentNotices   = notices.slice(0, 3);

  const statValues = {
    attendance: attendance?.summary?.percentage ?? 0,
    fees:       pendingFees.length,
    homework:   overdueHw.length,
  };
  const statSuffix = { attendance: '%', fees: '', homework: '' };

  const hour = new Date().getHours();
  const greeting = hour < 12
    ? t('portal.goodMorning', { defaultValue: 'Good morning' })
    : hour < 17
      ? t('portal.goodAfternoon', { defaultValue: 'Good afternoon' })
      : t('portal.goodEvening', { defaultValue: 'Good evening' });

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-7xl mx-auto">

      {/* Hero greeting banner */}
      <motion.div
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 px-6 py-7 md:px-8 md:py-8 shadow-lg shadow-blue-900/10"
      >
        <div className="absolute -right-10 -top-16 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-6 bottom-0 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {greeting}{student?.name ? `, ${student.name.split(' ')[0]}` : ''} 👋
          </h1>
          <p className="text-blue-100 text-sm mt-1.5">
            {student?.class
              ? `${student.class.name}${student.class.section ? ` · ${t('portal.section', { defaultValue: 'Section {{section}}', section: student.class.section })}` : ''}`
              : t('portal.academicOverview', { defaultValue: 'Your academic overview' })}
          </p>
        </div>
      </motion.div>

      {/* Stat cards */}
      <motion.div
        className="grid grid-cols-3 gap-3"
        variants={containerVariants}
        initial="initial"
        animate="animate"
      >
        {STAT_CARDS.map(card => {
          const Icon = card.icon;
          return (
            <motion.div key={card.key} variants={cardVariants}>
              <Link to={card.link}>
                <motion.div
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  className="rounded-2xl p-4 cursor-pointer border border-slate-100 shadow-sm hover:shadow-md transition-shadow bg-white"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${card.color}22, ${card.color}11)` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: card.color }} />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    <CountUp to={statValues[card.key]} suffix={statSuffix[card.key]} />
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">{t(card.labelKey, { defaultValue: card.label })}</p>
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Detail sections — two independent columns, each hugging its own content height.
          Deliberately NOT one CSS grid of siblings: a grid pairs items into rows by index
          and stretches the shorter cell to match its taller row-mate, which is exactly
          what left a big empty gap under a short card like "Latest Result" before. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <div className="space-y-5">

        {/* Pending fees */}
        {pendingFees.length > 0 && (
          <motion.div
            variants={cardVariants}
            initial="initial"
            animate="animate"
            className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden"
          >
            <div className="px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-semibold text-amber-900">{t('portal.pendingFeeInvoices', { defaultValue: 'Pending Fee Invoices' })}</h2>
              </div>
              <Link to="/portal/fees" className="text-xs text-amber-700 font-medium flex items-center gap-0.5 hover:text-amber-900">
                {t('portal.payNow', { defaultValue: 'Pay now' })} <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <motion.div
              className="divide-y divide-amber-100 bg-white/60"
              variants={containerVariants}
              initial="initial"
              animate="animate"
            >
              {pendingFees.slice(0, 4).map(f => (
                <motion.div key={f.id} variants={itemVariants} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{f.month}</p>
                    {f.description && <p className="text-xs text-slate-400">{f.description}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-700">
                      {fmtAmt(Number(f.totalAmount) - Number(f.paidAmount))}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {f.status === 'PARTIAL'
                        ? t('portal.partial', { defaultValue: 'Partial' })
                        : t('portal.pending', { defaultValue: 'Pending' })}
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* Today's routine */}
        {todaysRoutine.length > 0 && (
          <motion.div
            variants={cardVariants}
            initial="initial"
            animate="animate"
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
          >
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-500" />
                <h2 className="text-sm font-semibold text-slate-900">{t('portal.todaysRoutine', { defaultValue: "Today's Routine" })}</h2>
              </div>
              <Link to="/portal/timetable" className="text-xs text-slate-500 flex items-center gap-0.5 hover:text-slate-700">
                {t('portal.viewAll', { defaultValue: 'View all' })} <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <motion.div className="divide-y divide-slate-100" variants={containerVariants} initial="initial" animate="animate">
              {todaysRoutine.map(e => (
                <motion.div key={e.id} variants={itemVariants} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{e.subject?.name || e.subjectName || '—'}</p>
                    {e.teacherName && <p className="text-xs text-slate-400">{e.teacherName}</p>}
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full shrink-0 font-medium bg-teal-50 text-teal-700 tabular-nums">
                    {e.startTime} – {e.endTime}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* Upcoming homework */}
        {homework.length > 0 && (
          <motion.div
            variants={cardVariants}
            initial="initial"
            animate="animate"
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
          >
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-orange-500" />
                <h2 className="text-sm font-semibold text-slate-900">{t('portal.upcomingHomework', { defaultValue: 'Upcoming Homework' })}</h2>
              </div>
              <Link to="/portal/homework" className="text-xs text-slate-500 flex items-center gap-0.5 hover:text-slate-700">
                {t('portal.viewAll', { defaultValue: 'View all' })} <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <motion.div className="divide-y divide-slate-100" variants={containerVariants} initial="initial" animate="animate">
              {homework.slice(0, 5).map(h => {
                const overdue = new Date(h.dueDate) < new Date();
                return (
                  <motion.div key={h.id} variants={itemVariants} className="px-5 py-3 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{h.title}</p>
                      {h.subject && <p className="text-xs text-orange-600 font-medium mt-0.5">{h.subject.name}</p>}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 font-medium ${overdue ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                      {new Date(h.dueDate).toLocaleDateString('en-NP', { day: 'numeric', month: 'short' })}
                    </span>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        )}
        </div>

        <div className="space-y-5">
        {/* Upcoming exams */}
        {upcomingExams.length > 0 && (
          <motion.div
            variants={cardVariants}
            initial="initial"
            animate="animate"
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
          >
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-semibold text-slate-900">{t('portal.upcomingExams', { defaultValue: 'Upcoming Exams' })}</h2>
              </div>
            </div>
            <motion.div className="divide-y divide-slate-100" variants={containerVariants} initial="initial" animate="animate">
              {upcomingExams.map(e => (
                <motion.div key={e.id} variants={itemVariants} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{e.examName}</p>
                    {e.subject?.name && <p className="text-xs text-slate-400">{e.subject.name}</p>}
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full shrink-0 font-medium bg-indigo-50 text-indigo-700 tabular-nums">
                    {new Date(e.examDate).toLocaleDateString('en-NP', { day: 'numeric', month: 'short' })}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* Upcoming events */}
        {upcomingEvents.length > 0 && (
          <motion.div
            variants={cardVariants}
            initial="initial"
            animate="animate"
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
          >
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PartyPopper className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-slate-900">{t('portal.upcomingEvents', { defaultValue: 'Upcoming Events' })}</h2>
              </div>
            </div>
            <motion.div className="divide-y divide-slate-100" variants={containerVariants} initial="initial" animate="animate">
              {upcomingEvents.map(e => (
                <motion.div key={e.id} variants={itemVariants} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{e.title}</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full shrink-0 font-medium bg-amber-50 text-amber-700 tabular-nums">
                    {new Date(e.startDate).toLocaleDateString('en-NP', { day: 'numeric', month: 'short' })}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* Latest exam result */}
        {latestExam && (
          <motion.div
            variants={cardVariants}
            initial="initial"
            animate="animate"
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
          >
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-violet-500" />
                <h2 className="text-sm font-semibold text-slate-900">{t('portal.latestResult', { defaultValue: 'Latest Result' })}</h2>
              </div>
              <Link to="/portal/results" className="text-xs text-slate-500 flex items-center gap-0.5 hover:text-slate-700">
                {t('portal.viewAll', { defaultValue: 'View all' })} <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{latestExam.examName}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('portal.marksOf', { defaultValue: '{{obtained}} / {{total}} marks', obtained: latestObtained, total: latestMax })}
                </p>
              </div>
              <p className="text-2xl font-bold text-violet-600 tabular-nums">{latestPct.toFixed(0)}%</p>
            </div>
          </motion.div>
        )}

        {/* Recent notices */}
        {recentNotices.length > 0 && (
          <motion.div
            variants={cardVariants}
            initial="initial"
            animate="animate"
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
          >
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-rose-500" />
                <h2 className="text-sm font-semibold text-slate-900">{t('portal.recentNotices', { defaultValue: 'Recent Notices' })}</h2>
              </div>
              <Link to="/portal/notices" className="text-xs text-slate-500 flex items-center gap-0.5 hover:text-slate-700">
                {t('portal.viewAll', { defaultValue: 'View all' })} <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <motion.div className="divide-y divide-slate-100" variants={containerVariants} initial="initial" animate="animate">
              {recentNotices.map(n => (
                <motion.div key={n.id} variants={itemVariants} className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(n.publishedAt || n.createdAt).toLocaleDateString('en-NP', { day: 'numeric', month: 'short' })}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
        </div>
      </div>

      {/* All clear */}
      {pendingFees.length === 0 && homework.length === 0 && todaysRoutine.length === 0 && recentNotices.length === 0 && !latestExam && upcomingExams.length === 0 && upcomingEvents.length === 0 && attendance && (
        <motion.div
          variants={cardVariants}
          initial="initial"
          animate="animate"
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center"
        >
          <Trophy className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="font-semibold text-emerald-900">{t('portal.allCaughtUp', { defaultValue: 'All caught up!' })}</p>
          <p className="text-sm text-emerald-700 mt-1">{t('portal.noPendingItems', { defaultValue: 'No pending fees or overdue homework.' })}</p>
        </motion.div>
      )}
    </div>
  );
}
