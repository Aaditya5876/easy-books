export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  ACCOUNTANT = 'ACCOUNTANT',
  STAFF = 'STAFF',
}

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ON_LEAVE = 'ON_LEAVE',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  HALF_DAY = 'HALF_DAY',
  LEAVE = 'LEAVE',
  HOLIDAY = 'HOLIDAY',
}

export enum PayrollStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  PAID = 'PAID',
  ON_HOLD = 'ON_HOLD',
}

export enum PaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHEQUE = 'CHEQUE',
  QR = 'QR',
  CREDIT = 'CREDIT',
}

export enum TransactionType {
  CASH = 'CASH',
  BANK = 'BANK',
  QR = 'QR',
  CHEQUE = 'CHEQUE',
  CREDIT = 'CREDIT',
}

export enum TransactionCategory {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum LedgerAccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ClientStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PROSPECT = 'PROSPECT',
}

export enum QuotationRemark {
  QUOTED = 'QUOTED',
  WORK_DONE = 'WORK_DONE',
  CANCELLED = 'CANCELLED',
  REVISED = 'REVISED',
  BILLED = 'BILLED',
}

export enum QuotationStatus {
  ACTIVE = 'ACTIVE',
  CONVERTED = 'CONVERTED',
  EXPIRED = 'EXPIRED',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum ChequeStatus {
  ISSUED = 'ISSUED',
  DEPOSITED = 'DEPOSITED',
  CLEARED = 'CLEARED',
  BOUNCED = 'BOUNCED',
  CANCELLED = 'CANCELLED',
}

export enum BankGuaranteeStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CLAIMED = 'CLAIMED',
  RELEASED = 'RELEASED',
}

export enum CreditNoteStatus {
  OPEN = 'OPEN',
  APPLIED = 'APPLIED',
  CLOSED = 'CLOSED',
}

export const VAT_RATE = 0.13;

// SSF default rates (Nepal Social Security Fund)
export const SSF_EMPLOYEE_RATE = 0.11; // 11% of basic salary
export const SSF_EMPLOYER_RATE = 0.20; // 20% of basic salary

// PIT slabs (Nepal Personal Income Tax — married/unmarried)
// These are approximate — exact slabs are per IRD Nepal
export const PIT_SLABS_UNMARRIED = [
  { upTo: 500000, rate: 0.01 },
  { upTo: 700000, rate: 0.10 },
  { upTo: 1000000, rate: 0.20 },
  { upTo: 2000000, rate: 0.30 },
  { upTo: Infinity, rate: 0.36 },
];

export const PIT_SLABS_MARRIED = [
  { upTo: 600000, rate: 0.01 },
  { upTo: 800000, rate: 0.10 },
  { upTo: 1100000, rate: 0.20 },
  { upTo: 2100000, rate: 0.30 },
  { upTo: Infinity, rate: 0.36 },
];
