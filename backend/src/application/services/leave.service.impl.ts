import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { adToBs } from '@easy-books/shared';

// Nepal fiscal year: Shrawan (month 4) to Ashadh (month 3 of next year)
function getFiscalYear(adDate: Date): string {
  const bsDateStr = adToBs(adDate);
  const bsYear = parseInt(bsDateStr.split('-')[0]);
  const bsMonth = parseInt(bsDateStr.split('-')[1]);
  const fy = bsMonth >= 4 ? bsYear : bsYear - 1;
  return `${fy}-${String(fy + 1).slice(-2)}`;
}

@Injectable()
export class LeaveServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Leave Types ─────────────────────────────────────────────────────────────

  async findAllTypes(companyId: string) {
    return this.prisma.leaveType.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }

  async createType(companyId: string, data: { name: string; daysPerYear: number; isPaid?: boolean }) {
    return this.prisma.leaveType.create({
      data: { companyId, name: data.name, daysPerYear: data.daysPerYear, isPaid: data.isPaid ?? true },
    });
  }

  async updateType(id: string, companyId: string, data: any) {
    const type = await this.prisma.leaveType.findFirst({ where: { id, companyId } });
    if (!type) throw new NotFoundException('Leave type not found');
    return this.prisma.leaveType.update({ where: { id }, data });
  }

  async removeType(id: string, companyId: string) {
    const type = await this.prisma.leaveType.findFirst({ where: { id, companyId } });
    if (!type) throw new NotFoundException('Leave type not found');
    return this.prisma.leaveType.delete({ where: { id } });
  }

  // ─── Leave Balances ──────────────────────────────────────────────────────────

  async getBalances(employeeId: string, companyId: string, fiscalYear: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.leaveBalance.findMany({
      where: { employeeId, fiscalYear },
      include: { leaveType: true },
    });
  }

  async allocateLeave(companyId: string, employeeId: string, leaveTypeId: string, fiscalYear: string, totalDays: number) {
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
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (totalDays <= 0) throw new BadRequestException('End date must be after start date');

    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId: data.employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (overlap) throw new BadRequestException('Leave request overlaps with an existing request');

    return this.prisma.leaveRequest.create({
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
  }

  async approveRequest(id: string, companyId: string, approvedBy: string) {
    const req = await this.prisma.leaveRequest.findFirst({ where: { id, companyId } });
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.status !== 'PENDING') throw new BadRequestException('Only pending requests can be approved');

    const fiscalYear = getFiscalYear(req.startDate);

    await this.prisma.$transaction(async (tx) => {
      await tx.leaveRequest.update({
        where: { id },
        data: { status: 'APPROVED', approvedBy, approvedAt: new Date() },
      });

      const balance = await tx.leaveBalance.findUnique({
        where: { employeeId_leaveTypeId_fiscalYear: { employeeId: req.employeeId, leaveTypeId: req.leaveTypeId, fiscalYear } },
      });

      if (balance) {
        const newUsed = Number(balance.usedDays) + Number(req.totalDays);
        const newRemaining = Number(balance.totalDays) - newUsed;
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { usedDays: newUsed, remainingDays: Math.max(0, newRemaining) },
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
