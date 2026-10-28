import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { ScheduledTasksService } from '../../application/services/scheduled-tasks.service';
import { CronController } from '../../adapter/input/api/v1/cron.controller';
import { SchoolModule } from '../school/school.module';
import { PayrollModule } from '../hrms/payroll.module';
import { NotificationModule } from '../communication/notification.module';

@Module({
  imports: [SchoolModule, PayrollModule, NotificationModule],
  controllers: [CronController],
  providers: [PrismaService, ScheduledTasksService],
})
export class ScheduledTasksModule {}
