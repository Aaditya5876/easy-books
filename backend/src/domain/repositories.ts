import { UserEntity } from './entities/user.entity';

// ─── User ───────────────────────────────────────────────────────────────────

export interface IUserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  create(data: Partial<UserEntity>): Promise<UserEntity>;
  updateRefreshToken(id: string, token: string | null): Promise<void>;
}

export const USER_REPOSITORY = Symbol('IUserRepository');

// ─── Company ─────────────────────────────────────────────────────────────────

export const COMPANY_REPOSITORY = Symbol('ICompanyRepository');

export interface ICompanyRepository {
  findById(id: string): Promise<any | null>;
  update(id: string, data: any): Promise<any>;
  incrementSequence(id: string, field: 'invoiceSequence' | 'purchaseSequence' | 'quotationSequence' | 'creditNoteSequence' | 'debitNoteSequence'): Promise<number>;
  getPayrollSettings(companyId: string): Promise<any | null>;
  upsertPayrollSettings(companyId: string, data: any): Promise<any>;
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export const INVENTORY_REPOSITORY = Symbol('IInventoryRepository');

export interface IInventoryRepository {
  findAll(companyId: string): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, companyId: string, data: any): Promise<any>;
  remove(id: string, companyId: string): Promise<void>;
  adjustStock(id: string, delta: number, companyId: string): Promise<void>;
  updateLastPurchasePrice(id: string, price: number, companyId: string): Promise<void>;
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export const SALES_REPOSITORY = Symbol('ISalesRepository');

export interface ISalesRepository {
  findAll(companyId: string, filters?: { status?: string; clientId?: string }): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  create(data: any, items: any[]): Promise<any>;
  update(id: string, companyId: string, data: any): Promise<any>;
  remove(id: string, companyId: string): Promise<void>;
}

// ─── Purchase ────────────────────────────────────────────────────────────────

export const PURCHASE_REPOSITORY = Symbol('IPurchaseRepository');

export interface IPurchaseRepository {
  findAll(companyId: string, filters?: { status?: string; vendorId?: string }): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  create(data: any, items: any[]): Promise<any>;
  update(id: string, companyId: string, data: any): Promise<any>;
  remove(id: string, companyId: string): Promise<void>;
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export const PAYMENT_REPOSITORY = Symbol('IPaymentRepository');

export interface IPaymentRepository {
  findBySalesOrder(salesOrderId: string, companyId: string): Promise<any[]>;
  findByPurchaseOrder(purchaseOrderId: string, companyId: string): Promise<any[]>;
  create(data: any): Promise<any>;
}

// ─── Client ──────────────────────────────────────────────────────────────────

export const CLIENT_REPOSITORY = Symbol('IClientRepository');

export interface IClientRepository {
  findAll(companyId: string): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, companyId: string, data: any): Promise<any>;
  remove(id: string, companyId: string): Promise<void>;
}

// ─── Vendor ──────────────────────────────────────────────────────────────────

export const VENDOR_REPOSITORY = Symbol('IVendorRepository');

export interface IVendorRepository {
  findAll(companyId: string): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, companyId: string, data: any): Promise<any>;
  remove(id: string, companyId: string): Promise<void>;
}

// ─── Employee ────────────────────────────────────────────────────────────────

export const EMPLOYEE_REPOSITORY = Symbol('IEmployeeRepository');

