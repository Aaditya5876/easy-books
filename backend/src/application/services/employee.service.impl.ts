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
