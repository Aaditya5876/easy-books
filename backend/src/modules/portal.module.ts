import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { PortalController } from '../adapter/input/api/v1/portal.controller';
import { PortalService } from '../application/services/portal.service';
import { PaymentService } from '../application/services/payment.service';
import { PortalGuard } from './guards/portal.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PortalController],
  providers: [PrismaService, PortalService, PaymentService, PortalGuard],
})
export class PortalModule {}
