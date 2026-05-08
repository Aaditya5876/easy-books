import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { LeaveServiceImpl } from '../application/services/leave.service.impl';
import { LeaveController } from '../adapter/input/api/v1/leave.controller';

@Module({
  controllers: [LeaveController],
  providers: [PrismaService, LeaveServiceImpl],
  exports: [LeaveServiceImpl],
})
export class LeaveModule {}
