import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { AuditLogController } from '../../adapter/input/api/v1/audit-log.controller';
import { AuditLogService } from '../../application/services/audit-log.service';

@Module({
  controllers: [AuditLogController],
  providers: [PrismaService, AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
