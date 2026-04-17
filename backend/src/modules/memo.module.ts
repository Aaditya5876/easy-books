import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { MemoController } from '../adapter/input/api/v1/memo.controller';
import { MemoServiceImpl } from '../application/services/memo.service.impl';

@Module({
  controllers: [MemoController],
  providers: [PrismaService, MemoServiceImpl],
})
export class MemoModule {}
