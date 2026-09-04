import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { SchoolFinanceService } from './school-finance.service';
import { SmsService } from './sms.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly finance: SchoolFinanceService,
    private readonly sms: SmsService,
  ) {}

  private signPortalToken(portalUser: { studentId: string; companyId: string; mustChangePassword: boolean }, classId?: string | null) {
    return this.jwtService.sign(
      {
        studentId: portalUser.studentId,
        companyId: portalUser.companyId,
        classId,
        type: 'portal',
        mustChangePassword: portalUser.mustChangePassword,
      },
      { secret: process.env.JWT_SECRET, expiresIn: '30d' },
    );
  }

  // No school ID needed from the user: phone numbers aren't guaranteed unique
  // across schools (this is a multi-tenant DB), so we look up every active
  // portal_users row for the phone and let the password itself disambiguate —
  // bcrypt hashes are salted per-record, so a plaintext password only ever
  // matches its own account's hash.
  async login(phone: string, password: string) {
    const candidates = await this.prisma.portalUser.findMany({
      where: { phone, isActive: true },
      include: { student: { include: { class: true } } },
    });
    for (const portalUser of candidates) {
      if (await bcrypt.compare(password, portalUser.passwordHash)) {
        const token = this.signPortalToken(portalUser, portalUser.student?.classId);
        return { token, student: portalUser.student, mustChangePassword: portalUser.mustChangePassword };
      }
    }
    throw new UnauthorizedException('Invalid phone number or password');
  }

  // Admin-chosen password — the admin knows it, so it's a temporary credential
  // the parent/student must replace via /portal/change-password on first login.
  async setPortalPassword(studentId: string, phone: string, password: string, companyId: string) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, companyId } });
    if (!student) throw new NotFoundException('Student not found');
    if (!phone || !password) throw new BadRequestException('Phone and password are required');
    if (password.length < 6) throw new BadRequestException('Password must be at least 6 characters');
    const passwordHash = await bcrypt.hash(password, 10);
    const portalUser = await this.prisma.portalUser.upsert({
      where: { studentId },
      create: { companyId, studentId, phone, passwordHash, mustChangePassword: true },
      update: { phone, passwordHash, isActive: true, mustChangePassword: true },
    });
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
    this.sms.sendPortalCredentials(phone, student.name, password, company?.name).catch(() => {});
    return portalUser;
  }

  // Bulk-provisions portal accounts for every active student in the school
  // that doesn't already have one, using the guardian's phone and a random
  // 6-digit password sent by SMS — doing this one student at a time via the
  // individual dialog doesn't scale past a handful of students.
  async bulkSetPortalAccess(companyId: string) {
    const [students, existing, company] = await Promise.all([
      this.prisma.student.findMany({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.portalUser.findMany({ where: { companyId }, select: { studentId: true } }),
      this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
    ]);
    const alreadyProvisioned = new Set(existing.map(e => e.studentId));

    let created = 0;
    let skippedExisting = 0;
    let skippedNoPhone = 0;
    let smsFailed = 0;

    for (const student of students) {
      if (alreadyProvisioned.has(student.id)) { skippedExisting++; continue; }
      const phone = student.guardianPhone;
      if (!phone) { skippedNoPhone++; continue; }

      const password = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit, easy to read from an SMS
      const passwordHash = await bcrypt.hash(password, 10);
      await this.prisma.portalUser.create({
        data: { companyId, studentId: student.id, phone, passwordHash, mustChangePassword: true },
      });
      created++;
      const sent = await this.sms.sendPortalCredentials(phone, student.name, password, company?.name).catch(() => false);
      if (!sent) smsFailed++;
    }

    return { totalStudents: students.length, created, skippedExisting, skippedNoPhone, smsFailed };
  }

  async changePassword(req: { studentId: string; companyId: string; classId?: string }, currentPassword: string, newPassword: string) {
    const portalUser = await this.prisma.portalUser.findUnique({ where: { studentId: req.studentId } });
    if (!portalUser || portalUser.companyId !== req.companyId) throw new NotFoundException('Portal account not found');
    const valid = await bcrypt.compare(currentPassword, portalUser.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    if (!newPassword || newPassword.length < 6) throw new BadRequestException('New password must be at least 6 characters');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await this.prisma.portalUser.update({
      where: { studentId: req.studentId },
      data: { passwordHash, mustChangePassword: false },
    });
    const token = this.signPortalToken(updated, req.classId);
    return { token };
  }

  async getMyStudent(studentId: string, companyId: string) {
    return this.prisma.student.findFirst({
      where: { id: studentId, companyId },
      include: { class: true },
    });
  }

  async getAttendance(studentId: string, companyId: string) {
    const records = await this.prisma.studentAttendance.findMany({
      where: { studentId, companyId },
      orderBy: { date: 'desc' },
      take: 90,
    });
    const total = records.length;
    const present = records.filter(r => r.status === 'PRESENT').length;
    const late = records.filter(r => r.status === 'LATE').length;
    const absent = records.filter(r => r.status === 'ABSENT').length;
    return {
      records,
      summary: {
        total,
        present: present + late,
        absent,
        percentage: total ? Math.round(((present + late) / total) * 100) : 0,
      },
    };
  }

  async getFees(studentId: string, companyId: string) {
    return this.prisma.feeInvoice.findMany({
      where: { studentId, companyId, releasedAt: { not: null } },
      include: { payments: { orderBy: { paidAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Deliberately minimal fields — a parent scanning to pay only needs the
  // bank name and the QR itself, never a real bank account number, balance,
  // or the bank's own online-banking login stored on this record. eSewa/Khalti
  // are different: the "account number" there IS the wallet phone number —
  // the exact thing a parent needs to confirm they're paying the right
  // wallet — so it's safe (and useful) to include for those two types only.
  async getPaymentQrCodes(companyId: string) {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { companyId, qrCodeUrl: { not: null } },
      select: { id: true, bankName: true, qrCodeUrl: true, paymentType: true, accountNumber: true },
    });
    return accounts.map((a) => ({
      id: a.id,
      bankName: a.bankName,
      qrCodeUrl: a.qrCodeUrl,
      paymentType: a.paymentType,
      accountNumber: a.paymentType === 'BANK' ? undefined : a.accountNumber,
    }));
  }

  getFeeReceipt(invoiceId: string, studentId: string, companyId: string) {
    return this.finance.getFeeReceipt(companyId, invoiceId, studentId);
  }

  submitPaymentProof(
    invoiceId: string,
    studentId: string,
    companyId: string,
    body: { amount: number; method?: string; bankAccountId?: string; proofScreenshotUrl: string; notes?: string },
  ) {
    return this.finance.submitPaymentProof(companyId, invoiceId, studentId, body);
  }

  async getResults(studentId: string, companyId: string) {
    return this.prisma.examResult.findMany({
      where: { studentId, companyId },
      include: { subject: true },
      orderBy: { examDate: 'desc' },
    });
  }

  async getHomework(classId: string, companyId: string) {
    return this.prisma.homework.findMany({
      where: { classId, companyId },
      include: { subject: true },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getNotices(companyId: string) {
    return this.prisma.schoolNotice.findMany({
      where: { companyId, isPublished: true },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });
  }

  async getTimetable(classId: string, companyId: string) {
    return this.prisma.timetableEntry.findMany({
      where: { classId, companyId },
      include: { subject: true },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    });
  }

  async getStudyMaterials(classId: string, companyId: string, subjectId?: string) {
    return this.prisma.studyMaterial.findMany({
      // classId null on a material means "all classes" — include those alongside
      // materials targeted specifically at the student's own class.
      where: { companyId, OR: [{ classId }, { classId: null }], ...(subjectId ? { subjectId } : {}) },
      include: { subject: true, class: { select: { name: true, section: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getExamSchedule(classId: string, companyId: string) {
    return this.prisma.examSchedule.findMany({
      where: { classId, companyId },
      include: { subject: true },
      orderBy: { examDate: 'asc' },
    });
  }

  async getEvents(companyId: string) {
    return this.prisma.schoolEvent.findMany({
      where: { companyId },
      orderBy: { startDate: 'asc' },
      take: 50,
    });
  }
}
