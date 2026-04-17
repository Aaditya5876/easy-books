import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { PayrollController } from '../adapter/input/api/v1/payroll.controller';
import { PayrollServiceImpl } from '../application/services/payroll.service.impl';

@Module({
  controllers: [PayrollController],
  providers: [PrismaService, PayrollServiceImpl],
})
export class PayrollModule {}
