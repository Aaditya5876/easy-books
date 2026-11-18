import { describe, it, expect } from 'vitest';
import { billDue, billStatusKey, buildPayNow, validatePayNow, validatePayment, apiErrorMessage, partyPayload } from './bills';

describe('billDue', () => {
  it('is total minus paid, never below 0, rounded to paisa', () => {
    expect(billDue({ total_amount: 50000, paid_amount: 20000 })).toBe(30000);
    expect(billDue({ total_amount: '1130.10', paid_amount: '1000.05' })).toBe(130.05);
    expect(billDue({ total_amount: 100, paid_amount: 100 })).toBe(0);
    expect(billDue({ total_amount: 100 })).toBe(100);
  });
});

describe('billStatusKey', () => {
  it('follows the money, not the stored label', () => {
    expect(billStatusKey({ status: 'PENDING', total_amount: 100, paid_amount: 0 })).toBe('PENDING');
    expect(billStatusKey({ status: 'PARTIALLY_PAID', total_amount: 100, paid_amount: 40 })).toBe('PARTIAL');
    expect(billStatusKey({ status: 'COMPLETED', total_amount: 100, paid_amount: 100 })).toBe('PAID');
    expect(billStatusKey({ status: 'CANCELLED', total_amount: 100, paid_amount: 0 })).toBe('CANCELLED');
  });
});

describe('validatePayNow / buildPayNow', () => {
  it('udharo needs nothing and sends CREDIT', () => {
    expect(validatePayNow({ mode: 'CREDIT' }, 500)).toBeNull();
    expect(buildPayNow({ mode: 'CREDIT', method: 'CASH', amount: 99 })).toEqual({ type: 'CREDIT' });
  });
  it('paid in full sends the method, not an amount (the server uses its own total)', () => {
    expect(validatePayNow({ mode: 'FULL', method: 'CASH' }, 500)).toBeNull();
    expect(buildPayNow({ mode: 'FULL', method: 'BANK_TRANSFER', reference: ' TXN-1 ' })).toEqual({ type: 'FULL', paymentMethod: 'BANK_TRANSFER', referenceNumber: 'TXN-1' });
  });
  it('part paid needs an amount above 0 and not above the total', () => {
    expect(validatePayNow({ mode: 'PARTIAL', method: 'CASH', amount: '' }, 500)).toBe('amountRequired');
    expect(validatePayNow({ mode: 'PARTIAL', method: 'CASH', amount: 0 }, 500)).toBe('amountRequired');
    expect(validatePayNow({ mode: 'PARTIAL', method: 'CASH', amount: -5 }, 500)).toBe('amountRequired');
    expect(validatePayNow({ mode: 'PARTIAL', method: 'CASH', amount: 501 }, 500)).toBe('amountTooHigh');
    expect(validatePayNow({ mode: 'PARTIAL', method: 'CASH', amount: 200 }, 500)).toBeNull();
    expect(buildPayNow({ mode: 'PARTIAL', method: 'QR', amount: '200' })).toEqual({ type: 'PARTIAL', amount: 200, paymentMethod: 'QR' });
  });
  it('paying now needs a method', () => {
    expect(validatePayNow({ mode: 'FULL', method: '' }, 500)).toBe('methodRequired');
  });
});

describe('validatePayment (record a payment later)', () => {
  it('amount above 0 and within the due; a date and method are required', () => {
    const ok = { amount: 300, method: 'CASH', date: '2026-11-18' };
    expect(validatePayment(ok, 300)).toBeNull();
    expect(validatePayment({ ...ok, amount: 0 }, 300)).toBe('amountRequired');
    expect(validatePayment({ ...ok, amount: 300.01 }, 300)).toBe('amountTooHigh');
    expect(validatePayment({ ...ok, date: '' }, 300)).toBe('dateRequired');
    expect(validatePayment({ ...ok, method: '' }, 300)).toBe('methodRequired');
  });
});

describe('partyPayload', () => {
  it('sends the saved vendor/client id only when the name still matches it', () => {
    const saved = [{ id: 'v1', name: 'Ram Traders' }];
    expect(partyPayload('v1', 'Ram Traders', saved)).toEqual({ id: 'v1' });
    expect(partyPayload('v1', '  ram traders ', saved)).toEqual({ id: 'v1' });
    // Picked Ram, then typed someone else: let the server match/create by name.
    expect(partyPayload('v1', 'Gita Suppliers', saved)).toEqual({ id: undefined });
    expect(partyPayload('', 'Gita', saved)).toEqual({ id: undefined });
  });
});

describe('apiErrorMessage', () => {
  it('reads the server message in its different shapes', () => {
    expect(apiErrorMessage({ response: { data: { message: 'Payment is more than the amount due (30)' } } }, 'x')).toBe('Payment is more than the amount due (30)');
    expect(apiErrorMessage({ response: { data: { message: ['a', 'b'] } } }, 'x')).toBe('a, b');
    expect(apiErrorMessage({ response: { data: { message: { fieldErrors: { openingBalance: ['Too small'] } } } } }, 'x')).toBe('openingBalance: Too small');
    expect(apiErrorMessage(new Error('Network Error'), 'Could not save')).toBe('Could not save');
  });
});
