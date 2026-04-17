import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateInventoryItemDTO, UpdateInventoryItemDTO } from '@easy-books/shared';

@Injectable()
export class InventoryServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.inventoryItem.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.inventoryItem.findFirst({ where: { id, companyId } });
  }

  async create(dto: CreateInventoryItemDTO) {
    return this.prisma.inventoryItem.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateInventoryItemDTO) {
    return this.prisma.inventoryItem.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    return this.prisma.inventoryItem.delete({ where: { id } });
  }
}
