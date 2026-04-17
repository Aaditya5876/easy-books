import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateEmployeeDTO, UpdateEmployeeDTO } from '@easy-books/shared';

@Injectable()
export class EmployeeServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.employee.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.employee.findFirst({ where: { id, companyId } });
  }

  async create(dto: CreateEmployeeDTO) {
    return this.prisma.employee.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateEmployeeDTO) {
    return this.prisma.employee.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    return this.prisma.employee.delete({ where: { id } });
  }
}
