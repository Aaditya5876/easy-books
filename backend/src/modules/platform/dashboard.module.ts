import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { DashboardController } from '../../adapter/input/api/v1/dashboard.controller';
import { DashboardServiceImpl } from '../../application/services/dashboard.service.impl';

@Module({
  controllers: [DashboardController],
  providers: [PrismaService, DashboardServiceImpl],
  exports: [DashboardServiceImpl],
})
export class DashboardModule {}
