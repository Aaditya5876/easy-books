import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { CompanyController } from '../adapter/input/api/v1/company.controller';
import { CompanyServiceImpl } from '../application/services/company.service.impl';

@Module({
  controllers: [CompanyController],
  providers: [PrismaService, CompanyServiceImpl],
})
export class CompanyModule {}
