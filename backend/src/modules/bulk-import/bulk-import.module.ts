import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { BulkImportController } from '../../adapter/input/api/v1/bulk-import.controller';
import { BulkImportService } from '../../application/services/bulk-import.service';

@Module({
  controllers: [BulkImportController],
  providers: [PrismaService, BulkImportService],
})
export class BulkImportModule {}
