import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { LedgerAccountController } from '../adapter/input/api/v1/ledger-account.controller';
import { LedgerAccountServiceImpl } from '../application/services/ledger-account.service.impl';

@Module({
  controllers: [LedgerAccountController],
  providers: [PrismaService, LedgerAccountServiceImpl],
})
export class LedgerAccountModule {}
