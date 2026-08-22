import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { PaymentServiceImpl } from '../../application/services/payment.service.impl';
import { PaymentController } from '../../adapter/input/api/v1/payment.controller';

@Module({
  controllers: [PaymentController],
  providers: [PrismaService, PaymentServiceImpl],
  exports: [PaymentServiceImpl],
})
export class PaymentModule {}
