import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { validateEnv } from '../../core/config';
import { PinoLoggerModule } from '../../core/utils/logger';
import { BullRootModule } from '../../core/queue/bull.client';
import { AuthModule } from './identity-admin/auth.module';
import { CompanyModule } from './identity-admin/company.module';
import { UserModule } from './identity-admin/user.module';
import { AuditLogModule } from './identity-admin/audit-log.module';
import { RecycleBinModule } from './identity-admin/recycle-bin.module';
import { EmployeeModule } from './hrms/employee.module';
import { AttendanceModule } from './hrms/attendance.module';
import { LeaveModule } from './hrms/leave.module';
import { PayrollModule } from './hrms/payroll.module';
import { LedgerAccountModule } from './finance/ledger-account.module';
import { LedgerEntryModule } from './finance/ledger-entry.module';
import { TransactionModule } from './finance/transaction.module';
import { BankAccountModule } from './finance/bank-account.module';
import { FinancialInstrumentsModule } from './finance/financial-instruments.module';
import { ReportsModule } from './finance/reports.module';
import { FixedAssetModule } from './finance/fixed-asset.module';
import { NotificationModule } from './communication/notification.module';
import { MemoModule } from './communication/memo.module';
import { InventoryModule } from './inventory/inventory.module';
import { AiModule } from './ai/ai.module';
import { BulkImportModule } from './bulk-import/bulk-import.module';
import { SalesModule } from './business/sales.module';
import { PurchaseModule } from './business/purchase.module';
import { PaymentModule } from './business/payment.module';
import { CreditDebitNoteModule } from './business/credit-debit-note.module';
import { ClientModule } from './business/client.module';
import { VendorModule } from './business/vendor.module';
import { QuotationModule } from './business/quotation.module';
import { TaskModule } from './business/task.module';
import { SchoolModule } from './school/school.module';
import { PortalModule } from './school/portal.module';
import { DashboardModule } from './platform/dashboard.module';
import { UploadModule } from './platform/upload.module';
import { ScheduledTasksModule } from './platform/scheduled-tasks.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { CompanyAccessGuard } from './guards/company-access.guard';
import { ModuleAccessGuard } from './guards/module-access.guard';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { PrismaService } from '../../core/db/psql/prisma.client';

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
    PrismaService,
    // Global guards — run on every request in order: Throttler, JWT, Roles,
    // then company-membership scoping, then per-company module licensing
    // (only bites routes tagged @RequiresModule()).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CompanyAccessGuard },
    { provide: APP_GUARD, useClass: ModuleAccessGuard },
    // Runs after the guards above (so req.user is already populated) — logs
    // every non-GET request as an audit trail entry. See AuditLogInterceptor.
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}
