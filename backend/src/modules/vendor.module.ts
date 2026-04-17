import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { VendorController } from '../adapter/input/api/v1/vendor.controller';
import { VendorServiceImpl } from '../application/services/vendor.service.impl';

@Module({
  controllers: [VendorController],
  providers: [PrismaService, VendorServiceImpl],
})
export class VendorModule {}
