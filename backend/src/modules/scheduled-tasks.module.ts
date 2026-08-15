import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { ScheduledTasksService } from '../application/services/scheduled-tasks.service';
import { SchoolModule } from './school.module';
import { PayrollModule } from './payroll.module';

@Module({
  imports: [SchoolModule, PayrollModule],
  providers: [PrismaService, ScheduledTasksService],
})
export class ScheduledTasksModule {}