export interface IEmployeeRepository {
  findAll(companyId: string): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  findActive(companyId: string): Promise<any[]>;
  create(data: any): Promise<any>;
  update(id: string, companyId: string, data: any): Promise<any>;
  remove(id: string, companyId: string): Promise<void>;
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export const ATTENDANCE_REPOSITORY = Symbol('IAttendanceRepository');

export interface IAttendanceRepository {
  findAll(companyId: string, filters?: { employeeId?: string; month?: string }): Promise<any[]>;
  upsert(data: any): Promise<any>;
  bulkCreate(records: any[]): Promise<number>;
}

// ─── Leave ───────────────────────────────────────────────────────────────────

export const LEAVE_REPOSITORY = Symbol('ILeaveRepository');

export interface ILeaveRepository {
  findAllTypes(companyId: string): Promise<any[]>;
  createType(data: any): Promise<any>;
  findBalance(employeeId: string, fiscalYear: string): Promise<any[]>;
  upsertBalance(data: any): Promise<any>;
  findRequests(companyId: string, filters?: { employeeId?: string; status?: string }): Promise<any[]>;
  findRequestById(id: string, companyId: string): Promise<any | null>;
  createRequest(data: any): Promise<any>;
  updateRequestStatus(id: string, status: string, approvedBy?: string): Promise<any>;
}

// ─── Payroll ─────────────────────────────────────────────────────────────────

export const PAYROLL_REPOSITORY = Symbol('IPayrollRepository');

export interface IPayrollRepository {
  findAll(companyId: string, month?: string): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  upsert(data: any): Promise<any>;
  markPaid(id: string, companyId: string): Promise<any>;
  setHold(id: string, companyId: string, isOnHold: boolean, reason?: string): Promise<any>;
}

// ─── Ledger ───────────────────────────────────────────────────────────────────

export const LEDGER_ACCOUNT_REPOSITORY = Symbol('ILedgerAccountRepository');

export interface ILedgerAccountRepository {
  findAll(companyId: string): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  findByName(companyId: string, accountName: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, companyId: string, data: any): Promise<any>;
  incrementBalance(id: string, amount: number): Promise<void>;
}

export const LEDGER_ENTRY_REPOSITORY = Symbol('ILedgerEntryRepository');

export interface ILedgerEntryRepository {
  findAll(companyId: string, filters?: { accountId?: string; referenceType?: string; referenceId?: string }): Promise<any[]>;
  create(data: any): Promise<any>;
  bulkCreate(records: any[]): Promise<number>;
}

// ─── Transaction ─────────────────────────────────────────────────────────────

export const TRANSACTION_REPOSITORY = Symbol('ITransactionRepository');

export interface ITransactionRepository {
  findAll(companyId: string, filters?: { type?: string; category?: string }): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, companyId: string, data: any): Promise<any>;
  remove(id: string, companyId: string): Promise<void>;
}

// ─── Bank Account ────────────────────────────────────────────────────────────

export const BANK_ACCOUNT_REPOSITORY = Symbol('IBankAccountRepository');

export interface IBankAccountRepository {
  findAll(companyId: string): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, companyId: string, data: any): Promise<any>;
  remove(id: string, companyId: string): Promise<void>;
  updateBalance(id: string, delta: number): Promise<void>;
}

// ─── Cheque ──────────────────────────────────────────────────────────────────

export const CHEQUE_REPOSITORY = Symbol('IChequeRepository');

export interface IChequeRepository {
  findAll(companyId: string, filters?: { status?: string; isReceivable?: boolean }): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  create(data: any): Promise<any>;
  updateStatus(id: string, companyId: string, status: string): Promise<any>;
}

// ─── Bank Guarantee ──────────────────────────────────────────────────────────

export const BANK_GUARANTEE_REPOSITORY = Symbol('IBankGuaranteeRepository');

export interface IBankGuaranteeRepository {
  findAll(companyId: string, filters?: { status?: string }): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, companyId: string, data: any): Promise<any>;
}

// ─── Petty Cash ──────────────────────────────────────────────────────────────

export const PETTY_CASH_REPOSITORY = Symbol('IPettyCashRepository');

export interface IPettyCashRepository {
  findAll(companyId: string): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  create(data: any): Promise<any>;
  remove(id: string, companyId: string): Promise<void>;
}

// ─── Credit Note ─────────────────────────────────────────────────────────────

export const CREDIT_NOTE_REPOSITORY = Symbol('ICreditNoteRepository');

export interface ICreditNoteRepository {
  findAll(companyId: string): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  create(data: any): Promise<any>;
  updateStatus(id: string, companyId: string, status: string): Promise<any>;
}

// ─── Debit Note ──────────────────────────────────────────────────────────────

export const DEBIT_NOTE_REPOSITORY = Symbol('IDebitNoteRepository');

export interface IDebitNoteRepository {
  findAll(companyId: string): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  create(data: any): Promise<any>;
  updateStatus(id: string, companyId: string, status: string): Promise<any>;
}

// ─── Quotation ───────────────────────────────────────────────────────────────

export const QUOTATION_REPOSITORY = Symbol('IQuotationRepository');

export interface IQuotationRepository {
  findAll(companyId: string): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, companyId: string, data: any): Promise<any>;
  remove(id: string, companyId: string): Promise<void>;
}

// ─── Memo ────────────────────────────────────────────────────────────────────

export const MEMO_REPOSITORY = Symbol('IMemoRepository');

export interface IMemoRepository {
  findAll(companyId: string): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, companyId: string, data: any): Promise<any>;
  remove(id: string, companyId: string): Promise<void>;
}

// ─── Task ────────────────────────────────────────────────────────────────────

export const TASK_REPOSITORY = Symbol('ITaskRepository');

export interface ITaskRepository {
  findAll(companyId: string, filters?: { status?: string; priority?: string }): Promise<any[]>;
  findById(id: string, companyId: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, companyId: string, data: any): Promise<any>;
  remove(id: string, companyId: string): Promise<void>;
}
