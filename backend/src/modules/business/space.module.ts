import { Module } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { SpaceController } from '../../adapter/input/api/v1/space.controller';
import { SpaceService } from '../../application/services/space.service';
import { SalesModule } from './sales.module';

@Module({
  imports: [SalesModule],
  controllers: [SpaceController],
  providers: [PrismaService, SpaceService],
})
export class SpaceModule {}
