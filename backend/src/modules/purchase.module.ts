import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { PurchaseController } from '../adapter/input/api/v1/purchase.controller';
import { PurchaseServiceImpl } from '../application/services/purchase.service.impl';

@Module({
  controllers: [PurchaseController],
  providers: [PrismaService, PurchaseServiceImpl],
})
export class PurchaseModule {}
