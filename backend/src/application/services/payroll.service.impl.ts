import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreatePayrollDTO, UpdatePayrollDTO } from '@easy-books/shared';

@Injectable()
export class PayrollServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, month?: string) {
    return this.prisma.payroll.findMany({
      where: { companyId, ...(month ? { month } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.payroll.findFirst({ where: { id, companyId } });
  }

  async create(dto: CreatePayrollDTO) {
    return this.prisma.payroll.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdatePayrollDTO) {
    return this.prisma.payroll.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    return this.prisma.payroll.delete({ where: { id } });
  }
}
