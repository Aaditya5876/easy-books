import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { PurchaseController } from '../adapter/input/api/v1/purchase.controller';
import { PurchaseServiceImpl } from '../application/services/purchase.service.impl';
import { LedgerPostingService } from '../application/services/ledger-posting.service';

@Module({
  controllers: [PurchaseController],
  providers: [PrismaService, PurchaseServiceImpl, LedgerPostingService],
  exports: [PurchaseServiceImpl, LedgerPostingService],
})
export class PurchaseModule {}
