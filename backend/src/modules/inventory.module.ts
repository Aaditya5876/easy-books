import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { InventoryController } from '../adapter/input/api/v1/inventory.controller';
import { InventoryServiceImpl } from '../application/services/inventory.service.impl';

@Module({
  controllers: [InventoryController],
  providers: [PrismaService, InventoryServiceImpl],
})
export class InventoryModule {}
