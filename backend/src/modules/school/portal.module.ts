import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { PortalController } from '../../adapter/input/api/v1/portal.controller';
import { PortalService } from '../../application/services/portal.service';
import { PaymentService } from '../../application/services/payment.service';
import { SchoolFinanceService } from '../../application/services/school-finance.service';
import { LedgerPostingService } from '../../application/services/ledger-posting.service';
import { PortalGuard } from '../guards/portal.guard';
import { NotificationModule } from '../communication/notification.module';

@Module({
  imports: [JwtModule.register({}), NotificationModule],
  controllers: [PortalController],
  providers: [PrismaService, PortalService, PaymentService, SchoolFinanceService, LedgerPostingService, PortalGuard],
})
export class PortalModule {}
