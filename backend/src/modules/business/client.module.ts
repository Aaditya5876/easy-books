import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { ClientController } from '../../adapter/input/api/v1/client.controller';
import { ClientServiceImpl } from '../../application/services/client.service.impl';
import { LedgerPostingService } from '../../application/services/ledger-posting.service';
import { PartyStatementService } from '../../application/services/party-statement.service';

@Module({
  controllers: [ClientController],
  providers: [PrismaService, ClientServiceImpl, LedgerPostingService, PartyStatementService],
})
export class ClientModule {}
