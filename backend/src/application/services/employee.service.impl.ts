import { Prisma } from '@prisma/client';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { assertTaskLink } from '../../../core/utils/task-link';
import { CreateEmployeeDTO, UpdateEmployeeDTO } from '@easy-books/shared';

@Injectable()
export class EmployeeServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  // Case/whitespace-insensitive duplicate guard — the DB unique index on
  // (companyId, employeeId) is case-sensitive and doesn't trim, so
  // "EMP-001"/"emp-001"/"EMP-001 " would otherwise all slide through as
  // separate employees instead of colliding. Deliberately does NOT filter by
  // deletedAt: the DB index isn't partial either — a soft-deleted employee's
  // ID still collides at the DB level, so this must match that or callers get
  // a raw unhandled P2002 instead of this friendly message.
  private async assertEmployeeIdFree(companyId: string, employeeId: string, excludeId?: string) {
    const existing = await this.prisma.employee.findFirst({
      where: {
        companyId,
        employeeId: { equals: employeeId, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existing) throw new ConflictException(`Employee ID "${employeeId}" is already in use`);
  }

  async findAll(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Name-only listing for pickers/labels (e.g. "assign class teacher") that need to
  // resolve an employee id to a display name without exposing salary/PAN/bank data
  // to roles that shouldn't see the full HR record (TEACHER, plain STAFF).
  async findAllDirectory(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true, designation: true, department: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const emp = await this.prisma.employee.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!emp) throw new NotFoundException('Employee not found');
    return emp;
  }

  async create(dto: CreateEmployeeDTO) {
    await assertTaskLink(this.prisma, dto.companyId, dto.taskId);
    const name = dto.name?.trim();
    const typed = dto.employeeId?.trim();
    const dateOfJoining = dto.dateOfJoining ? new Date(dto.dateOfJoining) : undefined;
    if (typed) {
      await this.assertEmployeeIdFree(dto.companyId, typed);
      return this.prisma.employee.create({ data: { ...dto, name, employeeId: typed, dateOfJoining } as any });
    }
    // No ID typed: the next free EMP-number. A clash with a simultaneous save
    // (unique companyId+employeeId) just takes the following number.
    for (let attempt = 0; ; attempt++) {
      const employeeId = await this.nextEmployeeId(dto.companyId);
      try {
        return await this.prisma.employee.create({ data: { ...dto, name, employeeId, dateOfJoining } as any });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') || attempt >= 4) throw err;
      }
    }
  }

  // After the highest existing EMP-#### (not the count, so gaps and typed
  // numbers never cause a clash).
  private async nextEmployeeId(companyId: string) {
    const rows = await this.prisma.employee.findMany({
      where: { companyId, employeeId: { startsWith: 'EMP-', mode: 'insensitive' } },
      select: { employeeId: true },
    });
    const max = rows.reduce((m, r) => Math.max(m, Number(/^EMP-(\d+)$/i.exec(r.employeeId)?.[1] ?? 0)), 0);
    return `EMP-${String(max + 1).padStart(4, '0')}`;
  }

  async update(id: string, companyId: string, dto: UpdateEmployeeDTO) {
    const existing = await this.prisma.employee.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Employee not found');
    await assertTaskLink(this.prisma, companyId, dto.taskId);
    // A blank ID on edit keeps the current one (it can't be removed).
    const employeeId = dto.employeeId?.trim() || undefined;
    if (employeeId !== undefined) {
      await this.assertEmployeeIdFree(companyId, employeeId, id);
    }
    const name = dto.name?.trim();
    const { employeeId: _typedId, ...rest } = dto;
    return this.prisma.employee.update({ where: { id }, data: { ...rest, ...(name !== undefined ? { name } : {}), ...(employeeId !== undefined ? { employeeId } : {}) } as any });
  }

  async remove(id: string, companyId: string) {
    const emp = await this.prisma.employee.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!emp) throw new NotFoundException('Employee not found');
    return this.prisma.employee.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
