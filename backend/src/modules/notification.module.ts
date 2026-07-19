import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { NotificationController } from '../adapter/input/api/v1/notification.controller';
import { NotificationServiceImpl } from '../application/services/notification.service.impl';

@Module({
  controllers: [NotificationController],
  providers: [PrismaService, NotificationServiceImpl],
  exports: [NotificationServiceImpl],
})
export class NotificationModule {}
