import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { SubscriptionController } from '../../adapter/input/api/v1/subscription.controller';
import { SubscriptionService } from '../../application/services/subscription.service';
import { NotificationModule } from '../communication/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [SubscriptionController],
  providers: [PrismaService, SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
