import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { UserController } from '../../adapter/input/api/v1/user.controller';
import { UserServiceImpl } from '../../application/services/user.service.impl';
import { MailService } from '../../application/services/mail.service';
import { SubscriptionModule } from './subscription.module';

@Module({
  imports: [SubscriptionModule],
  controllers: [UserController],
  providers: [PrismaService, MailService, UserServiceImpl],
  exports: [UserServiceImpl],
})
export class UserModule {}
