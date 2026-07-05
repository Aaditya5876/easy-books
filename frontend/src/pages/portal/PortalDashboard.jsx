import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { animate } from 'framer-motion';
import { portalApi } from '@/api';
import { CalendarCheck, DollarSign, ClipboardList, AlertCircle, ChevronRight, Trophy } from 'lucide-react';
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

  const pendingFees  = fees.filter(f => f.status === 'PENDING' || f.status === 'PARTIAL');
  const overdueHw    = homework.filter(h => new Date(h.dueDate) < new Date());
  const fmtAmt = (n) => `Rs. ${Number(n).toLocaleString('en-NP')}`;

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
    <div className="p-5 md:p-7 space-y-6 max-w-2xl">

      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
          {greeting}{student?.name ? `, ${student.name.split(' ')[0]}` : ''} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {student?.class
            ? `${student.class.name}${student.class.section ? ` · ${t('portal.section', { defaultValue: 'Section {{section}}', section: student.class.section })}` : ''}`
            : t('portal.academicOverview', { defaultValue: 'Your academic overview' })}
        </p>
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
                  whileTap={{ scale: 0.96 }}
                  className="rounded-2xl p-4 cursor-pointer border border-white shadow-sm"
                  style={{ background: card.bg }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: card.color + '22' }}
                  >
                    <Icon className="w-4.5 h-4.5" style={{ color: card.color }} />
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

      {/* All clear */}
      {pendingFees.length === 0 && homework.length === 0 && attendance && (
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
