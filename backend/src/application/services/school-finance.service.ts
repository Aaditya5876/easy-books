import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { LedgerPostingService } from './ledger-posting.service';
import { NotificationServiceImpl } from './notification.service.impl';
import { adToBs } from '@easy-books/shared';

const DEFAULT_FEE_HEADS = [
  { name: 'Tuition Fee', code: 'TUI', type: 'GENERAL' },
  { name: 'Admission Fee', code: 'ADM', type: 'GENERAL' },
  { name: 'Exam Fee', code: 'EXM', type: 'GENERAL' },
  { name: 'Transport Fee', code: 'TRN', type: 'TRANSPORT' },
  { name: 'Hostel Fee', code: 'HST', type: 'HOSTEL' },
  { name: 'Library Fee', code: 'LIB', type: 'GENERAL' },
  { name: 'Computer Fee', code: 'CMP', type: 'GENERAL' },
  { name: 'Sports Fee', code: 'SPT', type: 'GENERAL' },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface FeeProfileLine {
  feeHeadId: string | null;
  headName: string;
  description: string;
  amount: number;
  source: 'CLASS' | 'TRANSPORT' | 'HOSTEL' | 'PACKAGE' | 'SCHOLARSHIP';
}

@Injectable()
export class SchoolFinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: LedgerPostingService,
    private readonly notifications: NotificationServiceImpl,
  ) {}

  // ── Fee Heads ────────────────────────────────────────────────────────────────

  listFeeHeads(companyId: string) {
    return this.prisma.feeHead.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }

  async createDefaultFeeHeads(companyId: string) {
    const result = await this.prisma.feeHead.createMany({
      data: DEFAULT_FEE_HEADS.map(h => ({ companyId, ...h })),
      skipDuplicates: true,
    });
    return { created: result.count };
  }

  createFeeHead(body: any) {
    return this.prisma.feeHead.create({
      data: {
        companyId: body.companyId,
        name: body.name,
        code: body.code || null,
        type: ['GENERAL', 'TRANSPORT', 'HOSTEL'].includes(body.type) ? body.type : 'GENERAL',
      },
    });
  }

  async updateFeeHead(id: string, companyId: string, body: any) {
    const head = await this.prisma.feeHead.findFirst({ where: { id, companyId } });
    if (!head) throw new NotFoundException('Fee head not found');
    return this.prisma.feeHead.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.code !== undefined ? { code: body.code || null } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.isActive !== undefined ? { isActive: !!body.isActive } : {}),
      },
    });
  }

  async deleteFeeHead(id: string, companyId: string) {
    const head = await this.prisma.feeHead.findFirst({ where: { id, companyId } });
    if (!head) throw new NotFoundException('Fee head not found');
    const [items, structures] = await Promise.all([
      this.prisma.feeInvoiceItem.count({ where: { feeHeadId: id } }),
      this.prisma.feeStructure.count({ where: { feeHeadId: id } }),
    ]);
    if (items > 0) {
      // Preserve history — deactivate instead of delete
      return this.prisma.feeHead.update({ where: { id }, data: { isActive: false } });
    }
    if (structures > 0) throw new BadRequestException(`Cannot delete — used by ${structures} fee structures`);
    return this.prisma.feeHead.delete({ where: { id } });
  }

  // ── Student Fee Profile ──────────────────────────────────────────────────────
  // Composes what one student pays per month: class fees + service fees
  // (auto-detected from transport/hostel assignments) + package + scholarships.

  async getStudentFeeProfile(companyId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, companyId },
      include: {
        class: { select: { id: true, name: true, section: true } },
        package: { include: { heads: { include: { feeHead: true } } } },
        scholarships: { where: { isActive: true }, include: { feeHead: { select: { name: true } } } },
        studentTransports: { where: { isActive: true }, include: { route: true } },
        hostelAllocations: { where: { isActive: true }, include: { room: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const [structures, heads] = await Promise.all([
      this.prisma.feeStructure.findMany({
        where: { companyId, OR: [{ classId: student.classId ?? '—' }, { classId: null }] },
        include: { feeHead: true },
      }),
      this.prisma.feeHead.findMany({ where: { companyId, isActive: true } }),
    ]);

    const headByType = (type: string) => heads.find(h => h.type === type) ?? null;
    const lines: FeeProfileLine[] = [];
    const conflicts: string[] = [];

    // 1. Class fee structures (monthly recurring base)
    for (const s of structures.filter(s => s.frequency === 'MONTHLY')) {
      // Service-type heads bill from actual assignments, not structures
      if (s.feeHead && s.feeHead.type !== 'GENERAL') continue;
      lines.push({
        feeHeadId: s.feeHeadId,
        headName: s.feeHead?.name ?? s.name,
        description: s.name,
        amount: Number(s.amount),
        source: 'CLASS',
      });
    }

    // 2. Transport — from the student's actual route
    const transport = student.studentTransports[0];
    if (transport && Number(transport.route.monthlyFee) > 0) {
      const head = headByType('TRANSPORT');
      lines.push({
        feeHeadId: head?.id ?? null,
        headName: head?.name ?? 'Transport Fee',
        description: `Transport — ${transport.route.routeName}`,
        amount: Number(transport.route.monthlyFee),
        source: 'TRANSPORT',
      });
    }

    // 3. Hostel — from the student's actual room
    const hostel = student.hostelAllocations[0];
    if (hostel && Number(hostel.room.monthlyFee) > 0) {
      const head = headByType('HOSTEL');
      lines.push({
        feeHeadId: head?.id ?? null,
        headName: head?.name ?? 'Hostel Fee',
        description: `Hostel — Room ${hostel.room.roomNumber}`,
        amount: Number(hostel.room.monthlyFee),
        source: 'HOSTEL',
      });
    }

    // 4. Package — bundle replaces the price of its member heads
    let packageLine: FeeProfileLine | null = null;
    let effectiveLines = lines;
    if (student.package && student.package.isActive) {
      const packageHeadIds = new Set(student.package.heads.map(h => h.feeHeadId));
      const covered = lines.filter(l => l.feeHeadId && packageHeadIds.has(l.feeHeadId));
      const uncovered = lines.filter(l => !l.feeHeadId || !packageHeadIds.has(l.feeHeadId));

      // Services in use but not in the package — the mismatch flag
      for (const l of uncovered.filter(u => u.source === 'TRANSPORT' || u.source === 'HOSTEL')) {
        conflicts.push(`${l.description} is billed separately — not included in package "${student.package.name}"`);
      }

      if (student.package.price != null) {
        packageLine = {
          feeHeadId: null,
          headName: student.package.name,
          description: `Package: ${student.package.name} (${student.package.heads.map(h => h.feeHead.name).join(', ')})`,
          amount: Number(student.package.price),
          source: 'PACKAGE',
        };
        const coveredSum = covered.reduce((s, l) => s + l.amount, 0);
        if (coveredSum > 0 && Number(student.package.price) < coveredSum) {
          // informational — package is a discount over itemized total
        }
        effectiveLines = [packageLine, ...uncovered];
      }
      // package without fixed price = just a preset; itemized lines stand
    }

    // 5. Scholarships
    const scholarshipLines: FeeProfileLine[] = [];
    const baseTotal = effectiveLines.reduce((s, l) => s + l.amount, 0);
    for (const sch of student.scholarships) {
      let deduction = 0;
      if (sch.feeHeadId) {
        const target = effectiveLines.filter(l => l.feeHeadId === sch.feeHeadId).reduce((s, l) => s + l.amount, 0);
        deduction = sch.type === 'PERCENT' ? (target * Number(sch.value)) / 100 : Math.min(Number(sch.value), target);
      } else {
        deduction = sch.type === 'PERCENT' ? (baseTotal * Number(sch.value)) / 100 : Number(sch.value);
      }
      if (deduction > 0) {
        scholarshipLines.push({
          feeHeadId: sch.feeHeadId,
          headName: sch.feeHead?.name ?? 'All fees',
          description: `${sch.name} (${sch.type === 'PERCENT' ? `${Number(sch.value)}%` : `Rs. ${Number(sch.value)}`})`,
          amount: -round2(deduction),
          source: 'SCHOLARSHIP',
        });
      }
    }

    const allLines = [...effectiveLines, ...scholarshipLines];
    const monthlyTotal = round2(Math.max(0, allLines.reduce((s, l) => s + l.amount, 0)));

    return {
      student: {
        id: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        className: student.class ? `${student.class.name}${student.class.section ? ` (${student.class.section})` : ''}` : null,
        packageId: student.packageId,
        packageName: student.package?.name ?? null,
      },
      lines: allLines,
      scholarships: student.scholarships.map(s => ({
        id: s.id, name: s.name, type: s.type, value: Number(s.value),
        feeHeadId: s.feeHeadId, feeHeadName: s.feeHead?.name ?? null,
      })),
      conflicts,
      monthlyTotal,
    };
  }

  // ── Scholarships ─────────────────────────────────────────────────────────────

  async addScholarship(companyId: string, studentId: string, body: any) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, companyId } });
    if (!student) throw new NotFoundException('Student not found');
    if (!body.name?.trim()) throw new BadRequestException('Scholarship name is required');
    const value = Number(body.value);
    if (!(value > 0)) throw new BadRequestException('Value must be positive');
    if (body.type === 'PERCENT' && value > 100) throw new BadRequestException('Percent cannot exceed 100');
    return this.prisma.studentScholarship.create({
      data: {
        companyId, studentId,
        name: body.name.trim(),
        type: body.type === 'FIXED' ? 'FIXED' : 'PERCENT',
        value,
        feeHeadId: body.feeHeadId || null,
      },
    });
  }

  async removeScholarship(companyId: string, id: string) {
    const sch = await this.prisma.studentScholarship.findFirst({ where: { id, companyId } });
    if (!sch) throw new NotFoundException('Scholarship not found');
    return this.prisma.studentScholarship.delete({ where: { id } });
  }

  // ── Packages ─────────────────────────────────────────────────────────────────

  listPackages(companyId: string) {
    return this.prisma.feePackage.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: {
        heads: { include: { feeHead: { select: { id: true, name: true } } } },
        _count: { select: { students: true } },
      },
    });
  }

  async createPackage(body: any) {
    if (!body.name?.trim()) throw new BadRequestException('Package name is required');
    const headIds: string[] = Array.isArray(body.feeHeadIds) ? body.feeHeadIds : [];
    return this.prisma.feePackage.create({
      data: {
        companyId: body.companyId,
        name: body.name.trim(),
        price: body.price != null && body.price !== '' ? Number(body.price) : null,
        heads: { create: headIds.map(id => ({ feeHeadId: id })) },
      },
      include: { heads: { include: { feeHead: true } } },
    });
  }

  async updatePackage(id: string, companyId: string, body: any) {
    const pkg = await this.prisma.feePackage.findFirst({ where: { id, companyId } });
    if (!pkg) throw new NotFoundException('Package not found');
    const headIds: string[] | undefined = Array.isArray(body.feeHeadIds) ? body.feeHeadIds : undefined;
    return this.prisma.feePackage.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.price !== undefined ? { price: body.price != null && body.price !== '' ? Number(body.price) : null } : {}),
        ...(body.isActive !== undefined ? { isActive: !!body.isActive } : {}),
        ...(headIds
          ? { heads: { deleteMany: {}, create: headIds.map(hid => ({ feeHeadId: hid })) } }
          : {}),
      },
      include: { heads: { include: { feeHead: true } } },
    });
  }

  async deletePackage(id: string, companyId: string) {
    const pkg = await this.prisma.feePackage.findFirst({ where: { id, companyId } });
    if (!pkg) throw new NotFoundException('Package not found');
    const students = await this.prisma.student.count({ where: { packageId: id } });
    if (students > 0) throw new BadRequestException(`Cannot delete — ${students} students are on this package`);
    return this.prisma.feePackage.delete({ where: { id } });
  }

  async assignPackage(companyId: string, studentId: string, packageId: string | null) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, companyId } });
    if (!student) throw new NotFoundException('Student not found');
    if (packageId) {
      const pkg = await this.prisma.feePackage.findFirst({ where: { id: packageId, companyId } });
      if (!pkg) throw new NotFoundException('Package not found');
    }
    return this.prisma.student.update({ where: { id: studentId }, data: { packageId } });
  }

  // ── Billing Run ──────────────────────────────────────────────────────────────
  // Walks every active student's fee profile and creates line-itemed invoices.

  async billingRun(companyId: string, month: string, classId?: string, dueDate?: string) {
    if (!month?.trim()) throw new BadRequestException('Billing month is required');

    const students = await this.prisma.student.findMany({
      where: { companyId, status: 'ACTIVE', ...(classId ? { classId } : {}) },
      select: { id: true },
    });

    const existing = await this.prisma.feeInvoice.findMany({
      where: { companyId, month, studentId: { in: students.map(s => s.id) } },
      select: { studentId: true },
    });
    const alreadyBilled = new Set(existing.map(e => e.studentId));

    let created = 0;
    let skippedExisting = 0;
    let skippedEmpty = 0;

    for (const s of students) {
      if (alreadyBilled.has(s.id)) { skippedExisting++; continue; }
      const profile = await this.getStudentFeeProfile(companyId, s.id);
      if (profile.monthlyTotal <= 0 || profile.lines.length === 0) { skippedEmpty++; continue; }

      const invoice = await this.prisma.feeInvoice.create({
        data: {
          companyId,
          studentId: s.id,
          month,
          description: `Monthly fees — ${month}`,
          totalAmount: profile.monthlyTotal,
          dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 10 * 86_400_000),
          status: 'PENDING',
          items: {
            create: profile.lines.map(l => ({
              feeHeadId: l.feeHeadId,
              description: l.description,
              amount: l.amount,
            })),
          },
        },
      });

      // Best-effort, same as recordPayment() below — a ledger posting failure
      // must never block the invoice itself from being created.
      try {
        await this.postFeeInvoiceAccrual(companyId, invoice.id);
      } catch (err) {
        console.error('Fee invoice accrual posting failed:', (err as Error).message);
      }

      created++;
    }

    return { created, skippedExisting, skippedEmpty, students: students.length };
  }

  // The moment an invoice is generated (whether from a manual billing run or
  // the automatic monthly scheduler), recognize the income right away — DR Fee
  // Receivable, CR each fee head's Income account. This is accrual accounting:
  // a student owing fees counts as income now, not only once they actually pay.
  // recordPayment()/postFeePayment() below then just clears Fee Receivable via
  // Cash/Bank when payment actually happens — it does NOT credit Income again,
  // otherwise every fee would be counted twice.
  private async postFeeInvoiceAccrual(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.feeInvoice.findUnique({
      where: { id: invoiceId },
      include: { items: { include: { feeHead: true } }, student: { select: { name: true } } },
    });
    if (!invoice) return;

    const total = Number(invoice.totalAmount);
    if (total <= 0) return; // fully covered by scholarship — nothing to accrue

    const date = new Date(invoice.createdAt);
    const dateBs = adToBs(date);
    const desc = `Fee billed — ${invoice.student?.name ?? 'Student'} (${invoice.month})`;

    // Net per income head — a scholarship line against a specific head reduces
    // that head's net (rare case: net could even be negative for a head with a
    // large targeted scholarship, handled as a debit to that Income account).
    const byHead = new Map<string, number>();
    for (const item of invoice.items) {
      const accName = `${item.feeHead?.name ?? 'General Fee'} Income`;
      byHead.set(accName, round2((byHead.get(accName) ?? 0) + Number(item.amount)));
    }

    const receivable = await this.getOrCreateAccount(companyId, 'Fee Receivable', 'ASSET');
    const ops: any[] = [
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: receivable.id, dateAd: date, dateBs,
          description: desc, debit: total, credit: 0,
          balance: Number(receivable.currentBalance) + total,
          referenceType: 'FEE_INVOICE', referenceId: invoice.id, isAutoPosted: true,
        },
      }),
      this.prisma.ledgerAccount.update({ where: { id: receivable.id }, data: { currentBalance: { increment: total } } }),
    ];

    for (const [accName, netAmt] of byHead) {
      if (Math.abs(netAmt) < 0.005) continue;
      const account = await this.getOrCreateAccount(companyId, accName, 'INCOME');
      const debit = netAmt < 0 ? -netAmt : 0;
      const credit = netAmt > 0 ? netAmt : 0;
      const delta = credit - debit; // INCOME is credit-normal
      ops.push(
        this.prisma.ledgerEntry.create({
          data: {
            companyId, accountId: account.id, dateAd: date, dateBs,
            description: desc, debit, credit,
            balance: Number(account.currentBalance) + delta,
            referenceType: 'FEE_INVOICE', referenceId: invoice.id, isAutoPosted: true,
          },
        }),
        this.prisma.ledgerAccount.update({ where: { id: account.id }, data: { currentBalance: { increment: delta } } }),
      );
    }

    await this.prisma.$transaction(ops);
  }

  // ── Payments & Receipts ──────────────────────────────────────────────────────

  private async nextReceiptNo(companyId: string): Promise<string> {
    const bsYear = (adToBs(new Date()) || '').split('-')[0] || String(new Date().getFullYear());
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { feeReceiptSequence: true, feeReceiptYear: true },
    });
    const seq = company?.feeReceiptYear === bsYear ? (company.feeReceiptSequence ?? 0) + 1 : 1;
    await this.prisma.company.update({
      where: { id: companyId },
      data: { feeReceiptSequence: seq, feeReceiptYear: bsYear },
    });
    return `R-${bsYear}-${String(seq).padStart(4, '0')}`;
  }

  async recordPayment(companyId: string, invoiceId: string, body: { amount: number; method?: string; notes?: string; bankAccountId?: string }) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { student: { select: { name: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const amount = round2(Number(body.amount));
    if (!(amount > 0)) throw new BadRequestException('Payment amount must be positive');
    const remaining = round2(Number(invoice.totalAmount) - Number(invoice.paidAmount));
    if (amount > remaining) throw new BadRequestException(`Payment exceeds remaining amount: Rs. ${remaining}`);

    const method = ['CASH', 'BANK', 'ESEWA', 'KHALTI'].includes(body.method ?? '') ? body.method! : 'CASH';

    let bankAccount: { id: string } | null = null;
    if (method === 'BANK') {
      if (!body.bankAccountId) throw new BadRequestException('Select which bank account received this payment');
      bankAccount = await this.prisma.bankAccount.findFirst({ where: { id: body.bankAccountId, companyId }, select: { id: true } });
      if (!bankAccount) throw new BadRequestException('Bank account not found');
    }

    const receiptNo = await this.nextReceiptNo(companyId);
    const newPaid = round2(Number(invoice.paidAmount) + amount);
    const status = newPaid >= Number(invoice.totalAmount) ? 'PAID' : 'PARTIAL';

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.feePayment.create({
        data: { companyId, invoiceId, receiptNo, amount, method, bankAccountId: bankAccount?.id, notes: body.notes || null },
      });
      await tx.feeInvoice.update({
        where: { id: invoiceId },
        data: { paidAmount: newPaid, status, paidDate: status === 'PAID' ? new Date() : undefined },
      });
      if (bankAccount) {
        await tx.bankAccount.update({ where: { id: bankAccount.id }, data: { currentBalance: { increment: amount } } });
        await tx.transaction.create({
          data: {
            companyId,
            bankAccountId: bankAccount.id,
            dateAd: new Date(),
            type: 'BANK' as any,
            category: 'INCOME' as any,
            amount,
            description: `Fee payment — ${invoice.student?.name ?? 'Student'} (Invoice ${invoice.month})`,
            referenceType: 'FEE_PAYMENT',
            referenceId: created.id,
            status: 'COMPLETED' as any,
          },
        });
      }
      return created;
    });

    // Ledger posting is best-effort — a posting failure must never lose a receipt
    try {
      await this.postFeePayment(companyId, payment.id, invoice.student?.name ?? 'Student');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Fee payment ledger posting failed:', (err as Error).message);
    }

    try {
      await this.notifications.notifyRole(companyId, ['ADMIN', 'ACCOUNTANT'], {
        type: 'FEE_PAYMENT',
        title: 'Fee payment recorded',
        message: `Rs. ${amount} received from ${invoice.student?.name ?? 'Student'} (Receipt ${payment.receiptNo})`,
        link: '/fees',
        referenceType: 'FEE_INVOICE',
        referenceId: invoiceId,
      });
    } catch (err) {
      console.error('Notification dispatch failed:', (err as Error).message);
    }

    return { ...payment, invoiceStatus: status };
  }

  listPayments(companyId: string, invoiceId: string) {
    return this.prisma.feePayment.findMany({
      where: { companyId, invoiceId },
      orderBy: { paidAt: 'desc' },
    });
  }

  async getFeeReceipt(companyId: string, invoiceId: string, studentId?: string) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id: invoiceId, companyId, ...(studentId ? { studentId } : {}) },
      include: {
        student: {
          include: { class: { select: { name: true, section: true } } },
        },
        company: { select: { name: true, address: true, phone: true, email: true } },
        items: { include: { feeHead: { select: { name: true } }, inventoryItem: { select: { itemName: true, unit: true } } } },
        payments: { orderBy: { paidAt: 'asc' } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  // DR Cash/Bank · CR each head's income account, allocated across invoice items
  // DR Cash/Bank · CR Fee Receivable — the actual cash receipt, clearing the
  // receivable that postFeeInvoiceAccrual() already created when the invoice
  // was generated. This must NOT credit Income again (that already happened at
  // billing time) — otherwise every fee would be counted twice.
  private async postFeePayment(companyId: string, paymentId: string, studentName: string) {
    const payment = await this.prisma.feePayment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    });
    if (!payment) return;

    const amount = Number(payment.amount);
    const date = new Date(payment.paidAt);
    const dateBs = adToBs(date);
    const drAccountName = payment.method === 'CASH' ? 'Cash in Hand' : 'Bank Account';
    const desc = `Fee receipt ${payment.receiptNo} — ${studentName} (${payment.invoice.month})`;

    const [drAccount, receivable] = await Promise.all([
      this.getOrCreateAccount(companyId, drAccountName, 'ASSET'),
      this.getOrCreateAccount(companyId, 'Fee Receivable', 'ASSET'),
    ]);

    await this.prisma.$transaction([
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: drAccount.id, dateAd: date, dateBs,
          description: desc, debit: amount, credit: 0,
          balance: Number(drAccount.currentBalance) + amount,
          referenceType: 'FEE_PAYMENT', referenceId: payment.id, isAutoPosted: true,
        },
      }),
      this.prisma.ledgerAccount.update({
        where: { id: drAccount.id },
        data: { currentBalance: { increment: amount } },
      }),
      this.prisma.ledgerEntry.create({
        data: {
          companyId, accountId: receivable.id, dateAd: date, dateBs,
          description: desc, debit: 0, credit: amount,
          balance: Number(receivable.currentBalance) - amount,
          referenceType: 'FEE_PAYMENT', referenceId: payment.id, isAutoPosted: true,
        },
      }),
      this.prisma.ledgerAccount.update({
        where: { id: receivable.id },
        data: { currentBalance: { decrement: amount } },
      }),
    ]);
  }

  private async getOrCreateAccount(companyId: string, accountName: string, accountType: string) {
    const existing = await this.prisma.ledgerAccount.findFirst({ where: { companyId, accountName } });
    if (existing) return existing;
    return this.prisma.ledgerAccount.create({
      data: { companyId, accountName, accountType: accountType as any, isSystem: true },
    });
  }

}
