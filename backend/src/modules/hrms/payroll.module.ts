import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { QUEUE_NAMES, QUEUES_ENABLED } from '../../../core/queue/bull.client';
import { PayrollController } from '../../adapter/input/api/v1/payroll.controller';
import { PayrollEngineService } from '../../application/services/payroll.engine';
import { PayrollJobHandler } from '../../adapter/input/queue/payroll.job';
import { LedgerPostingService } from '../../application/services/ledger-posting.service';
import { NotificationModule } from '../communication/notification.module';

@Module({
  imports: [
    ...(QUEUES_ENABLED ? [BullModule.registerQueue({ name: QUEUE_NAMES.PAYROLL })] : []),
    NotificationModule,
  ],
  controllers: [PayrollController],
  providers: [
    PrismaService, PayrollEngineService, LedgerPostingService,
    ...(QUEUES_ENABLED ? [PayrollJobHandler] : []),
  ],
  exports: [PayrollEngineService],
})
export class PayrollModule {}
