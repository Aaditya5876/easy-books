import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { SmsService } from './sms.service';

@Injectable()
export class SchoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

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

    // Fire absent SMS alerts in the background (non-blocking)
    const absentEntries = entries.filter(e => e.status === 'ABSENT');
    if (absentEntries.length > 0) {
      const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
      const students = await this.prisma.student.findMany({
        where: { id: { in: absentEntries.map(e => e.studentId) }, companyId },
        select: { id: true, name: true, guardianPhone: true },
      });
      const dateStr = new Date(date).toLocaleDateString('en-NP', { day: 'numeric', month: 'short', year: 'numeric' });
      for (const student of students) {
        if (student.guardianPhone) {
          this.sms.sendAbsentAlert(student.name, student.guardianPhone, dateStr, company?.name).catch(() => {});
        }
      }
    }

    return { saved: entries.length };
  }

  async sendFeeReminderSms(invoiceId: string, companyId: string): Promise<{ sent: boolean }> {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { student: { select: { name: true, guardianPhone: true } }, company: { select: { name: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const phone = (invoice.student as any)?.guardianPhone;
    if (!phone) throw new BadRequestException('No guardian phone on record');
    const amount = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    const sent = await this.sms.sendFeeReminder(
      (invoice.student as any)?.name,
      phone,
      amount,
      invoice.month,
      (invoice.company as any)?.name,
    );
    return { sent };
  }

  async broadcastNoticeSms(noticeId: string, companyId: string): Promise<{ sent: number; failed: number }> {
    const notice = await this.prisma.schoolNotice.findFirst({ where: { id: noticeId, companyId }, include: { company: { select: { name: true } } } });
    if (!notice) throw new NotFoundException('Notice not found');

    const students = await this.prisma.student.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: { guardianPhone: true },
    });
    const phones = [...new Set(students.map(s => s.guardianPhone).filter(Boolean))] as string[];
    return this.sms.sendNotice(phones, (notice as any).title, (notice.company as any)?.name);
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

  // ── Study Materials ───────────────────────────────────────────────────────────

  async listStudyMaterials(companyId: string, classId?: string, subjectId?: string) {
    return this.prisma.studyMaterial.findMany({
      where: { companyId, ...(classId ? { classId } : {}), ...(subjectId ? { subjectId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        class: { select: { name: true, section: true } },
        subject: { select: { name: true } },
      },
    });
  }

  async createStudyMaterial(data: { companyId: string; title: string; fileUrl: string; fileType?: string; classId?: string; subjectId?: string; description?: string; uploadedBy?: string }) {
    return this.prisma.studyMaterial.create({ data });
  }

  async deleteStudyMaterial(id: string, companyId: string) {
    const mat = await this.prisma.studyMaterial.findFirst({ where: { id, companyId } });
    if (!mat) throw new NotFoundException('Study material not found');
    return this.prisma.studyMaterial.delete({ where: { id } });
  }

  // ── Homework ──────────────────────────────────────────────────────────────────

  async listHomework(companyId: string, classId?: string, subjectId?: string) {
    return this.prisma.homework.findMany({
      where: { companyId, ...(classId ? { classId } : {}), ...(subjectId ? { subjectId } : {}) },
      orderBy: { dueDate: 'asc' },
      include: {
        class: { select: { name: true, section: true } },
        subject: { select: { name: true } },
      },
    });
  }

  async createHomework(data: { companyId: string; classId: string; title: string; dueDate: Date; subjectId?: string; description?: string; fileUrl?: string }) {
    return this.prisma.homework.create({ data });
  }

  async updateHomework(id: string, companyId: string, data: any) {
    const hw = await this.prisma.homework.findFirst({ where: { id, companyId } });
    if (!hw) throw new NotFoundException('Homework not found');
    return this.prisma.homework.update({ where: { id }, data });
  }

  async deleteHomework(id: string, companyId: string) {
    const hw = await this.prisma.homework.findFirst({ where: { id, companyId } });
    if (!hw) throw new NotFoundException('Homework not found');
    return this.prisma.homework.delete({ where: { id } });
  }

  // ── Library ───────────────────────────────────────────────────────────────────

  async listBooks(companyId: string) {
    return this.prisma.book.findMany({
      where: { companyId },
      orderBy: { title: 'asc' },
      include: { _count: { select: { bookIssues: true } } },
    });
  }

  async createBook(data: { companyId: string; title: string; author?: string; isbn?: string; category?: string; totalCopies?: number; availableCopies?: number; shelfLocation?: string }) {
    return this.prisma.book.create({ data });
  }

  async updateBook(id: string, companyId: string, data: any) {
    const book = await this.prisma.book.findFirst({ where: { id, companyId } });
    if (!book) throw new NotFoundException('Book not found');
    return this.prisma.book.update({ where: { id }, data });
  }

  async deleteBook(id: string, companyId: string) {
    const book = await this.prisma.book.findFirst({ where: { id, companyId } });
    if (!book) throw new NotFoundException('Book not found');
    const activeIssues = await this.prisma.bookIssue.count({ where: { bookId: id, status: 'ISSUED' } });
    if (activeIssues > 0) throw new BadRequestException('Cannot delete — book has active issues');
    return this.prisma.book.delete({ where: { id } });
  }

  async listIssues(companyId: string, status?: string) {
    return this.prisma.bookIssue.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      orderBy: { issueDate: 'desc' },
      include: {
        book: { select: { title: true, author: true } },
        student: { select: { name: true, rollNumber: true } },
      },
    });
  }

  async issueBook(data: { companyId: string; bookId: string; studentId?: string; memberName?: string; dueDate: Date }) {
    const book = await this.prisma.book.findFirst({ where: { id: data.bookId, companyId: data.companyId } });
    if (!book) throw new NotFoundException('Book not found');
    if (book.availableCopies < 1) throw new BadRequestException('No copies available');
    const [issue] = await this.prisma.$transaction([
      this.prisma.bookIssue.create({ data: { ...data, status: 'ISSUED', issueDate: new Date() } }),
      this.prisma.book.update({ where: { id: data.bookId }, data: { availableCopies: { decrement: 1 } } }),
    ]);
    return issue;
  }

  async returnBook(id: string, companyId: string, fine?: number) {
    const issue = await this.prisma.bookIssue.findFirst({ where: { id, companyId, status: 'ISSUED' } });
    if (!issue) throw new NotFoundException('Issue record not found or already returned');
    await this.prisma.$transaction([
      this.prisma.bookIssue.update({ where: { id }, data: { status: 'RETURNED', returnDate: new Date(), fine: fine ?? 0 } }),
      this.prisma.book.update({ where: { id: issue.bookId }, data: { availableCopies: { increment: 1 } } }),
    ]);
    return { returned: true };
  }

  // ── Hostel ────────────────────────────────────────────────────────────────────

  async listHostelRooms(companyId: string) {
    return this.prisma.hostelRoom.findMany({
      where: { companyId },
      orderBy: { roomNumber: 'asc' },
      include: { _count: { select: { allocations: { where: { isActive: true } } } } },
    });
  }

  async createHostelRoom(data: { companyId: string; roomNumber: string; floor?: string; capacity?: number; monthlyFee?: number; facilities?: string }) {
    return this.prisma.hostelRoom.create({ data });
  }

  async updateHostelRoom(id: string, companyId: string, data: any) {
    const room = await this.prisma.hostelRoom.findFirst({ where: { id, companyId } });
    if (!room) throw new NotFoundException('Room not found');
    return this.prisma.hostelRoom.update({ where: { id }, data });
  }

  async deleteHostelRoom(id: string, companyId: string) {
    const room = await this.prisma.hostelRoom.findFirst({ where: { id, companyId } });
    if (!room) throw new NotFoundException('Room not found');
    const active = await this.prisma.hostelAllocation.count({ where: { roomId: id, isActive: true } });
    if (active > 0) throw new BadRequestException('Cannot delete — room has active residents');
    return this.prisma.hostelRoom.delete({ where: { id } });
  }

  async listHostelAllocations(companyId: string, roomId?: string) {
    return this.prisma.hostelAllocation.findMany({
      where: { companyId, isActive: true, ...(roomId ? { roomId } : {}) },
      orderBy: { startDate: 'desc' },
      include: {
        room: { select: { roomNumber: true, floor: true } },
        student: { select: { name: true, rollNumber: true, class: { select: { name: true, section: true } } } },
      },
    });
  }

  async allocateStudent(data: { companyId: string; roomId: string; studentId: string; startDate?: Date }) {
    const room = await this.prisma.hostelRoom.findFirst({
      where: { id: data.roomId, companyId: data.companyId },
      include: { _count: { select: { allocations: { where: { isActive: true } } } } },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room._count.allocations >= room.capacity) throw new BadRequestException('Room is at full capacity');
    const existing = await this.prisma.hostelAllocation.findFirst({ where: { studentId: data.studentId, companyId: data.companyId, isActive: true } });
    if (existing) throw new BadRequestException('Student already has an active hostel allocation');
    return this.prisma.hostelAllocation.create({ data: { ...data, startDate: data.startDate ?? new Date() } });
  }

  async deallocateStudent(id: string, companyId: string) {
    const alloc = await this.prisma.hostelAllocation.findFirst({ where: { id, companyId } });
    if (!alloc) throw new NotFoundException('Allocation not found');
    return this.prisma.hostelAllocation.update({ where: { id }, data: { isActive: false, endDate: new Date() } });
  }

  // ── Transport ─────────────────────────────────────────────────────────────────

  async listTransportRoutes(companyId: string) {
    return this.prisma.transportRoute.findMany({
      where: { companyId },
      orderBy: { routeName: 'asc' },
      include: { _count: { select: { studentTransports: { where: { isActive: true } } } } },
    });
  }

  async createTransportRoute(data: { companyId: string; routeName: string; description?: string; stops?: string; monthlyFee?: number; driverName?: string; vehicleNumber?: string }) {
    return this.prisma.transportRoute.create({ data });
  }

  async updateTransportRoute(id: string, companyId: string, data: any) {
    const route = await this.prisma.transportRoute.findFirst({ where: { id, companyId } });
    if (!route) throw new NotFoundException('Route not found');
    return this.prisma.transportRoute.update({ where: { id }, data });
  }

  async deleteTransportRoute(id: string, companyId: string) {
    const route = await this.prisma.transportRoute.findFirst({ where: { id, companyId } });
    if (!route) throw new NotFoundException('Route not found');
    const active = await this.prisma.studentTransport.count({ where: { routeId: id, isActive: true } });
    if (active > 0) throw new BadRequestException('Cannot delete — route has active student assignments');
    return this.prisma.transportRoute.delete({ where: { id } });
  }

  async listTransportAssignments(companyId: string, routeId?: string) {
    return this.prisma.studentTransport.findMany({
      where: { companyId, isActive: true, ...(routeId ? { routeId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        route: { select: { routeName: true } },
        student: { select: { name: true, rollNumber: true, class: { select: { name: true, section: true } } } },
      },
    });
  }

  async assignStudentTransport(data: { companyId: string; routeId: string; studentId: string; pickupStop?: string }) {
    const existing = await this.prisma.studentTransport.findFirst({ where: { studentId: data.studentId, companyId: data.companyId, isActive: true } });
    if (existing) throw new BadRequestException('Student is already assigned to a transport route');
    return this.prisma.studentTransport.create({ data });
  }

  async removeStudentTransport(id: string, companyId: string) {
    const assignment = await this.prisma.studentTransport.findFirst({ where: { id, companyId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return this.prisma.studentTransport.update({ where: { id }, data: { isActive: false } });
  }
}
