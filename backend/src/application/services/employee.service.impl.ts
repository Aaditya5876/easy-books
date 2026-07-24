import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateEmployeeDTO, UpdateEmployeeDTO } from '@easy-books/shared';

@Injectable()
export class EmployeeServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Name-only listing for pickers/labels (e.g. "assign class teacher") that need to
  // resolve an employee id to a display name without exposing salary/PAN/bank data
  // to roles that shouldn't see the full HR record (TEACHER, LIBRARIAN, STAFF).
  async findAllDirectory(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true, designation: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const emp = await this.prisma.employee.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!emp) throw new NotFoundException('Employee not found');
    return emp;
  }

  async create(dto: CreateEmployeeDTO) {
    const dateOfJoining = dto.dateOfJoining ? new Date(dto.dateOfJoining) : undefined;
    return this.prisma.employee.create({ data: { ...dto, dateOfJoining } as any });
  }

  async update(id: string, companyId: string, dto: UpdateEmployeeDTO) {
    return this.prisma.employee.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    const emp = await this.prisma.employee.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!emp) throw new NotFoundException('Employee not found');
    return this.prisma.employee.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
