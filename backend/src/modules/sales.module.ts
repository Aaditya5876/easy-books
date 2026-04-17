import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { SalesController } from '../adapter/input/api/v1/sales.controller';
import { SalesServiceImpl } from '../application/services/sales.service.impl';

@Module({
  controllers: [SalesController],
  providers: [PrismaService, SalesServiceImpl],
})
export class SalesModule {}
