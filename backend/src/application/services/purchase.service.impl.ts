import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreatePurchaseOrderDTO, UpdatePurchaseOrderDTO } from '@easy-books/shared';

@Injectable()
export class PurchaseServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.purchaseOrder.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.purchaseOrder.findFirst({ where: { id, companyId } });
  }

  async create(dto: CreatePurchaseOrderDTO) {
    return this.prisma.purchaseOrder.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdatePurchaseOrderDTO) {
    return this.prisma.purchaseOrder.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    return this.prisma.purchaseOrder.delete({ where: { id } });
  }
}
