import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { AttendanceServiceImpl } from './attendance.service.impl';
import { PayrollServiceImpl } from './payroll.service.impl';

const PASS_PCT = 40;

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

const gradeOf = (p: number): string => {
  if (p >= 90) return 'A+';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B+';
  if (p >= 60) return 'B';
  if (p >= 50) return 'C+';
  if (p >= 40) return 'C';
  if (p >= 32) return 'D';
  return 'NG';
};

const classLabel = (c?: { name: string; section: string | null } | null) =>
  c ? `${c.name}${c.section ? ` (${c.section})` : ''}` : '—';

@Injectable()
export class SchoolAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceServiceImpl,
    private readonly payroll: PayrollServiceImpl,
  ) {}

  // ── Dashboard extras — merged into GET school/dashboard ─────────────────────

  async dashboardExtras(companyId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const trendStart = new Date(todayStart);
    trendStart.setDate(trendStart.getDate() - 29);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [trendRaw, classes, todayRaw, feeMonthsRaw, upcomingExams, upcomingEvents, homeworkDue] = await Promise.all([
      this.prisma.studentAttendance.groupBy({
        by: ['date', 'status'],
        where: { companyId, date: { gte: trendStart } },
        _count: true,
      }),
      this.prisma.schoolClass.findMany({
        where: { companyId },
        select: { id: true, name: true, section: true, _count: { select: { students: true } } },
      }),
      this.prisma.studentAttendance.groupBy({
        by: ['classId', 'status'],
        where: { companyId, date: { gte: todayStart } },
        _count: true,
      }),
      this.prisma.feeInvoice.groupBy({
        by: ['month'],
        where: { companyId },
        _sum: { totalAmount: true, paidAmount: true },
        _min: { createdAt: true },
      }),
      this.prisma.examSchedule.findMany({
        where: { companyId, examDate: { gte: todayStart, lte: weekEnd } },
        include: { class: { select: { name: true, section: true } }, subject: { select: { name: true } } },
        orderBy: { examDate: 'asc' },
        take: 10,
      }),
      this.prisma.schoolEvent.findMany({
        where: { companyId, startDate: { gte: todayStart, lte: weekEnd } },
        orderBy: { startDate: 'asc' },
        take: 10,
      }),
      this.prisma.homework.findMany({
        where: { companyId, dueDate: { gte: todayStart, lte: weekEnd } },
        include: { class: { select: { name: true, section: true } }, subject: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
    ]);

    // 30-day attendance trend
    const byDay = new Map<string, { present: number; absent: number }>();
    for (const r of trendRaw) {
      const key = new Date(r.date).toISOString().slice(0, 10);
      const day = byDay.get(key) ?? { present: 0, absent: 0 };
      if (r.status === 'ABSENT') day.absent += r._count;
      else if (r.status === 'PRESENT' || r.status === 'LATE') day.present += r._count;
      byDay.set(key, day);
    }
    const attendanceTrend = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, present: d.present, absent: d.absent, pct: pct(d.present, d.present + d.absent) }));

    // Today's attendance per class (unmarked classes reported with marked=0)
    const todayByClassMap = new Map<string, { present: number; marked: number }>();
    for (const r of todayRaw) {
      const c = todayByClassMap.get(r.classId) ?? { present: 0, marked: 0 };
      if (r.status !== 'EXCUSED') c.marked += r._count;
      if (r.status === 'PRESENT' || r.status === 'LATE') c.present += r._count;
      todayByClassMap.set(r.classId, c);
    }
    const todayByClass = classes.map(c => {
      const t = todayByClassMap.get(c.id) ?? { present: 0, marked: 0 };
      return {
        className: classLabel(c),
        totalStudents: c._count.students,
        present: t.present,
        marked: t.marked,
        pct: pct(t.present, t.marked),
      };
    });

    // Fee series by invoice month (BS month strings), last 6 chronologically
    const feeMonths = feeMonthsRaw
      .sort((a, b) => (a._min.createdAt?.getTime() ?? 0) - (b._min.createdAt?.getTime() ?? 0))
      .slice(-6)
      .map(m => {
        const invoiced = Number(m._sum.totalAmount ?? 0);
        const collected = Number(m._sum.paidAmount ?? 0);
        return { month: m.month, invoiced, collected, pending: invoiced - collected };
      });

    const weekAhead = {
      exams: upcomingExams.map(e => ({
        id: e.id, examName: e.examName, subject: e.subject?.name ?? null,
        className: classLabel(e.class), date: e.examDate, startTime: e.startTime,
      })),
      events: upcomingEvents.map(e => ({ id: e.id, title: e.title, eventType: e.eventType, date: e.startDate })),
      homework: homeworkDue.map(h => ({
        id: h.id, title: h.title, subject: h.subject?.name ?? null,
        className: classLabel(h.class), dueDate: h.dueDate,
      })),
    };

    return { attendanceTrend, todayByClass, feeMonths, weekAhead };
  }

  // ── Attendance report — month = "YYYY-MM" ────────────────────────────────────

  async attendanceReport(companyId: string, month?: string, startDate?: string, endDate?: string) {
    const now = new Date();
    const [y, m] = month ? month.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
    const start = startDate ? new Date(`${startDate}T00:00:00`) : new Date(y, m - 1, 1);
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : new Date(y, m, 1);

    const [byClassRaw, byStudentRaw, byDateRaw, classes] = await Promise.all([
      this.prisma.studentAttendance.groupBy({
        by: ['classId', 'status'],
        where: { companyId, date: { gte: start, lt: end } },
        _count: true,
      }),
      this.prisma.studentAttendance.groupBy({
        by: ['studentId', 'status'],
        where: { companyId, date: { gte: start, lt: end } },
        _count: true,
      }),
      this.prisma.studentAttendance.groupBy({
        by: ['date', 'status'],
        where: { companyId, date: { gte: start, lt: end } },
        _count: true,
      }),
      this.prisma.schoolClass.findMany({ where: { companyId }, select: { id: true, name: true, section: true } }),
    ]);

    const classById = new Map(classes.map(c => [c.id, classLabel(c)]));

    // Per-class %
    const classAgg = new Map<string, { present: number; marked: number }>();
    for (const r of byClassRaw) {
      const c = classAgg.get(r.classId) ?? { present: 0, marked: 0 };
      if (r.status !== 'EXCUSED') c.marked += r._count;
      if (r.status === 'PRESENT' || r.status === 'LATE') c.present += r._count;
      classAgg.set(r.classId, c);
    }
    const byClass = [...classAgg.entries()].map(([classId, v]) => ({
      className: classById.get(classId) ?? '—',
      present: v.present,
      marked: v.marked,
      pct: pct(v.present, v.marked),
    })).sort((a, b) => a.className.localeCompare(b.className));

    // Chronic absentees (<75%, at least 5 marked days)
    const studentAgg = new Map<string, { present: number; marked: number }>();
    for (const r of byStudentRaw) {
      const s = studentAgg.get(r.studentId) ?? { present: 0, marked: 0 };
      if (r.status !== 'EXCUSED') s.marked += r._count;
      if (r.status === 'PRESENT' || r.status === 'LATE') s.present += r._count;
      studentAgg.set(r.studentId, s);
    }
    const chronicIds = [...studentAgg.entries()]
      .filter(([, v]) => v.marked >= 5 && pct(v.present, v.marked) < 75)
      .sort((a, b) => pct(a[1].present, a[1].marked) - pct(b[1].present, b[1].marked))
      .slice(0, 30);
    const chronicStudents = await this.prisma.student.findMany({
      where: { id: { in: chronicIds.map(([id]) => id) } },
      select: { id: true, name: true, rollNumber: true, guardianName: true, guardianPhone: true, class: { select: { name: true, section: true } } },
    });
    const studentById = new Map(chronicStudents.map(s => [s.id, s]));
    const chronicAbsentees = chronicIds.map(([id, v]) => {
      const s = studentById.get(id);
      return {
        name: s?.name ?? '—',
        rollNumber: s?.rollNumber ?? null,
        className: classLabel(s?.class),
        guardianName: s?.guardianName ?? null,
        guardianPhone: s?.guardianPhone ?? null,
        presentDays: v.present,
        markedDays: v.marked,
        pct: pct(v.present, v.marked),
      };
    });

    // Day-of-week pattern (average % per weekday)
    const dowAgg = Array.from({ length: 7 }, () => ({ present: 0, marked: 0 }));
    for (const r of byDateRaw) {
      const dow = new Date(r.date).getDay();
      if (r.status !== 'EXCUSED') dowAgg[dow].marked += r._count;
      if (r.status === 'PRESENT' || r.status === 'LATE') dowAgg[dow].present += r._count;
    }
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeek = dowAgg.map((v, i) => ({ day: days[i], pct: pct(v.present, v.marked), marked: v.marked }));

    return { month: `${y}-${String(m).padStart(2, '0')}`, byClass, chronicAbsentees, dayOfWeek };
  }

  // ── Fees report ──────────────────────────────────────────────────────────────

  async feesReport(companyId: string, startDate?: string, endDate?: string) {
    const whereClause: any = { companyId };
    if (startDate || endDate) {
      whereClause.createdAt = {} as any;
      if (startDate) whereClause.createdAt.gte = new Date(`${startDate}T00:00:00`);
      if (endDate) whereClause.createdAt.lte = new Date(`${endDate}T23:59:59.999`);
    }

    const [monthsRaw, pendingInvoices] = await Promise.all([
      this.prisma.feeInvoice.groupBy({
        by: ['month'],
        where: whereClause,
        _sum: { totalAmount: true, paidAmount: true },
        _min: { createdAt: true },
      }),
      this.prisma.feeInvoice.findMany({
        where: { ...whereClause, status: { in: ['PENDING', 'PARTIAL'] } },
        select: {
          totalAmount: true, paidAmount: true, dueDate: true, createdAt: true, month: true,
          student: { select: { name: true, rollNumber: true, class: { select: { name: true, section: true } } } },
        },
      }),
    ]);

    const byMonth = monthsRaw
      .sort((a, b) => (a._min.createdAt?.getTime() ?? 0) - (b._min.createdAt?.getTime() ?? 0))
      .slice(-12)
      .map(m => {
        const invoiced = Number(m._sum.totalAmount ?? 0);
        const collected = Number(m._sum.paidAmount ?? 0);
        return { month: m.month, invoiced, collected, pending: invoiced - collected, rate: pct(collected, invoiced) };
      });

    // Outstanding by class
    const classAgg = new Map<string, number>();
    for (const inv of pendingInvoices) {
      const key = classLabel(inv.student?.class);
      classAgg.set(key, (classAgg.get(key) ?? 0) + (Number(inv.totalAmount) - Number(inv.paidAmount)));
    }
    const outstandingByClass = [...classAgg.entries()]
      .map(([className, due]) => ({ className, due: Math.round(due * 100) / 100 }))
      .sort((a, b) => b.due - a.due);

    // Aging buckets by days overdue (dueDate, falling back to createdAt)
    const now = Date.now();
    const buckets = [
      { label: '< 30 days', min: 0, max: 30 },
      { label: '30–60 days', min: 30, max: 60 },
      { label: '60–90 days', min: 60, max: 90 },
      { label: '90+ days', min: 90, max: Infinity },
    ].map(b => ({ ...b, total: 0, count: 0, top: [] as any[] }));

    for (const inv of pendingInvoices) {
      const ref = inv.dueDate ?? inv.createdAt;
      const daysOver = Math.max(0, Math.floor((now - new Date(ref).getTime()) / 86_400_000));
      const due = Number(inv.totalAmount) - Number(inv.paidAmount);
      const bucket = buckets.find(b => daysOver >= b.min && daysOver < b.max)!;
      bucket.total += due;
      bucket.count += 1;
      bucket.top.push({
        studentName: inv.student?.name ?? '—',
        className: classLabel(inv.student?.class),
        month: inv.month,
        due: Math.round(due * 100) / 100,
        daysOver,
      });
    }
    const aging = buckets.map(b => ({
      label: b.label,
      total: Math.round(b.total * 100) / 100,
      count: b.count,
      top: b.top.sort((x, y) => y.due - x.due).slice(0, 10),
    }));

    return { byMonth, outstandingByClass, aging };
  }

  // ── Academics report ─────────────────────────────────────────────────────────

  async academicsReport(companyId: string, examName?: string, startDate?: string, endDate?: string) {
    const whereClause: any = { companyId };
    if (startDate || endDate) {
      whereClause.createdAt = {} as any;
      if (startDate) whereClause.createdAt.gte = new Date(`${startDate}T00:00:00`);
      if (endDate) whereClause.createdAt.lte = new Date(`${endDate}T23:59:59.999`);
    }

    const examsRaw = await this.prisma.examResult.groupBy({
      by: ['examName'],
      where: whereClause,
      _min: { createdAt: true },
    });
    const examNames = examsRaw
      .sort((a, b) => (b._min.createdAt?.getTime() ?? 0) - (a._min.createdAt?.getTime() ?? 0))
      .map(e => e.examName);

    const selected = examName && examNames.includes(examName) ? examName : examNames[0];
    if (!selected) return { examNames: [], selected: null, subjectAverages: [], gradeDistribution: [], passRateByClass: [] };

    const results = await this.prisma.examResult.findMany({
      where: { ...whereClause, examName: selected },
      select: {
        marksObtained: true, totalMarks: true,
        subject: { select: { name: true } },
        student: { select: { class: { select: { name: true, section: true } } } },
      },
    });

    // Subject averages per class
    const subjAgg = new Map<string, { sum: number; count: number; className: string; subjectName: string }>();
    const gradeCounts = new Map<string, number>();
    const passAgg = new Map<string, { pass: number; total: number }>();

    for (const r of results) {
      const total = Number(r.totalMarks);
      if (total <= 0) continue;
      const p = (Number(r.marksObtained) / total) * 100;
      const className = classLabel(r.student?.class);
      const subjectName = r.subject?.name ?? 'General';

      const key = `${className}|${subjectName}`;
      const s = subjAgg.get(key) ?? { sum: 0, count: 0, className, subjectName };
      s.sum += p; s.count += 1;
      subjAgg.set(key, s);

      const g = gradeOf(p);
      gradeCounts.set(g, (gradeCounts.get(g) ?? 0) + 1);

      const pa = passAgg.get(className) ?? { pass: 0, total: 0 };
      pa.total += 1;
      if (p >= PASS_PCT) pa.pass += 1;
      passAgg.set(className, pa);
    }

    const subjectAverages = [...subjAgg.values()]
      .map(s => ({ className: s.className, subjectName: s.subjectName, avgPct: Math.round((s.sum / s.count) * 10) / 10, count: s.count }))
      .sort((a, b) => a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName));

    const GRADE_ORDER = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'NG'];
    const gradeDistribution = GRADE_ORDER.map(g => ({ grade: g, count: gradeCounts.get(g) ?? 0 }));

    const passRateByClass = [...passAgg.entries()]
      .map(([className, v]) => ({ className, passRate: pct(v.pass, v.total), results: v.total }))
      .sort((a, b) => a.className.localeCompare(b.className));

    return { examNames, selected, subjectAverages, gradeDistribution, passRateByClass };
  }

  // ── Operations report ────────────────────────────────────────────────────────

  async operationsReport(companyId: string, startDate?: string, endDate?: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let createdAtRange: { gte?: Date; lte?: Date } | undefined;
    if (startDate || endDate) {
      createdAtRange = {};
      if (startDate) createdAtRange.gte = new Date(`${startDate}T00:00:00`);
      if (endDate) createdAtRange.lte = new Date(`${endDate}T23:59:59.999`);
    }

    const [topBooksRaw, overdueIssues, fines, rooms, activeAllocations, routes, staffAttendance, payrollRaw] = await Promise.all([
      this.prisma.bookIssue.groupBy({ by: ['bookId'], where: { companyId }, _count: true, orderBy: { _count: { bookId: 'desc' } }, take: 10 }),
      this.prisma.bookIssue.count({ where: { companyId, status: 'ISSUED', dueDate: { lt: now } } }),
      this.prisma.bookIssue.aggregate({ where: { companyId }, _sum: { fine: true } }),
      this.prisma.hostelRoom.aggregate({ where: { companyId }, _sum: { capacity: true }, _count: true }),
      this.prisma.hostelAllocation.count({ where: { companyId, isActive: true } }),
      this.prisma.transportRoute.findMany({
        where: { companyId },
        select: { routeName: true, vehicleNumber: true, _count: { select: { studentTransports: { where: { isActive: true } } } } },
      }),
      this.attendance.getStatusBreakdown(companyId, monthStart),
      this.payroll.getMonthlyTotals(companyId, createdAtRange),
    ]);

    const books = await this.prisma.book.findMany({
      where: { id: { in: topBooksRaw.map(b => b.bookId) } },
      select: { id: true, title: true, author: true },
    });
    const bookById = new Map(books.map(b => [b.id, b]));
    const topBooks = topBooksRaw.map(b => ({
      title: bookById.get(b.bookId)?.title ?? '—',
      author: bookById.get(b.bookId)?.author ?? null,
      issues: b._count,
    }));

    const staffCounts = Object.fromEntries(staffAttendance.map(s => [s.status, s._count]));
    const staffPresent = (staffCounts['PRESENT'] ?? 0) + (staffCounts['HALF_DAY'] ?? 0) * 0.5;
    const staffMarked = staffAttendance.reduce((sum, s) => sum + (s.status === 'HOLIDAY' ? 0 : s._count), 0);

    const payrollByMonth = payrollRaw
      .sort((a, b) => (a._min.createdAt?.getTime() ?? 0) - (b._min.createdAt?.getTime() ?? 0))
      .slice(-6)
      .map(p => ({ month: p.month, total: Number(p._sum.netSalary ?? 0) }));

    return {
      library: {
        topBooks,
        overdueIssues,
        finesCollected: Number(fines._sum.fine ?? 0),
      },
      hostel: {
        rooms: rooms._count,
        capacity: Number(rooms._sum.capacity ?? 0),
        occupied: activeAllocations,
        occupancyPct: pct(activeAllocations, Number(rooms._sum.capacity ?? 0)),
      },
      transport: routes.map(r => ({ routeName: r.routeName, vehicleNumber: r.vehicleNumber, students: r._count.studentTransports })),
      staff: {
        attendancePct: pct(staffPresent, staffMarked),
        markedThisMonth: staffMarked,
      },
      payrollByMonth,
    };
  }
}
