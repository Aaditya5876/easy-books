import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';

@Injectable()
export class SchoolService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Dashboard ────────────────────────────────────────────────────────────────

  async getDashboardSummary(companyId: string) {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfYear = new Date(now.getFullYear(), 0, 1);

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      totalStudents,
      activeStudents,
      totalClasses,
      feeCollectedThisMonth,
      feeCollectedThisYear,
      pendingInvoices,
      presentToday,
      absentToday,
    ] = await Promise.all([
      this.prisma.student.count({ where: { companyId } }),
      this.prisma.student.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.schoolClass.count({ where: { companyId } }),
      this.prisma.feeInvoice.aggregate({
        where: { companyId, createdAt: { gte: firstOfMonth } },
        _sum: { paidAmount: true },
      }),
      this.prisma.feeInvoice.aggregate({
        where: { companyId, createdAt: { gte: firstOfYear } },
        _sum: { paidAmount: true },
      }),
      this.prisma.feeInvoice.findMany({
        where: { companyId, status: { in: ['PENDING', 'PARTIAL'] } },
        include: { student: { select: { name: true, class: { select: { name: true, section: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.studentAttendance.count({ where: { companyId, date: { gte: todayStart, lt: todayEnd }, status: 'PRESENT' } }),
      this.prisma.studentAttendance.count({ where: { companyId, date: { gte: todayStart, lt: todayEnd }, status: 'ABSENT' } }),
    ]);

    const totalPendingFees = pendingInvoices.reduce(
      (sum, inv) => sum + (Number(inv.totalAmount) - Number(inv.paidAmount)),
      0,
    );

    const studentsWithDues = new Set(pendingInvoices.map(inv => inv.studentId)).size;

    const pendingFeesList = pendingInvoices.map(inv => ({
      id: inv.id,
      studentName: inv.student?.name,
      className: inv.student?.class
        ? `${inv.student.class.name}${inv.student.class.section ? ` (${inv.student.class.section})` : ''}`
        : '—',
      dueAmount: Number(inv.totalAmount) - Number(inv.paidAmount),
      month: inv.month,
    }));

    return {
      totalStudents,
      activeStudents,
      totalClasses,
      feeCollectedThisMonth: Number(feeCollectedThisMonth._sum.paidAmount ?? 0),
      feeCollectedThisYear: Number(feeCollectedThisYear._sum.paidAmount ?? 0),
      totalPendingFees,
      studentsWithDues,
      attendanceToday: { present: presentToday, absent: absentToday },
      pendingFeesList,
    };
  }

  // ── Academic Years ────────────────────────────────────────────────────────────

  async listAcademicYears(companyId: string) {
    return this.prisma.academicYear.findMany({ where: { companyId }, orderBy: { startDate: 'desc' } });
  }

  async createAcademicYear(data: { companyId: string; name: string; startDate: Date; endDate: Date; isCurrent?: boolean }) {
    if (data.isCurrent) {
      await this.prisma.academicYear.updateMany({ where: { companyId: data.companyId }, data: { isCurrent: false } });
    }
    return this.prisma.academicYear.create({ data });
  }

  async updateAcademicYear(id: string, companyId: string, data: { name?: string; startDate?: Date; endDate?: Date; isCurrent?: boolean }) {
    const year = await this.prisma.academicYear.findFirst({ where: { id, companyId } });
    if (!year) throw new NotFoundException('Academic year not found');
    if (data.isCurrent) {
      await this.prisma.academicYear.updateMany({ where: { companyId }, data: { isCurrent: false } });
    }
    return this.prisma.academicYear.update({ where: { id }, data });
  }

  async deleteAcademicYear(id: string, companyId: string) {
    const year = await this.prisma.academicYear.findFirst({ where: { id, companyId } });
    if (!year) throw new NotFoundException('Academic year not found');
    return this.prisma.academicYear.delete({ where: { id } });
  }

  // ── Classes ──────────────────────────────────────────────────────────────────

  async listClasses(companyId: string) {
    return this.prisma.schoolClass.findMany({
      where: { companyId },
      orderBy: [{ name: 'asc' }, { section: 'asc' }],
      include: { _count: { select: { students: true } } },
    });
  }

  async createClass(data: { companyId: string; name: string; section?: string; classTeacherId?: string }) {
    return this.prisma.schoolClass.create({ data });
  }

  async updateClass(id: string, data: { name?: string; section?: string; classTeacherId?: string }) {
    const cls = await this.prisma.schoolClass.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Class not found');
    return this.prisma.schoolClass.update({ where: { id }, data });
  }

  async deleteClass(id: string, companyId: string) {
    const studentCount = await this.prisma.student.count({ where: { classId: id } });
    if (studentCount > 0) throw new BadRequestException(`Cannot delete — ${studentCount} students are enrolled in this class`);
    return this.prisma.schoolClass.delete({ where: { id } });
  }

  // ── Students ─────────────────────────────────────────────────────────────────

  async listStudents(companyId: string, classId?: string) {
    return this.prisma.student.findMany({
      where: { companyId, ...(classId ? { classId } : {}) },
      orderBy: [{ name: 'asc' }],
      include: { class: { select: { name: true, section: true } } },
    });
  }

  async getStudent(id: string, companyId: string) {
    const student = await this.prisma.student.findFirst({ where: { id, companyId } });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async createStudent(data: any) {
    return this.prisma.student.create({ data });
  }

  async updateStudent(id: string, data: any) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');
    return this.prisma.student.update({ where: { id }, data });
  }

  async deleteStudent(id: string, companyId: string) {
    const student = await this.prisma.student.findFirst({ where: { id, companyId } });
    if (!student) throw new NotFoundException('Student not found');
    return this.prisma.student.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  async promoteStudents(companyId: string, fromClassId: string, toClassId: string, studentIds: string[]) {
    const toClass = await this.prisma.schoolClass.findFirst({ where: { id: toClassId, companyId } });
    if (!toClass) throw new NotFoundException('Target class not found');
    await this.prisma.student.updateMany({
      where: { id: { in: studentIds }, classId: fromClassId, companyId },
      data: { classId: toClassId },
    });
    return { promoted: studentIds.length };
  }

  // ── Subjects ─────────────────────────────────────────────────────────────────

  async listSubjects(companyId: string) {
    return this.prisma.subject.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }

  async createSubject(data: { companyId: string; name: string; code?: string }) {
    return this.prisma.subject.create({ data });
  }

  async updateSubject(id: string, data: { name?: string; code?: string }) {
    return this.prisma.subject.update({ where: { id }, data });
  }

  async deleteSubject(id: string, companyId: string) {
    return this.prisma.subject.delete({ where: { id } });
  }

  // ── Student Attendance ────────────────────────────────────────────────────────

  async getAttendanceByDate(companyId: string, classId: string, date: string) {
    const students = await this.prisma.student.findMany({
      where: { companyId, classId, status: 'ACTIVE' },
      orderBy: [{ rollNumber: 'asc' }, { name: 'asc' }],
    });

    const targetDate = new Date(date);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const records = await this.prisma.studentAttendance.findMany({
      where: { companyId, classId, date: { gte: targetDate, lt: nextDate } },
    });

    const recordMap = new Map(records.map(r => [r.studentId, r]));

    return students.map(s => ({
      studentId: s.id,
      studentName: s.name,
      rollNumber: s.rollNumber,
      record: recordMap.get(s.id) ?? null,
      status: recordMap.get(s.id)?.status ?? 'PRESENT',
    }));
  }

  async saveAttendance(companyId: string, classId: string, date: string, academicYearId: string | undefined, entries: Array<{ studentId: string; status: string; notes?: string }>) {
    const targetDate = new Date(date);
    const ops = entries.map(e =>
      this.prisma.studentAttendance.upsert({
        where: { studentId_date: { studentId: e.studentId, date: targetDate } },
        create: { companyId, studentId: e.studentId, classId, academicYearId, date: targetDate, status: e.status as any, notes: e.notes },
        update: { status: e.status as any, notes: e.notes },
      }),
    );
    await this.prisma.$transaction(ops);
    return { saved: entries.length };
  }

  async getAttendanceSummary(companyId: string, studentId: string, month?: string) {
    const where: any = { companyId, studentId };
    if (month) {
      const [year, m] = month.split('-').map(Number);
      where.date = { gte: new Date(year, m - 1, 1), lt: new Date(year, m, 1) };
    }
    const records = await this.prisma.studentAttendance.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });
    return records.reduce((acc, r) => ({ ...acc, [r.status]: r._count.status }), {});
  }

  async getClassAttendanceReport(companyId: string, classId: string, startDate: string, endDate: string) {
    const students = await this.prisma.student.findMany({
      where: { companyId, classId, status: 'ACTIVE' },
      orderBy: [{ rollNumber: 'asc' }, { name: 'asc' }],
    });

    const records = await this.prisma.studentAttendance.findMany({
      where: {
        companyId,
        classId,
        date: { gte: new Date(startDate), lte: new Date(endDate) },
      },
    });

    const byStudent = new Map<string, { present: number; absent: number; late: number; excused: number }>();
    for (const r of records) {
      const cur = byStudent.get(r.studentId) ?? { present: 0, absent: 0, late: 0, excused: 0 };
      if (r.status === 'PRESENT') cur.present++;
      else if (r.status === 'ABSENT') cur.absent++;
      else if (r.status === 'LATE') cur.late++;
      else if (r.status === 'EXCUSED') cur.excused++;
      byStudent.set(r.studentId, cur);
    }

    return students.map(s => ({
      studentId: s.id,
      name: s.name,
      rollNumber: s.rollNumber,
      ...(byStudent.get(s.id) ?? { present: 0, absent: 0, late: 0, excused: 0 }),
    }));
  }

  // ── Fee Structures ────────────────────────────────────────────────────────────

  async listFeeStructures(companyId: string, classId?: string) {
    return this.prisma.feeStructure.findMany({
      where: { companyId, ...(classId ? { classId } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  async createFeeStructure(data: any) {
    return this.prisma.feeStructure.create({ data });
  }

  async updateFeeStructure(id: string, data: any) {
    return this.prisma.feeStructure.update({ where: { id }, data });
  }

  async deleteFeeStructure(id: string) {
    return this.prisma.feeStructure.delete({ where: { id } });
  }

  // ── Fee Invoices ──────────────────────────────────────────────────────────────

  async listFeeInvoices(companyId: string, status?: string, studentId?: string) {
    return this.prisma.feeInvoice.findMany({
      where: {
        companyId,
        ...(status ? { status: status as any } : {}),
        ...(studentId ? { studentId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { name: true, rollNumber: true, class: { select: { name: true, section: true } } } },
      },
    });
  }

  async createFeeInvoice(data: any) {
    return this.prisma.feeInvoice.create({ data });
  }

  async generateBulkInvoices(companyId: string, classId: string, month: string, feeStructureIds: string[]) {
    const students = await this.prisma.student.findMany({
      where: { companyId, classId, status: 'ACTIVE' },
    });
    const structures = await this.prisma.feeStructure.findMany({
      where: { id: { in: feeStructureIds } },
    });
    const totalAmount = structures.reduce((sum, s) => sum + Number(s.amount), 0);

    const existing = await this.prisma.feeInvoice.findMany({
      where: { companyId, studentId: { in: students.map(s => s.id) }, month },
      select: { studentId: true },
    });
    const existingIds = new Set(existing.map(e => e.studentId));

    const toCreate = students
      .filter(s => !existingIds.has(s.id))
      .map(s => ({
        companyId,
        studentId: s.id,
        month,
        description: structures.map(s => s.name).join(', '),
        totalAmount,
        paidAmount: 0,
        status: 'PENDING' as const,
      }));

    if (toCreate.length === 0) return { created: 0, skipped: existing.length };

    await this.prisma.feeInvoice.createMany({ data: toCreate });
    return { created: toCreate.length, skipped: existing.length };
  }

  async recordPayment(id: string, amount: number, notes?: string) {
    const invoice = await this.prisma.feeInvoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const newPaid = Number(invoice.paidAmount) + amount;
    const total = Number(invoice.totalAmount);
    if (newPaid > total) throw new BadRequestException('Payment exceeds total amount');
    const status = newPaid >= total ? 'PAID' : 'PARTIAL';
    return this.prisma.feeInvoice.update({
      where: { id },
      data: { paidAmount: newPaid, status, paidDate: status === 'PAID' ? new Date() : undefined, notes },
    });
  }

  async getFeeReceipt(id: string, companyId: string) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id, companyId },
      include: {
        student: {
          include: { class: { select: { name: true, section: true } } },
        },
        company: { select: { name: true, address: true, phone: true, email: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  // ── Exam Results ──────────────────────────────────────────────────────────────

  async listExamResults(companyId: string, examName?: string, studentId?: string) {
    return this.prisma.examResult.findMany({
      where: {
        companyId,
        ...(examName ? { examName } : {}),
        ...(studentId ? { studentId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { name: true, rollNumber: true, class: { select: { name: true, section: true } } } },
        subject: { select: { name: true } },
      },
    });
  }

  async getReportCard(studentId: string, companyId: string, examName: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, companyId },
      include: { class: { select: { name: true, section: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');

    const results = await this.prisma.examResult.findMany({
      where: { studentId, companyId, examName },
      include: { subject: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, address: true, phone: true, logoUrl: true },
    });

    const totalObtained = results.reduce((s, r) => s + Number(r.marksObtained), 0);
    const totalMax = results.reduce((s, r) => s + Number(r.totalMarks), 0);
    const percentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : '0';

    return { student, results, company, examName, totalObtained, totalMax, percentage };
  }

  async createExamResult(data: any) {
    return this.prisma.examResult.create({ data });
  }

  async updateExamResult(id: string, data: any) {
    return this.prisma.examResult.update({ where: { id }, data });
  }

  async deleteExamResult(id: string) {
    return this.prisma.examResult.delete({ where: { id } });
  }

  // ── Timetable ─────────────────────────────────────────────────────────────────

  async getTimetable(companyId: string, classId: string) {
    return this.prisma.timetableEntry.findMany({
      where: { companyId, classId },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
      include: { subject: { select: { name: true } } },
    });
  }

  async upsertTimetableEntry(data: {
    companyId: string;
    classId: string;
    subjectId?: string;
    teacherId?: string;
    dayOfWeek: number;
    periodNumber: number;
    startTime: string;
    endTime: string;
    roomNumber?: string;
  }) {
    return this.prisma.timetableEntry.upsert({
      where: { classId_dayOfWeek_periodNumber: { classId: data.classId, dayOfWeek: data.dayOfWeek, periodNumber: data.periodNumber } },
      create: data,
      update: { subjectId: data.subjectId, teacherId: data.teacherId, startTime: data.startTime, endTime: data.endTime, roomNumber: data.roomNumber },
    });
  }

  async deleteTimetableEntry(id: string, companyId: string) {
    return this.prisma.timetableEntry.deleteMany({ where: { id, companyId } });
  }

  // ── Notices ───────────────────────────────────────────────────────────────────

  async listNotices(companyId: string) {
    return this.prisma.schoolNotice.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createNotice(data: { companyId: string; title: string; content: string; targetAudience?: string; expiresAt?: Date }) {
    return this.prisma.schoolNotice.create({ data: { ...data, publishedAt: new Date() } });
  }

  async updateNotice(id: string, companyId: string, data: { title?: string; content?: string; targetAudience?: string; isPublished?: boolean; expiresAt?: Date }) {
    const notice = await this.prisma.schoolNotice.findFirst({ where: { id, companyId } });
    if (!notice) throw new NotFoundException('Notice not found');
    return this.prisma.schoolNotice.update({ where: { id }, data });
  }

  async deleteNotice(id: string, companyId: string) {
    const notice = await this.prisma.schoolNotice.findFirst({ where: { id, companyId } });
    if (!notice) throw new NotFoundException('Notice not found');
    return this.prisma.schoolNotice.delete({ where: { id } });
  }

  // ── Events ────────────────────────────────────────────────────────────────────

  async listEvents(companyId: string, month?: string) {
    const where: any = { companyId };
    if (month) {
      const [year, m] = month.split('-').map(Number);
      where.startDate = { gte: new Date(year, m - 1, 1), lt: new Date(year, m, 1) };
    }
    return this.prisma.schoolEvent.findMany({ where, orderBy: { startDate: 'asc' } });
  }

  async createEvent(data: { companyId: string; title: string; description?: string; startDate: Date; endDate?: Date; eventType?: string }) {
    return this.prisma.schoolEvent.create({ data: data as any });
  }

  async updateEvent(id: string, companyId: string, data: any) {
    const event = await this.prisma.schoolEvent.findFirst({ where: { id, companyId } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.schoolEvent.update({ where: { id }, data });
  }

  async deleteEvent(id: string, companyId: string) {
    return this.prisma.schoolEvent.deleteMany({ where: { id, companyId } });
  }
}
