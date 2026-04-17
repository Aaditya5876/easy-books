import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { BankAccountController } from '../adapter/input/api/v1/bank-account.controller';
import { BankAccountServiceImpl } from '../application/services/bank-account.service.impl';

@Module({
  controllers: [BankAccountController],
  providers: [PrismaService, BankAccountServiceImpl],
})
export class BankAccountModule {}
