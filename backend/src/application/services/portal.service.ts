import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { SchoolFinanceService } from './school-finance.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly finance: SchoolFinanceService,
  ) {}

  async login(phone: string, password: string, companyId: string) {
    const portalUser = await this.prisma.portalUser.findFirst({
      where: { phone, companyId, isActive: true },
      include: { student: { include: { class: true } } },
    });
    if (!portalUser) throw new UnauthorizedException('Invalid phone number or password');
    const valid = await bcrypt.compare(password, portalUser.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid phone number or password');
    const token = this.jwtService.sign(
      {
        studentId: portalUser.studentId,
        companyId,
        classId: portalUser.student?.classId,
        type: 'portal',
      },
      { secret: process.env.JWT_SECRET, expiresIn: '30d' },
    );
    return { token, student: portalUser.student };
  }

  async setPortalPassword(studentId: string, phone: string, password: string, companyId: string) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, companyId } });
    if (!student) throw new NotFoundException('Student not found');
    if (!phone || !password) throw new BadRequestException('Phone and password are required');
    if (password.length < 6) throw new BadRequestException('Password must be at least 6 characters');
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.portalUser.upsert({
      where: { studentId },
      create: { companyId, studentId, phone, passwordHash },
      update: { phone, passwordHash, isActive: true },
    });
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
