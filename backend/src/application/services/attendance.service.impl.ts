import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateAttendanceDTO, UpdateAttendanceDTO } from '@easy-books/shared';

@Injectable()
export class AttendanceServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, employeeId?: string) {
    return this.prisma.attendance.findMany({
      where: { companyId, ...(employeeId ? { employeeId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.attendance.findFirst({ where: { id, companyId } });
  }

  async create(dto: CreateAttendanceDTO) {
    const date = new Date(dto.date);
    return this.prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
      create: { ...dto, date } as any,
      update: { ...dto, date } as any,
    });
  }

  async update(id: string, companyId: string, dto: UpdateAttendanceDTO) {
    const existing = await this.prisma.attendance.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Attendance record not found');
    return this.prisma.attendance.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    const existing = await this.prisma.attendance.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Attendance record not found');
    return this.prisma.attendance.delete({ where: { id } });
  }

  // Read-only aggregate for reporting dashboards (e.g. school ops report) —
  // callers should use this instead of querying the Attendance table directly.
  async getStatusBreakdown(companyId: string, since: Date) {
    return this.prisma.attendance.groupBy({
      by: ['status'],
      where: { companyId, date: { gte: since } },
      _count: true,
    });
  }
}
