import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { DashboardController } from '../../adapter/input/api/v1/dashboard.controller';
import { DashboardServiceImpl } from '../../application/services/dashboard.service.impl';
import { DashboardOverviewService } from '../../application/services/dashboard-overview.service';

@Module({
  controllers: [DashboardController],
  providers: [PrismaService, DashboardServiceImpl, DashboardOverviewService],
  exports: [DashboardServiceImpl],
})
export class DashboardModule {}
