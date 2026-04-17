import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { TransactionController } from '../adapter/input/api/v1/transaction.controller';
import { TransactionServiceImpl } from '../application/services/transaction.service.impl';

@Module({
  controllers: [TransactionController],
  providers: [PrismaService, TransactionServiceImpl],
})
export class TransactionModule {}
