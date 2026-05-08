import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { CreditNoteServiceImpl } from '../application/services/credit-note.service.impl';
import { DebitNoteServiceImpl } from '../application/services/debit-note.service.impl';
import { CreditNoteController } from '../adapter/input/api/v1/credit-note.controller';
import { DebitNoteController } from '../adapter/input/api/v1/debit-note.controller';

@Module({
  controllers: [CreditNoteController, DebitNoteController],
  providers: [PrismaService, CreditNoteServiceImpl, DebitNoteServiceImpl],
  exports: [CreditNoteServiceImpl, DebitNoteServiceImpl],
})
export class CreditDebitNoteModule {}
