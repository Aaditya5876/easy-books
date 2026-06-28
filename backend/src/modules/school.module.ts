import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { SchoolController } from '../adapter/input/api/v1/school.controller';
import { SchoolService } from '../application/services/school.service';

@Module({
  controllers: [SchoolController],
  providers: [PrismaService, SchoolService],
})
export class SchoolModule {}
