import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { ReportsController } from '../../adapter/input/api/v1/reports.controller';
import { ReportsService } from '../../application/services/reports.service';
import { FiscalYearController } from '../../adapter/input/api/v1/fiscal-year.controller';
import { FiscalYearService } from '../../application/services/fiscal-year.service';
import { LedgerPostingService } from '../../application/services/ledger-posting.service';
import { NotificationServiceImpl } from '../../application/services/notification.service.impl';

@Module({
  controllers: [ReportsController, FiscalYearController],
  providers: [PrismaService, ReportsService, FiscalYearService, LedgerPostingService, NotificationServiceImpl],
})
export class ReportsModule {}
