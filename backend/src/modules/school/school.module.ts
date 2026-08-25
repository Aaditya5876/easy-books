import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { SchoolController } from '../../adapter/input/api/v1/school.controller';
import { SchoolService } from '../../application/services/school.service';
import { SchoolAnalyticsService } from '../../application/services/school-analytics.service';
import { SchoolFinanceService } from '../../application/services/school-finance.service';
import { LedgerPostingService } from '../../application/services/ledger-posting.service';
import { SmsService } from '../../application/services/sms.service';
import { AiService } from '../../application/services/ai.service';
import { InventoryServiceImpl } from '../../application/services/inventory.service.impl';
import { AttendanceServiceImpl } from '../../application/services/attendance.service.impl';
import { PayrollServiceImpl } from '../../application/services/payroll.service.impl';
import { PortalNotificationService } from '../../application/services/portal-notification.service';
import { NotificationModule } from '../communication/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [SchoolController],
  providers: [
    PrismaService, SchoolService, SchoolAnalyticsService, SchoolFinanceService,
    LedgerPostingService, SmsService, AiService, InventoryServiceImpl,
    AttendanceServiceImpl, PayrollServiceImpl, PortalNotificationService,
  ],
  exports: [SchoolFinanceService, PortalNotificationService],
})
export class SchoolModule {}
