import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { EmployeeController } from '../adapter/input/api/v1/employee.controller';
import { EmployeeServiceImpl } from '../application/services/employee.service.impl';

@Module({
  controllers: [EmployeeController],
  providers: [PrismaService, EmployeeServiceImpl],
})
export class EmployeeModule {}
