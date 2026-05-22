import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateInventoryItemDTO, UpdateInventoryItemDTO, adToBs } from '@easy-books/shared';

interface AdjustInventoryInput {
  adjustmentType: 'ADDITION' | 'SUBTRACTION' | 'RECOUNT';
  quantityChange: number;
  reason?: string;
  adjustedBy?: string;
}

@Injectable()
export class InventoryServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.inventoryItem.findFirst({ where: { id, companyId, deletedAt: null } });
  }

  async create(dto: CreateInventoryItemDTO) {
    return this.prisma.inventoryItem.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateInventoryItemDTO) {
    return this.prisma.inventoryItem.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!item) throw new NotFoundException('Inventory item not found');
    return this.prisma.inventoryItem.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async adjust(id: string, companyId: string, dto: AdjustInventoryInput) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, companyId } });
    if (!item) throw new NotFoundException('Inventory item not found');

    const quantityBefore = Number(item.quantity);
    let quantityAfter: number;

    if (dto.adjustmentType === 'RECOUNT') {
      if (dto.quantityChange < 0) throw new BadRequestException('RECOUNT quantity must be non-negative');
      quantityAfter = dto.quantityChange;
    } else if (dto.adjustmentType === 'ADDITION') {
      quantityAfter = quantityBefore + dto.quantityChange;
    } else {
      quantityAfter = quantityBefore - dto.quantityChange;
      if (quantityAfter < 0) throw new BadRequestException('Adjustment would result in negative stock');
    }

    const quantityChange = quantityAfter - quantityBefore;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.inventoryAdjustment.create({
        data: {
          companyId,
          inventoryItemId: id,
          adjustmentType: dto.adjustmentType,
          quantityBefore,
          quantityChange,
          quantityAfter,
          reason: dto.reason,
          adjustedBy: dto.adjustedBy,
          dateAd: now,
          dateBs: adToBs(now),
        },
      });

      await tx.inventoryItem.update({
        where: { id },
        data: { quantity: quantityAfter },
      });

      return adjustment;
    });
  }

  async getAdjustments(id: string, companyId: string) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, companyId } });
    if (!item) throw new NotFoundException('Inventory item not found');

    return this.prisma.inventoryAdjustment.findMany({
      where: { inventoryItemId: id, companyId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
