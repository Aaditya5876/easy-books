import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { FixedAssetController } from '../../adapter/input/api/v1/fixed-asset.controller';
import { FixedAssetServiceImpl } from '../../application/services/fixed-asset.service.impl';
import { LedgerPostingService } from '../../application/services/ledger-posting.service';

@Module({
  controllers: [FixedAssetController],
  providers: [PrismaService, FixedAssetServiceImpl, LedgerPostingService],
})
export class FixedAssetModule {}
