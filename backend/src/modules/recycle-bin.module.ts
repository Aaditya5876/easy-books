import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { RecycleBinServiceImpl } from '../application/services/recycle-bin.service.impl';
import { RecycleBinController } from '../adapter/input/api/v1/recycle-bin.controller';

@Module({
  controllers: [RecycleBinController],
  providers: [PrismaService, RecycleBinServiceImpl],
})
export class RecycleBinModule {}
