import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { SchoolController } from '../adapter/input/api/v1/school.controller';
import { SchoolService } from '../application/services/school.service';
import { SchoolAnalyticsService } from '../application/services/school-analytics.service';
import { SmsService } from '../application/services/sms.service';
import { AiService } from '../application/services/ai.service';

@Module({
  controllers: [SchoolController],
  providers: [PrismaService, SchoolService, SchoolAnalyticsService, SmsService, AiService],
})
export class SchoolModule {}
