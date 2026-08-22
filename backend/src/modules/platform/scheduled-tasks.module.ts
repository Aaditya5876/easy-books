import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { ScheduledTasksService } from '../../application/services/scheduled-tasks.service';
import { SchoolModule } from '../school/school.module';
import { PayrollModule } from '../hrms/payroll.module';
import { NotificationModule } from '../communication/notification.module';

@Module({
  imports: [SchoolModule, PayrollModule, NotificationModule],
  providers: [PrismaService, ScheduledTasksService],
})
export class ScheduledTasksModule {}
