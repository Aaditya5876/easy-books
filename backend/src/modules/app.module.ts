import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { validateEnv } from '../../core/config';
import { PinoLoggerModule } from '../../core/utils/logger';
import { BullRootModule } from '../../core/queue/bull.client';
import { AuthModule } from './auth.module';
import { CompanyModule } from './company.module';
import { InventoryModule } from './inventory.module';
import { SalesModule } from './sales.module';
import { PurchaseModule } from './purchase.module';
import { PaymentModule } from './payment.module';
import { CreditDebitNoteModule } from './credit-debit-note.module';
import { EmployeeModule } from './employee.module';
import { AttendanceModule } from './attendance.module';
import { LeaveModule } from './leave.module';
import { PayrollModule } from './payroll.module';
import { LedgerAccountModule } from './ledger-account.module';
import { LedgerEntryModule } from './ledger-entry.module';
import { TransactionModule } from './transaction.module';
import { BankAccountModule } from './bank-account.module';
import { FinancialInstrumentsModule } from './financial-instruments.module';
import { ClientModule } from './client.module';
import { VendorModule } from './vendor.module';
import { QuotationModule } from './quotation.module';
import { MemoModule } from './memo.module';
import { TaskModule } from './task.module';
import { UserModule } from './user.module';
import { DashboardModule } from './dashboard.module';
import { NotificationModule } from './notification.module';
import { UploadModule } from './upload.module';
import { RecycleBinModule } from './recycle-bin.module';
import { SchoolModule } from './school.module';
import { PortalModule } from './portal.module';
import { AiModule } from './ai.module';
import { BulkImportModule } from './bulk-import.module';
import { AuditLogModule } from './audit-log.module';
import { ReportsModule } from './reports.module';
import { FixedAssetModule } from './fixed-asset.module';
import { ScheduledTasksModule } from './scheduled-tasks.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    PinoLoggerModule,
    BullRootModule,
    AuthModule,
    CompanyModule,
    InventoryModule,
    SalesModule,
    PurchaseModule,
    PaymentModule,
    CreditDebitNoteModule,
    EmployeeModule,
    AttendanceModule,
    LeaveModule,
    PayrollModule,
    LedgerAccountModule,
    LedgerEntryModule,
    TransactionModule,
    BankAccountModule,
    FinancialInstrumentsModule,
    ClientModule,
    VendorModule,
    QuotationModule,
    MemoModule,
    TaskModule,
    UserModule,
    DashboardModule,
    NotificationModule,
    UploadModule,
    RecycleBinModule,
    SchoolModule,
    PortalModule,
    AiModule,
    BulkImportModule,
    AuditLogModule,
    ReportsModule,
    FixedAssetModule,
    ScheduledTasksModule,
  ],
  providers: [
    // Global guards — run on every request in order: Throttler, JWT, then Roles
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Runs after the guards above (so req.user is already populated) — logs
    // every non-GET request as an audit trail entry. See AuditLogInterceptor.
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}
