import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { SmsService } from './sms.service';
import { AiService } from './ai.service';

// Forms send whole entity objects (with id/relations/_count) and bare "YYYY-MM-DD"
// strings; Prisma rejects unknown keys and date-only strings. Whitelist + coerce here
// so every create/update accepts what the UI actually sends.
const DATE_KEYS = new Set(['startDate', 'endDate', 'dueDate', 'examDate', 'dateOfBirth', 'admissionDate', 'expiresAt']);

function clean(data: any, allowed: string[], intKeys: string[] = []) {
  const out: any = {};
  for (const k of allowed) {
    if (data?.[k] === undefined) continue;
    let v = data[k];
    if (v === '') v = null;
    if (v !== null && DATE_KEYS.has(k)) v = new Date(v);
    if (v !== null && intKeys.includes(k)) v = parseInt(String(v), 10);
    out[k] = v;
  }
  return out;
}

@Injectable()
export class SchoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly ai: AiService,
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
      academicYearCount,
      subjectCount,
      teacherCount,
      feeStructureCount,
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
      this.prisma.academicYear.count({ where: { companyId } }),
      this.prisma.subject.count({ where: { companyId } }),
      this.prisma.employee.count({ where: { companyId, deletedAt: null } }),
      this.prisma.feeStructure.count({ where: { companyId } }),
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
      setup: {
        academicYears: academicYearCount,
        teachers: teacherCount,
        classes: totalClasses,
        subjects: subjectCount,
        students: totalStudents,
        feeStructures: feeStructureCount,
      },
    };
  }

  // ── Academic Years ────────────────────────────────────────────────────────────

  async listAcademicYears(companyId: string) {
    return this.prisma.academicYear.findMany({ where: { companyId }, orderBy: { startDate: 'desc' } });
  }

  async createAcademicYear(body: any) {
    const data = clean(body, ['companyId', 'name', 'startDate', 'endDate', 'isCurrent']);
    if (data.isCurrent) {
      await this.prisma.academicYear.updateMany({ where: { companyId: data.companyId }, data: { isCurrent: false } });
    }
    return this.prisma.academicYear.create({ data });
  }

  async updateAcademicYear(id: string, companyId: string, body: any) {
    const year = await this.prisma.academicYear.findFirst({ where: { id, companyId } });
    if (!year) throw new NotFoundException('Academic year not found');
    const data = clean(body, ['name', 'startDate', 'endDate', 'isCurrent']);
    if (data.isCurrent) {
      await this.prisma.academicYear.updateMany({ where: { companyId }, data: { isCurrent: false } });
    }
    return this.prisma.academicYear.update({ where: { id }, data });
  }

  async deleteAcademicYear(id: string, companyId: string) {
    const year = await this.prisma.academicYear.findFirst({ where: { id, companyId } });
    if (!year) throw new NotFoundException('Academic year not found');
    const attendance = await this.prisma.studentAttendance.count({ where: { academicYearId: id } });
    if (attendance > 0) throw new BadRequestException(`Cannot delete — ${attendance} attendance records are tagged to this year`);
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

  async createClass(body: any) {
    return this.prisma.schoolClass.create({
      data: clean(body, ['companyId', 'name', 'section', 'classTeacherId']),
    });
  }

  async updateClass(id: string, body: any) {
    const cls = await this.prisma.schoolClass.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Class not found');
    return this.prisma.schoolClass.update({
      where: { id },
      data: clean(body, ['name', 'section', 'classTeacherId']),
    });
  }

  async deleteClass(id: string, companyId: string) {
    const studentCount = await this.prisma.student.count({ where: { classId: id } });
    if (studentCount > 0) throw new BadRequestException(`Cannot delete — ${studentCount} students are enrolled in this class`);
    const blockers: string[] = [];
    const [attendance, timetable, homework, materials, examSchedules, feeStructures] = await Promise.all([
      this.prisma.studentAttendance.count({ where: { classId: id } }),
      this.prisma.timetableEntry.count({ where: { classId: id } }),
      this.prisma.homework.count({ where: { classId: id } }),
      this.prisma.studyMaterial.count({ where: { classId: id } }),
      this.prisma.examSchedule.count({ where: { classId: id } }),
      this.prisma.feeStructure.count({ where: { classId: id } }),
    ]);
    if (attendance) blockers.push(`${attendance} attendance records`);
    if (timetable) blockers.push(`${timetable} timetable entries`);
    if (homework) blockers.push(`${homework} homework assignments`);
    if (materials) blockers.push(`${materials} study materials`);
    if (examSchedules) blockers.push(`${examSchedules} exam schedules`);
    if (feeStructures) blockers.push(`${feeStructures} fee structures`);
    if (blockers.length) {
      throw new BadRequestException(`Cannot delete — this class has ${blockers.join(', ')}. Remove those first.`);
    }
    return this.prisma.schoolClass.delete({ where: { id } });
  }

  // ── Students ─────────────────────────────────────────────────────────────────

  async listStudents(
    companyId: string,
    opts?: { classId?: string; search?: string; status?: string; page?: number; pageSize?: number },
  ) {
    const { classId, search, status, page, pageSize } = opts || {};
    const where = {
      companyId,
      ...(classId ? { classId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { rollNumber: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const include = { class: { select: { name: true, section: true } } };

    // Search-as-you-type dropdowns — small capped result set, no count needed
    if (search && !page) {
      return this.prisma.student.findMany({ where, orderBy: [{ name: 'asc' }], take: 20, include });
    }

    // Paginated browse mode (Students admin table)
    if (page) {
      const take = Math.min(pageSize || 50, 200);
      const skip = (Math.max(page, 1) - 1) * take;
      const [data, total] = await Promise.all([
        this.prisma.student.findMany({ where, orderBy: [{ name: 'asc' }], skip, take, include }),
        this.prisma.student.count({ where }),
      ]);
      return { data, total, page, pageSize: take };
    }

    // Backward-compatible full list — only ever called scoped by class (attendance, promote dialog),
    // which is inherently bounded to one classroom's size
    return this.prisma.student.findMany({ where, orderBy: [{ name: 'asc' }], include });
  }

  async getStudent(id: string, companyId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, companyId },
      include: { class: { select: { name: true, section: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  private static readonly STUDENT_FIELDS = [
    'classId', 'name', 'rollNumber', 'examRollNumber', 'dateOfBirth', 'gender', 'address',
    'guardianName', 'guardianPhone', 'guardianEmail', 'admissionDate', 'status',
  ];

  async createStudent(body: any) {
    return this.prisma.student.create({
      data: clean(body, ['companyId', ...SchoolService.STUDENT_FIELDS]),
    });
  }

  async updateStudent(id: string, body: any) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');
    return this.prisma.student.update({
      where: { id },
      data: clean(body, SchoolService.STUDENT_FIELDS),
    });
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

  async listSubjects(companyId: string, classId?: string) {
    return this.prisma.subject.findMany({
      where: {
        companyId,
        ...(classId ? { OR: [{ classes: { none: {} } }, { classes: { some: { classId } } }] } : {}),
      },
      include: { classes: { include: { class: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createSubject(body: any) {
    const { classIds } = body;
    const data = clean(body, ['companyId', 'name', 'code', 'bookReference', 'chapters'], ['chapters']);
    return this.prisma.subject.create({
      data: { ...data, classes: classIds?.length ? { create: classIds.map((classId: string) => ({ classId })) } : undefined },
      include: { classes: { include: { class: true } } },
    });
  }

  async updateSubject(id: string, body: any) {
    const { classIds } = body;
    const data = clean(body, ['name', 'code', 'bookReference', 'chapters'], ['chapters']);
    return this.prisma.$transaction(async (tx) => {
      if (classIds !== undefined) {
        await tx.subjectClass.deleteMany({ where: { subjectId: id } });
        if (classIds.length) await tx.subjectClass.createMany({ data: classIds.map((classId: string) => ({ subjectId: id, classId })) });
      }
      return tx.subject.update({ where: { id }, data, include: { classes: { include: { class: true } } } });
    });
  }

  async deleteSubject(id: string, companyId: string) {
    const subject = await this.prisma.subject.findFirst({ where: { id, companyId } });
    if (!subject) throw new NotFoundException('Subject not found');
    const blockers: string[] = [];
    const [results, timetable, homework, materials, examSchedules] = await Promise.all([
      this.prisma.examResult.count({ where: { subjectId: id } }),
      this.prisma.timetableEntry.count({ where: { subjectId: id } }),
      this.prisma.homework.count({ where: { subjectId: id } }),
      this.prisma.studyMaterial.count({ where: { subjectId: id } }),
      this.prisma.examSchedule.count({ where: { subjectId: id } }),
    ]);
    if (results) blockers.push(`${results} exam results`);
    if (timetable) blockers.push(`${timetable} timetable entries`);
    if (homework) blockers.push(`${homework} homework assignments`);
    if (materials) blockers.push(`${materials} study materials`);
    if (examSchedules) blockers.push(`${examSchedules} exam schedules`);
    if (blockers.length) {
      throw new BadRequestException(`Cannot delete — "${subject.name}" is used by ${blockers.join(', ')}. Remove those first.`);
    }
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

    // Snapshot prior status so re-saving an unchanged day doesn't re-notify guardians
    const existing = await this.prisma.studentAttendance.findMany({
      where: { companyId, date: targetDate, studentId: { in: entries.map(e => e.studentId) } },
      select: { studentId: true, status: true },
    });
    const priorStatus = new Map(existing.map(r => [r.studentId, r.status]));

    const ops = entries.map(e =>
      this.prisma.studentAttendance.upsert({
        where: { studentId_date: { studentId: e.studentId, date: targetDate } },
        create: { companyId, studentId: e.studentId, classId, academicYearId, date: targetDate, status: e.status as any, notes: e.notes },
        update: { status: e.status as any, notes: e.notes },
      }),
    );
    await this.prisma.$transaction(ops);

    // Fire absent SMS alerts in the background (non-blocking), only for students
    // newly marked absent this save — avoids re-spamming guardians on resubmission.
    const absentEntries = entries.filter(e => e.status === 'ABSENT' && priorStatus.get(e.studentId) !== 'ABSENT');
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
      include: { student: { select: { name: true, guardianName: true, guardianPhone: true } }, company: { select: { name: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const student = invoice.student as any;
    const phone = student?.guardianPhone;
    if (!phone) throw new BadRequestException('No guardian phone on record');
    const amount = Number(invoice.totalAmount) - Number(invoice.paidAmount);

    // AI-composed message, falling back to the fixed template if Gemini is unavailable
    let aiMessage: string | undefined;
    try {
      const daysOverdue = invoice.dueDate
        ? Math.max(0, Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / 86_400_000))
        : 0;
      const res = await this.ai.generateFeeReminder(
        student?.name, student?.guardianName ?? 'Guardian', invoice.month, amount, daysOverdue,
      );
      aiMessage = res.message;
    } catch {
      // no GEMINI_API_KEY or AI error — template fallback below
    }

    const sent = aiMessage
      ? await this.sms.send(phone, aiMessage)
      : await this.sms.sendFeeReminder(student?.name, phone, amount, invoice.month, (invoice.company as any)?.name);
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
      where.date = { gte: new Date(Date.UTC(year, m - 1, 1)), lt: new Date(Date.UTC(year, m, 1)) };
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

  async createFeeStructure(body: any) {
    return this.prisma.feeStructure.create({
      data: clean(body, ['companyId', 'classId', 'feeHeadId', 'name', 'amount', 'frequency']),
    });
  }

  async updateFeeStructure(id: string, body: any) {
    return this.prisma.feeStructure.update({
      where: { id },
      data: clean(body, ['classId', 'feeHeadId', 'name', 'amount', 'frequency']),
    });
  }

  async deleteFeeStructure(id: string) {
    return this.prisma.feeStructure.delete({ where: { id } });
  }

  // ── Fee Invoices ──────────────────────────────────────────────────────────────

  async listFeeInvoices(
    companyId: string,
    status?: string,
    studentId?: string,
    page?: number,
    pageSize?: number,
    search?: string,
  ) {
    const where = {
      companyId,
      ...(status ? { status: status as any } : {}),
      ...(studentId ? { studentId } : {}),
      ...(search
        ? {
            student: {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { rollNumber: { contains: search, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    };
    const include = {
      items: { include: { feeHead: { select: { name: true } }, inventoryItem: { select: { itemName: true, unit: true } } } },
      payments: { orderBy: { paidAt: 'desc' as const } },
      student: { select: { name: true, rollNumber: true, class: { select: { name: true, section: true } } } },
    };

    if (page) {
      const take = Math.min(pageSize || 50, 200);
      const skip = (Math.max(page, 1) - 1) * take;
      const [data, total] = await Promise.all([
        this.prisma.feeInvoice.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip, take }),
        this.prisma.feeInvoice.count({ where }),
      ]);
      return { data, total, page, pageSize: take };
    }

    // Backward-compatible full list — kept for callers that filter by a single studentId
    // (inherently bounded to one student's invoice history)
    return this.prisma.feeInvoice.findMany({ where, include, orderBy: { createdAt: 'desc' } });
  }

  async createFeeInvoice(body: any) {
    const data = clean(body, ['companyId', 'studentId', 'month', 'description', 'paidAmount', 'discount', 'fine', 'dueDate', 'status', 'notes']);
    const rows: Array<{ description: string; amount: number; feeHeadId?: string | null; inventoryItemId?: string | null; quantity?: number | null }> =
      Array.isArray(body.items) && body.items.length
        ? body.items.map((it: any) => ({
            description: it.description || 'Fee',
            amount: Number(it.amount),
            feeHeadId: it.feeHeadId || null,
            inventoryItemId: it.inventoryItemId || null,
            quantity: it.quantity != null ? Number(it.quantity) : null,
          }))
        // Manual invoices with no items get a single line item so every invoice is itemized
        : [{ description: data.description || 'Fee', amount: Number(body.totalAmount), feeHeadId: body.feeHeadId || null }];

    const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);

    return this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        if (!row.inventoryItemId) continue;
        const qty = row.quantity ?? 0;
        if (qty <= 0) throw new BadRequestException('Quantity is required for inventory items');
        const item = await tx.inventoryItem.findFirst({ where: { id: row.inventoryItemId, companyId: data.companyId, deletedAt: null } });
        if (!item) throw new NotFoundException('Inventory item not found');
        const quantityBefore = Number(item.quantity);
        const quantityAfter = quantityBefore - qty;
        if (quantityAfter < 0) throw new BadRequestException(`Not enough stock for "${item.itemName}" — only ${quantityBefore} left`);
        await tx.inventoryItem.update({ where: { id: item.id }, data: { quantity: quantityAfter } });
        await tx.inventoryAdjustment.create({
          data: {
            companyId: data.companyId,
            inventoryItemId: item.id,
            adjustmentType: 'SUBTRACTION',
            quantityBefore,
            quantityChange: -qty,
            quantityAfter,
            reason: `Billed on fee invoice (${data.month || ''})`.trim(),
            dateAd: new Date(),
          },
        });
      }

      return tx.feeInvoice.create({
        data: { ...data, totalAmount, items: { create: rows } },
        include: { items: { include: { feeHead: { select: { name: true } }, inventoryItem: { select: { itemName: true, unit: true } } } } },
      });
    });
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

    const toCreate = students.filter(s => !existingIds.has(s.id));
    if (toCreate.length === 0) return { created: 0, skipped: existing.length };

    // Sequential creates so each invoice gets its line items
    for (const s of toCreate) {
      await this.prisma.feeInvoice.create({
        data: {
          companyId,
          studentId: s.id,
          month,
          description: structures.map(st => st.name).join(', '),
          totalAmount,
          paidAmount: 0,
          status: 'PENDING',
          items: {
            create: structures.map(st => ({
              feeHeadId: st.feeHeadId ?? null,
              description: st.name,
              amount: Number(st.amount),
            })),
          },
        },
      });
    }
    return { created: toCreate.length, skipped: existing.length };
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

  // ── Exams (tabs: "First Terminal", "Second Terminal", "Final"…) ────────────────
  // Exams are created independently of any result so a tab can exist before any
  // marks are entered against it — see createExam.

  async listExams(companyId: string) {
    return this.prisma.exam.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createExam(body: { companyId: string; name: string; examDate?: string; notes?: string }) {
    if (!body.name?.trim()) throw new BadRequestException('Exam name is required');
    return this.prisma.exam.create({
      data: {
        companyId: body.companyId,
        name: body.name.trim(),
        examDate: body.examDate ? new Date(body.examDate) : undefined,
        notes: body.notes || undefined,
      },
    });
  }

  async deleteExam(id: string, companyId: string) {
    const existing = await this.prisma.exam.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Exam not found');
    return this.prisma.exam.delete({ where: { id } });
  }

  private static readonly EXAM_RESULT_FIELDS = [
    'studentId', 'subjectId', 'examId', 'examName', 'marksObtained', 'totalMarks', 'grade', 'remarks', 'examDate',
  ];

  async createExamResult(body: any) {
    const data = clean(body, ['companyId', ...SchoolService.EXAM_RESULT_FIELDS]);
    if (data.examId) {
      const exam = await this.prisma.exam.findFirst({ where: { id: data.examId, companyId: data.companyId } });
      if (!exam) throw new NotFoundException('Exam not found');
      data.examName = exam.name;
    }
    return this.prisma.examResult.create({ data });
  }

  async updateExamResult(id: string, companyId: string, body: any) {
    const existing = await this.prisma.examResult.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Exam result not found');
    const data = clean(body, SchoolService.EXAM_RESULT_FIELDS);
    if (data.examId) {
      const exam = await this.prisma.exam.findFirst({ where: { id: data.examId, companyId } });
      if (!exam) throw new NotFoundException('Exam not found');
      data.examName = exam.name;
    }
    return this.prisma.examResult.update({ where: { id }, data });
  }

  async deleteExamResult(id: string, companyId: string) {
    const existing = await this.prisma.examResult.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Exam result not found');
    return this.prisma.examResult.delete({ where: { id } });
  }

  // ── Exam Schedules ────────────────────────────────────────────────────────────

  async listExamSchedules(companyId: string, classId?: string, examName?: string) {
    return this.prisma.examSchedule.findMany({
      where: {
        companyId,
        ...(classId ? { classId } : {}),
        ...(examName ? { examName } : {}),
      },
      orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }],
      include: {
        class: { select: { name: true, section: true } },
        subject: { select: { name: true, code: true } },
      },
    });
  }

  async createExamSchedule(data: {
    companyId: string;
    classId: string;
    subjectId?: string;
    examName: string;
    examDate: string;
    startTime?: string;
    endTime?: string;
    roomNumber?: string;
    notes?: string;
  }) {
    return this.prisma.examSchedule.create({
      data: { ...data, examDate: new Date(data.examDate) },
    });
  }

  // Creates one date-sheet in one go: a shared exam name/class plus a table of
  // per-subject rows (date, subject, time) — replaces adding each subject one at a time.
  async createExamSchedulesBulk(body: {
    companyId: string;
    classId: string;
    examName: string;
    rows: Array<{ subjectId?: string; examDate: string; startTime?: string; endTime?: string; roomNumber?: string }>;
  }) {
    if (!body.rows?.length) throw new BadRequestException('At least one subject row is required');
    const created = await this.prisma.$transaction(
      body.rows.map((row) =>
        this.prisma.examSchedule.create({
          data: {
            companyId: body.companyId,
            classId: body.classId,
            examName: body.examName,
            subjectId: row.subjectId || undefined,
            examDate: new Date(row.examDate),
            startTime: row.startTime || undefined,
            endTime: row.endTime || undefined,
            roomNumber: row.roomNumber || undefined,
          },
        }),
      ),
    );
    return { created: created.length };
  }

  async updateExamSchedule(id: string, companyId: string, body: any) {
    const existing = await this.prisma.examSchedule.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Exam schedule not found');
    return this.prisma.examSchedule.update({
      where: { id },
      data: clean(body, ['classId', 'subjectId', 'examName', 'examDate', 'startTime', 'endTime', 'roomNumber', 'notes']),
    });
  }

  async deleteExamSchedule(id: string, companyId: string) {
    const existing = await this.prisma.examSchedule.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Exam schedule not found');
    return this.prisma.examSchedule.delete({ where: { id } });
  }

  // ── Timetable ─────────────────────────────────────────────────────────────────

  async getTimetable(companyId: string, classId: string) {
    return this.prisma.timetableEntry.findMany({
      where: { companyId, classId },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
      include: { subject: { select: { name: true } } },
    });
  }

  async upsertTimetableEntry(body: any) {
    const data = clean(
      body,
      ['companyId', 'classId', 'subjectId', 'teacherId', 'dayOfWeek', 'periodNumber', 'startTime', 'endTime', 'roomNumber'],
      ['dayOfWeek', 'periodNumber'],
    );
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

  async createNotice(body: any) {
    const data = clean(body, ['companyId', 'title', 'content', 'targetAudience', 'isPublished', 'expiresAt']);
    return this.prisma.schoolNotice.create({ data: { ...data, publishedAt: new Date() } });
  }

  async updateNotice(id: string, companyId: string, body: any) {
    const notice = await this.prisma.schoolNotice.findFirst({ where: { id, companyId } });
    if (!notice) throw new NotFoundException('Notice not found');
    return this.prisma.schoolNotice.update({
      where: { id },
      data: clean(body, ['title', 'content', 'targetAudience', 'isPublished', 'expiresAt']),
    });
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

  async createEvent(body: any) {
    return this.prisma.schoolEvent.create({
      data: clean(body, ['companyId', 'title', 'description', 'startDate', 'endDate', 'eventType']),
    });
  }

  async updateEvent(id: string, companyId: string, body: any) {
    const event = await this.prisma.schoolEvent.findFirst({ where: { id, companyId } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.schoolEvent.update({
      where: { id },
      data: clean(body, ['title', 'description', 'startDate', 'endDate', 'eventType']),
    });
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

  async createStudyMaterial(body: any) {
    return this.prisma.studyMaterial.create({
      data: clean(body, ['companyId', 'title', 'fileUrl', 'fileType', 'classId', 'subjectId', 'description', 'uploadedBy']),
    });
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

  async createHomework(body: any) {
    return this.prisma.homework.create({
      data: clean(body, ['companyId', 'classId', 'subjectId', 'title', 'description', 'dueDate', 'fileUrl']),
    });
  }

  async updateHomework(id: string, companyId: string, body: any) {
    const hw = await this.prisma.homework.findFirst({ where: { id, companyId } });
    if (!hw) throw new NotFoundException('Homework not found');
    return this.prisma.homework.update({
      where: { id },
      data: clean(body, ['classId', 'subjectId', 'title', 'description', 'dueDate', 'fileUrl']),
    });
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

  async createBook(body: any) {
    const data = clean(body, ['companyId', 'title', 'author', 'isbn', 'category', 'totalCopies', 'availableCopies', 'shelfLocation'], ['totalCopies', 'availableCopies']);
    if (data.availableCopies == null) data.availableCopies = data.totalCopies ?? 1;
    return this.prisma.book.create({ data });
  }

  async updateBook(id: string, companyId: string, body: any) {
    const book = await this.prisma.book.findFirst({ where: { id, companyId } });
    if (!book) throw new NotFoundException('Book not found');
    return this.prisma.book.update({
      where: { id },
      data: clean(body, ['title', 'author', 'isbn', 'category', 'totalCopies', 'availableCopies', 'shelfLocation'], ['totalCopies', 'availableCopies']),
    });
  }

  async deleteBook(id: string, companyId: string) {
    const book = await this.prisma.book.findFirst({ where: { id, companyId } });
    if (!book) throw new NotFoundException('Book not found');
    const activeIssues = await this.prisma.bookIssue.count({ where: { bookId: id, status: 'ISSUED' } });
    if (activeIssues > 0) throw new BadRequestException('Cannot delete — book has active issues');
    // Returned-issue history would violate the FK — remove it along with the book
    const [, deleted] = await this.prisma.$transaction([
      this.prisma.bookIssue.deleteMany({ where: { bookId: id } }),
      this.prisma.book.delete({ where: { id } }),
    ]);
    return deleted;
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

  async issueBook(body: any) {
    const data = clean(body, ['companyId', 'bookId', 'studentId', 'memberName', 'dueDate']);
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

  async createHostelRoom(body: any) {
    return this.prisma.hostelRoom.create({
      data: clean(body, ['companyId', 'roomNumber', 'floor', 'capacity', 'monthlyFee', 'facilities'], ['capacity']),
    });
  }

  async updateHostelRoom(id: string, companyId: string, body: any) {
    const room = await this.prisma.hostelRoom.findFirst({ where: { id, companyId } });
    if (!room) throw new NotFoundException('Room not found');
    return this.prisma.hostelRoom.update({
      where: { id },
      data: clean(body, ['roomNumber', 'floor', 'capacity', 'monthlyFee', 'facilities'], ['capacity']),
    });
  }

  async deleteHostelRoom(id: string, companyId: string) {
    const room = await this.prisma.hostelRoom.findFirst({ where: { id, companyId } });
    if (!room) throw new NotFoundException('Room not found');
    const active = await this.prisma.hostelAllocation.count({ where: { roomId: id, isActive: true } });
    if (active > 0) throw new BadRequestException('Cannot delete — room has active residents');
    // Past (inactive) allocations would violate the FK — remove history with the room
    const [, deleted] = await this.prisma.$transaction([
      this.prisma.hostelAllocation.deleteMany({ where: { roomId: id } }),
      this.prisma.hostelRoom.delete({ where: { id } }),
    ]);
    return deleted;
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

  async allocateStudent(body: any) {
    const data = clean(body, ['companyId', 'roomId', 'studentId', 'startDate']);
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

  async createTransportRoute(body: any) {
    return this.prisma.transportRoute.create({
      data: clean(body, ['companyId', 'routeName', 'description', 'stops', 'monthlyFee', 'driverName', 'vehicleNumber']),
    });
  }

  async updateTransportRoute(id: string, companyId: string, body: any) {
    const route = await this.prisma.transportRoute.findFirst({ where: { id, companyId } });
    if (!route) throw new NotFoundException('Route not found');
    return this.prisma.transportRoute.update({
      where: { id },
      data: clean(body, ['routeName', 'description', 'stops', 'monthlyFee', 'driverName', 'vehicleNumber']),
    });
  }

  async deleteTransportRoute(id: string, companyId: string) {
    const route = await this.prisma.transportRoute.findFirst({ where: { id, companyId } });
    if (!route) throw new NotFoundException('Route not found');
    const active = await this.prisma.studentTransport.count({ where: { routeId: id, isActive: true } });
    if (active > 0) throw new BadRequestException('Cannot delete — route has active student assignments');
    // Past (inactive) assignments would violate the FK — remove history with the route
    const [, deleted] = await this.prisma.$transaction([
      this.prisma.studentTransport.deleteMany({ where: { routeId: id } }),
      this.prisma.transportRoute.delete({ where: { id } }),
    ]);
    return deleted;
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

  async assignStudentTransport(body: any) {
    const data = clean(body, ['companyId', 'routeId', 'studentId', 'pickupStop']);
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
