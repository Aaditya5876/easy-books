import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { ClientController } from '../adapter/input/api/v1/client.controller';
import { ClientServiceImpl } from '../application/services/client.service.impl';

@Module({
  controllers: [ClientController],
  providers: [PrismaService, ClientServiceImpl],
})
export class ClientModule {}
