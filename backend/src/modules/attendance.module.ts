import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { AttendanceController } from '../adapter/input/api/v1/attendance.controller';
import { AttendanceServiceImpl } from '../application/services/attendance.service.impl';

@Module({
  controllers: [AttendanceController],
  providers: [PrismaService, AttendanceServiceImpl],
})
export class AttendanceModule {}
