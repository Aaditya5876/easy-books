import { Injectable } from '@nestjs/common';
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
    return this.prisma.attendance.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateAttendanceDTO) {
    return this.prisma.attendance.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    return this.prisma.attendance.delete({ where: { id } });
  }
}
