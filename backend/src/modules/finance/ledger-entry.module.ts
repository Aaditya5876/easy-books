import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { LedgerEntryController } from '../../adapter/input/api/v1/ledger-entry.controller';
import { LedgerEntryServiceImpl } from '../../application/services/ledger-entry.service.impl';
import { LedgerPostingService } from '../../application/services/ledger-posting.service';

@Module({
  controllers: [LedgerEntryController],
  providers: [PrismaService, LedgerEntryServiceImpl, LedgerPostingService],
})
export class LedgerEntryModule {}
