import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { NotificationServiceImpl } from './notification.service.impl';
import { resolveLinkedEmployee } from './self-service-employee.util';
import { adToBs } from '@easy-books/shared';

// Count working days between two dates, skipping Saturdays (Nepal weekly holiday)
function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(23, 59, 59, 999);
  while (current <= endDay) {
    if (current.getDay() !== 6) count++; // 6 = Saturday
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// The individual working days (UTC-midnight dates, like attendance rows use)
// a leave covers — Saturdays are Nepal's weekly holiday.
function workingDates(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cur <= last) {
    if (cur.getUTCDay() !== 6) days.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

type Tx = Prisma.TransactionClient;

// Nepal fiscal year: Shrawan (month 4) to Ashadh (month 3 of next year)
export function getFiscalYear(adDate: Date): string {
  const bsDateStr = adToBs(adDate);
  const bsYear = parseInt(bsDateStr.split('-')[0]);
  const bsMonth = parseInt(bsDateStr.split('-')[1]);
  const fy = bsMonth >= 4 ? bsYear : bsYear - 1;
  return `${fy}-${String(fy + 1).slice(-2)}`;
}

@Injectable()
export class LeaveServiceImpl {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationServiceImpl,
  ) {}

  // ─── Self-service (any authenticated employee) ─────────────────────────────

  async getSelfContext(companyId: string, email: string) {
    const employee = await resolveLinkedEmployee(this.prisma, companyId, email);
    if (!employee) return { linked: false, employeeName: null, fiscalYear: null, balances: [] };
    const fiscalYear = getFiscalYear(new Date());
    const balances = await this.getBalances(employee.id, companyId, fiscalYear);
    return { linked: true, employeeName: employee.name, fiscalYear, balances };
  }

  async findSelfRequests(companyId: string, email: string) {
    const employee = await resolveLinkedEmployee(this.prisma, companyId, email);
    if (!employee) return [];
    return this.findRequests(companyId, { employeeId: employee.id });
  }

  async createSelfRequest(companyId: string, email: string, data: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason?: string;
  }) {
    const employee = await resolveLinkedEmployee(this.prisma, companyId, email);
    if (!employee) {
      throw new NotFoundException(
        'No employee record is linked to your account — ask an admin to set your employee email to match your login email.',
      );
    }
    return this.createRequest(companyId, { ...data, employeeId: employee.id });
  }

  async cancelSelfRequest(id: string, companyId: string, email: string) {
    const employee = await resolveLinkedEmployee(this.prisma, companyId, email);
    if (!employee) throw new NotFoundException('No employee record is linked to your account');

    const req = await this.prisma.leaveRequest.findFirst({ where: { id, companyId } });
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.employeeId !== employee.id) throw new ForbiddenException('You can only cancel your own leave requests');

    return this.cancelRequest(id, companyId);
  }

  // ─── Leave Types ─────────────────────────────────────────────────────────────

  async findAllTypes(companyId: string) {
    return this.prisma.leaveType.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }

  private typeData(data: { name?: unknown; daysPerYear?: unknown; isPaid?: unknown }, partial: boolean) {
    const out: { name?: string; daysPerYear?: number; isPaid?: boolean } = {};
    if (data.name !== undefined || !partial) {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!name) throw new BadRequestException('Leave type name is required');
      out.name = name;
    }
    if (data.daysPerYear !== undefined || !partial) {
      const days = Number(data.daysPerYear ?? 0);
      if (!Number.isFinite(days) || days < 0 || days > 366) throw new BadRequestException('Days per year must be between 0 and 366');
      out.daysPerYear = days;
    }
    if (data.isPaid !== undefined) out.isPaid = !!data.isPaid;
    return out;
  }

  private async saveType(op: () => Promise<unknown>) {
    try {
      return await op();
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new ConflictException('A leave type with this name already exists');
      throw e;
    }
  }

  async createType(companyId: string, data: { name: string; daysPerYear: number; isPaid?: boolean }) {
    const clean = this.typeData(data, false);
    return this.saveType(() => this.prisma.leaveType.create({
      data: { companyId, name: clean.name!, daysPerYear: clean.daysPerYear!, isPaid: clean.isPaid ?? true },
    }));
  }

  async updateType(id: string, companyId: string, data: any) {
    const type = await this.prisma.leaveType.findFirst({ where: { id, companyId } });
    if (!type) throw new NotFoundException('Leave type not found');
    return this.saveType(() => this.prisma.leaveType.update({ where: { id }, data: this.typeData(data, true) }));
  }

  async removeType(id: string, companyId: string) {
    const type = await this.prisma.leaveType.findFirst({ where: { id, companyId } });
    if (!type) throw new NotFoundException('Leave type not found');
    return this.prisma.leaveType.delete({ where: { id } });
  }

  // ─── Leave Balances ──────────────────────────────────────────────────────────

  // A leave type's days per year is every employee's default allowance; the
  // balance row is created the first time it's needed. Types with 0 days per
  // year (e.g. unpaid leave) have no allowance and no limit.
  private async ensureBalance(db: Tx | PrismaService, companyId: string, employeeId: string, leaveTypeId: string, fiscalYear: string) {
    const key = { employeeId_leaveTypeId_fiscalYear: { employeeId, leaveTypeId, fiscalYear } };
    const existing = await db.leaveBalance.findUnique({ where: key });
    if (existing) return existing;
    const type = await db.leaveType.findFirst({ where: { id: leaveTypeId, companyId } });
    if (!type || Number(type.daysPerYear) <= 0) return null;
    return db.leaveBalance.upsert({
      where: key,
      create: { companyId, employeeId, leaveTypeId, fiscalYear, totalDays: type.daysPerYear, usedDays: 0, remainingDays: type.daysPerYear },
      update: {},
    });
  }

  async getBalances(employeeId: string, companyId: string, fiscalYear?: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee) throw new NotFoundException('Employee not found');
    const fy = fiscalYear || getFiscalYear(new Date());

    const types = await this.prisma.leaveType.findMany({ where: { companyId } });
    for (const t of types) await this.ensureBalance(this.prisma, companyId, employeeId, t.id, fy);

    return this.prisma.leaveBalance.findMany({
      where: { employeeId, fiscalYear: fy },
      include: { leaveType: true },
      orderBy: { leaveType: { name: 'asc' } },
    });
  }

  async allocateLeave(companyId: string, employeeId: string, leaveTypeId: string, fiscalYear: string, totalDays: number) {
    const [employee, leaveType] = await Promise.all([
      this.prisma.employee.findFirst({ where: { id: employeeId, companyId } }),
      this.prisma.leaveType.findFirst({ where: { id: leaveTypeId, companyId } }),
    ]);
    if (!employee) throw new NotFoundException('Employee not found');
    if (!leaveType) throw new NotFoundException('Leave type not found');

    const existing = await this.prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_fiscalYear: { employeeId, leaveTypeId, fiscalYear } },
    });

    if (existing) {
      const usedDays = Number(existing.usedDays);
      return this.prisma.leaveBalance.update({
        where: { id: existing.id },
        data: { totalDays, remainingDays: Math.max(0, totalDays - usedDays) },
      });
    }

    return this.prisma.leaveBalance.create({
      data: { companyId, employeeId, leaveTypeId, fiscalYear, totalDays, usedDays: 0, remainingDays: totalDays },
    });
  }

  async carryoverLeave(companyId: string, fromFiscalYear: string, toFiscalYear: string) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: { id: true },
    });

    const leaveTypes = await this.prisma.leaveType.findMany({
      where: { companyId },
      select: { id: true },
    });

    let carried = 0;
    for (const emp of employees) {
      for (const lt of leaveTypes) {
        const fromBalance = await this.prisma.leaveBalance.findUnique({
          where: { employeeId_leaveTypeId_fiscalYear: { employeeId: emp.id, leaveTypeId: lt.id, fiscalYear: fromFiscalYear } },
        });
        if (!fromBalance || Number(fromBalance.remainingDays) <= 0) continue;

        const carryDays = Number(fromBalance.remainingDays);
        const existing = await this.prisma.leaveBalance.findUnique({
          where: { employeeId_leaveTypeId_fiscalYear: { employeeId: emp.id, leaveTypeId: lt.id, fiscalYear: toFiscalYear } },
        });

        if (existing) {
          await this.prisma.leaveBalance.update({
            where: { id: existing.id },
            data: {
              totalDays: { increment: carryDays },
              remainingDays: { increment: carryDays },
            },
          });
        } else {
          await this.prisma.leaveBalance.create({
            data: {
              companyId, employeeId: emp.id, leaveTypeId: lt.id,
              fiscalYear: toFiscalYear,
              totalDays: carryDays, usedDays: 0, remainingDays: carryDays,
            },
          });
        }
        carried++;
      }
    }

    return { carried, message: `Carried over leave balances for ${employees.length} employees from ${fromFiscalYear} to ${toFiscalYear}` };
  }

  // ─── Leave Requests ───────────────────────────────────────────────────────────

  async findRequests(companyId: string, filters?: { employeeId?: string; status?: string }) {
    return this.prisma.leaveRequest.findMany({
      where: {
        companyId,
        ...(filters?.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters?.status ? { status: filters.status as any } : {}),
      },
      include: {
        employee: { select: { name: true, employeeId: true, department: true } },
        leaveType: { select: { name: true, isPaid: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRequestById(id: string, companyId: string) {
    const req = await this.prisma.leaveRequest.findFirst({
      where: { id, companyId },
      include: { employee: true, leaveType: true },
    });
    if (!req) throw new NotFoundException('Leave request not found');
    return req;
  }

  async createRequest(companyId: string, data: {
    employeeId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason?: string;
  }) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (end < start) throw new BadRequestException('End date must be after start date');
    const totalDays = countWorkingDays(start, end);

    if (totalDays <= 0) throw new BadRequestException('End date must be after start date');

    const type = await this.prisma.leaveType.findFirst({ where: { id: data.leaveTypeId, companyId } });
    if (!type) throw new NotFoundException('Leave type not found');
    const fiscalYear = getFiscalYear(start);
    const balance = await this.ensureBalance(this.prisma, companyId, data.employeeId, data.leaveTypeId, fiscalYear);
    if (balance) {
      const pending = await this.prisma.leaveRequest.aggregate({
        where: { employeeId: data.employeeId, leaveTypeId: data.leaveTypeId, status: 'PENDING' },
        _sum: { totalDays: true },
      });
      const available = Number(balance.remainingDays) - Number(pending._sum.totalDays ?? 0);
      if (totalDays > available) {
        throw new BadRequestException(`Not enough ${type.name} left: ${Math.max(0, available)} day(s) available, ${totalDays} requested`);
      }
    }

    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId: data.employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (overlap) throw new BadRequestException('Leave request overlaps with an existing request');

    const created = await this.prisma.leaveRequest.create({
      data: {
        companyId,
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        startDate: start,
        endDate: end,
        totalDays,
        reason: data.reason,
        status: 'PENDING',
      },
    });

    try {
      const employee = await this.prisma.employee.findUnique({ where: { id: data.employeeId }, select: { name: true } });
      await this.notifications.notifyRole(companyId, ['ADMIN', 'ACCOUNTANT'], {
        type: 'LEAVE_REQUEST',
        title: 'New leave request',
        message: `${employee?.name ?? 'An employee'} requested ${totalDays} day(s) leave (${data.startDate} to ${data.endDate})`,
        referenceType: 'LEAVE_REQUEST',
        referenceId: created.id,
      });
    } catch (err) {
      console.error('Notification dispatch failed:', (err as Error).message);
    }

    return created;
  }

  async approveRequest(id: string, companyId: string, approvedBy: string) {
    const req = await this.prisma.leaveRequest.findFirst({ where: { id, companyId }, include: { leaveType: true } });
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.status !== 'PENDING') throw new BadRequestException('Only pending requests can be approved');

    const fiscalYear = getFiscalYear(req.startDate);

    await this.prisma.$transaction(async (tx) => {
      // Conditional flip: two approvers clicking at once can't both deduct.
      const claimed = await tx.leaveRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'APPROVED', approvedBy, approvedAt: new Date() },
      });
      if (claimed.count === 0) throw new BadRequestException('Only pending requests can be approved');

      const balance = await this.ensureBalance(tx, companyId, req.employeeId, req.leaveTypeId, fiscalYear);
      if (balance) {
        if (Number(balance.remainingDays) < Number(req.totalDays)) {
          throw new BadRequestException(
            `Insufficient leave balance. Available: ${balance.remainingDays} days, Requested: ${req.totalDays} days`,
          );
        }
        const newUsed = Number(balance.usedDays) + Number(req.totalDays);
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { usedDays: newUsed, remainingDays: Number(balance.totalDays) - newUsed },
        });
      }

      // Approved days appear in staff attendance as LEAVE (and block self
      // check-in); unpaid leave is deducted in payroll from the request itself.
      const note = `${req.leaveType.name}${req.leaveType.isPaid ? '' : ' (unpaid)'}`;
      for (const date of workingDates(req.startDate, req.endDate)) {
        await tx.attendance.upsert({
          where: { employeeId_date: { employeeId: req.employeeId, date } },
          create: { companyId, employeeId: req.employeeId, date, status: 'LEAVE', notes: note },
          update: { status: 'LEAVE', notes: note, checkInTime: null, checkOutTime: null },
        });
      }
    });

    return this.prisma.leaveRequest.findFirst({ where: { id } });
  }

  async rejectRequest(id: string, companyId: string, approvedBy: string) {
    const req = await this.prisma.leaveRequest.findFirst({ where: { id, companyId } });
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.status !== 'PENDING') throw new BadRequestException('Only pending requests can be rejected');

    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'REJECTED', approvedBy, approvedAt: new Date() },
    });
  }

  async cancelRequest(id: string, companyId: string) {
    const req = await this.prisma.leaveRequest.findFirst({ where: { id, companyId } });
    if (!req) throw new NotFoundException('Leave request not found');
    if (!['PENDING', 'APPROVED'].includes(req.status)) {
      throw new BadRequestException('Only pending or approved requests can be cancelled');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } });

      if (req.status === 'APPROVED') {
        await tx.attendance.deleteMany({
          where: { employeeId: req.employeeId, status: 'LEAVE', date: { gte: req.startDate, lte: req.endDate } },
        });
        const fiscalYear = getFiscalYear(req.startDate);
        const balance = await tx.leaveBalance.findUnique({
          where: { employeeId_leaveTypeId_fiscalYear: { employeeId: req.employeeId, leaveTypeId: req.leaveTypeId, fiscalYear } },
        });

        if (balance) {
          const newUsed = Math.max(0, Number(balance.usedDays) - Number(req.totalDays));
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: { usedDays: newUsed, remainingDays: Number(balance.totalDays) - newUsed },
          });
        }
      }
    });
  }
}
