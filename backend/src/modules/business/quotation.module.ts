import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { QuotationController } from '../../adapter/input/api/v1/quotation.controller';
import { QuotationServiceImpl } from '../../application/services/quotation.service.impl';
import { LedgerPostingService } from '../../application/services/ledger-posting.service';

@Module({
  controllers: [QuotationController],
  providers: [PrismaService, LedgerPostingService, QuotationServiceImpl],
  exports: [QuotationServiceImpl],
})
export class QuotationModule {}
