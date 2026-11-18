import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { VendorController } from '../../adapter/input/api/v1/vendor.controller';
import { VendorServiceImpl } from '../../application/services/vendor.service.impl';
import { LedgerPostingService } from '../../application/services/ledger-posting.service';
import { PartyStatementService } from '../../application/services/party-statement.service';

@Module({
  controllers: [VendorController],
  providers: [PrismaService, VendorServiceImpl, LedgerPostingService, PartyStatementService],
})
export class VendorModule {}
