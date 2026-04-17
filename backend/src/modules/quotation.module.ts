import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { QuotationController } from '../adapter/input/api/v1/quotation.controller';
import { QuotationServiceImpl } from '../application/services/quotation.service.impl';

@Module({
  controllers: [QuotationController],
  providers: [PrismaService, QuotationServiceImpl],
})
export class QuotationModule {}
