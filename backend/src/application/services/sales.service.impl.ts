import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateSalesOrderDTO, UpdateSalesOrderDTO } from '@easy-books/shared';

@Injectable()
export class SalesServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.salesOrder.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.salesOrder.findFirst({ where: { id, companyId } });
  }

  async create(dto: CreateSalesOrderDTO) {
    return this.prisma.salesOrder.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateSalesOrderDTO) {
    return this.prisma.salesOrder.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    return this.prisma.salesOrder.delete({ where: { id } });
  }
}
