import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '../../core/config';
import { PinoLoggerModule } from '../../core/utils/logger';
import { BullRootModule } from '../../core/queue/bull.client';
import { AuthModule } from './auth.module';
import { CompanyModule } from './company.module';
import { InventoryModule } from './inventory.module';
import { SalesModule } from './sales.module';
import { PurchaseModule } from './purchase.module';
import { EmployeeModule } from './employee.module';
import { AttendanceModule } from './attendance.module';
import { PayrollModule } from './payroll.module';
import { LedgerAccountModule } from './ledger-account.module';
import { LedgerEntryModule } from './ledger-entry.module';
import { TransactionModule } from './transaction.module';
import { ClientModule } from './client.module';
import { VendorModule } from './vendor.module';
import { QuotationModule } from './quotation.module';
import { MemoModule } from './memo.module';
import { BankAccountModule } from './bank-account.module';
import { TaskModule } from './task.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PinoLoggerModule,
    BullRootModule,
    AuthModule,
    CompanyModule,
    InventoryModule,
    SalesModule,
    PurchaseModule,
    EmployeeModule,
    AttendanceModule,
    PayrollModule,
    LedgerAccountModule,
    LedgerEntryModule,
    TransactionModule,
    ClientModule,
    VendorModule,
    QuotationModule,
    MemoModule,
    BankAccountModule,
    TaskModule,
  ],
})
export class AppModule {}
