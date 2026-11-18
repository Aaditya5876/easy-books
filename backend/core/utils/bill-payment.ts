import { BadRequestException } from '@nestjs/common';

// Payments against a purchase or sales bill. CASH posts to "Cash in Hand";
// every other method is money through the bank and posts to "Bank Account"
// (see LedgerPostingService.postPaymentMade / postPaymentReceived).
export const BILL_PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'QR'] as const;
export type BillPaymentMethod = (typeof BILL_PAYMENT_METHODS)[number];

export interface BillPayment {
  amount: number;
  paymentMethod: BillPaymentMethod;
  dateAd: Date;
  referenceNumber?: string;
  notes?: string;
}

// What the bill form chose: udharo (nothing paid yet), paid in full, or part paid.
export type PayNow =
  | { type: 'CREDIT' }
  | { type: 'FULL'; paymentMethod: BillPaymentMethod; referenceNumber?: string }
  | { type: 'PARTIAL'; amount: number; paymentMethod: BillPaymentMethod; referenceNumber?: string };

const EPSILON = 0.005;
export const round2 = (v: number) => Math.round(v * 100) / 100;

export function parseAmount(raw: unknown): number {
  const amount = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Payment amount must be more than 0');
  return round2(amount);
}

export function parseMethod(raw: unknown): BillPaymentMethod {
  if (typeof raw !== 'string' || !(BILL_PAYMENT_METHODS as readonly string[]).includes(raw)) {
    throw new BadRequestException(`Payment method must be one of ${BILL_PAYMENT_METHODS.join(', ')}`);
  }
  return raw as BillPaymentMethod;
}

export function parseDate(raw: unknown, label = 'Payment date'): Date {
  const date = typeof raw === 'string' && raw.trim() !== '' ? new Date(raw) : raw instanceof Date ? raw : null;
  if (!date || Number.isNaN(date.getTime())) throw new BadRequestException(`${label} is required`);
  return date;
}

const optionalText = (raw: unknown) => (typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined);

// Body of POST /purchases/:id/payment and /sales/:id/payment.
export function parseBillPayment(dto: Record<string, unknown>): BillPayment {
  return {
    amount: parseAmount(dto.amount),
    paymentMethod: parseMethod(dto.paymentMethod),
    dateAd: parseDate(dto.dateAd),
    referenceNumber: optionalText(dto.referenceNumber),
    notes: optionalText(dto.notes),
  };
}

// `payment` on a new bill. Missing = udharo, the same as before this option existed.
export function parsePayNow(raw: unknown): PayNow {
  if (raw === undefined || raw === null) return { type: 'CREDIT' };
  if (typeof raw !== 'object') throw new BadRequestException('Invalid payment choice');
  const p = raw as Record<string, unknown>;
  const referenceNumber = optionalText(p.referenceNumber);
  switch (p.type) {
    case 'CREDIT':
      return { type: 'CREDIT' };
    case 'FULL':
      return { type: 'FULL', paymentMethod: parseMethod(p.paymentMethod), referenceNumber };
    case 'PARTIAL':
      return { type: 'PARTIAL', amount: parseAmount(p.amount), paymentMethod: parseMethod(p.paymentMethod), referenceNumber };
    default:
      throw new BadRequestException('Payment must be CREDIT (udharo), FULL or PARTIAL');
  }
}

// How much of a new bill is paid on the spot (0 for udharo).
export function payNowAmount(payNow: PayNow, totalAmount: number): number {
  if (payNow.type === 'CREDIT') return 0;
  if (payNow.type === 'FULL') return round2(totalAmount);
  if (payNow.amount > totalAmount + EPSILON) {
    throw new BadRequestException(`Amount paid (${payNow.amount}) is more than the bill total (${round2(totalAmount)})`);
  }
  return payNow.amount;
}

// Status always follows the money: nothing paid → PENDING, some → PARTIALLY_PAID, all → COMPLETED.
export function billStatus(paid: number, total: number): 'PENDING' | 'PARTIALLY_PAID' | 'COMPLETED' {
  if (paid <= EPSILON) return 'PENDING';
  return paid >= total - EPSILON ? 'COMPLETED' : 'PARTIALLY_PAID';
}

export function assertWithinDue(alreadyPaid: number, amount: number, total: number) {
  const due = round2(total - alreadyPaid);
  if (alreadyPaid + amount > total + EPSILON) {
    throw new BadRequestException(due <= EPSILON ? 'This bill is already fully paid' : `Payment is more than the amount due (${due})`);
  }
}
