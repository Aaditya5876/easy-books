import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { ReportsController } from '../../adapter/input/api/v1/reports.controller';
import { ReportsService } from '../../application/services/reports.service';

@Module({
  controllers: [ReportsController],
  providers: [PrismaService, ReportsService],
})
export class ReportsModule {}
