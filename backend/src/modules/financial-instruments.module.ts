import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { ChequeServiceImpl } from '../application/services/cheque.service.impl';
import { BankGuaranteeServiceImpl } from '../application/services/bank-guarantee.service.impl';
import { PettyCashServiceImpl } from '../application/services/petty-cash.service.impl';
import { LedgerPostingService } from '../application/services/ledger-posting.service';
import { ChequeController } from '../adapter/input/api/v1/cheque.controller';
import { BankGuaranteeController } from '../adapter/input/api/v1/bank-guarantee.controller';
import { PettyCashController } from '../adapter/input/api/v1/petty-cash.controller';
import { TransactionModule } from './transaction.module';

@Module({
  imports: [TransactionModule],
  controllers: [ChequeController, BankGuaranteeController, PettyCashController],
  providers: [PrismaService, LedgerPostingService, ChequeServiceImpl, BankGuaranteeServiceImpl, PettyCashServiceImpl],
  exports: [ChequeServiceImpl, BankGuaranteeServiceImpl, PettyCashServiceImpl],
})
export class FinancialInstrumentsModule {}
