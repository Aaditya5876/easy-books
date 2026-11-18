// Purchase / sales bill money helpers — shared by the Purchase and Sales
// pages, the Record Payment dialog and the vendor/client statements.

// CASH posts to "Cash in Hand"; every other method to "Bank Account".
export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'QR'];

export const round2 = (v) => Math.round(Number(v || 0) * 100) / 100;

export function billDue(row) {
  return Math.max(0, round2(Number(row?.total_amount || 0) - Number(row?.paid_amount || 0)));
}

// PENDING (nothing paid) | PARTIAL | PAID | CANCELLED — read from the money.
export function billStatusKey(row) {
  if (row?.status === 'CANCELLED') return 'CANCELLED';
  const paid = Number(row?.paid_amount || 0);
  if (paid <= 0.005) return 'PENDING';
  return billDue(row) <= 0.005 ? 'PAID' : 'PARTIAL';
}

// `payNow` = { mode: 'CREDIT' | 'FULL' | 'PARTIAL', method, amount, reference }
export function validatePayNow(payNow, total) {
  if (!payNow || payNow.mode === 'CREDIT') return null;
  if (!payNow.method) return 'methodRequired';
  if (payNow.mode === 'PARTIAL') {
    const amount = Number(payNow.amount);
    if (payNow.amount === '' || !Number.isFinite(amount) || amount <= 0) return 'amountRequired';
    if (amount > round2(total) + 0.005) return 'amountTooHigh';
  }
  return null;
}

export function buildPayNow(payNow) {
  if (!payNow || payNow.mode === 'CREDIT') return { type: 'CREDIT' };
  const reference = String(payNow.reference || '').trim();
  return {
    type: payNow.mode,
    ...(payNow.mode === 'PARTIAL' ? { amount: round2(payNow.amount) } : {}),
    paymentMethod: payNow.method,
    ...(reference ? { referenceNumber: reference } : {}),
  };
}

// `payment` = { amount, method, date, reference }
export function validatePayment(payment, due) {
  const amount = Number(payment?.amount);
  if (payment?.amount === '' || !Number.isFinite(amount) || amount <= 0) return 'amountRequired';
  if (amount > round2(due) + 0.005) return 'amountTooHigh';
  if (!payment?.method) return 'methodRequired';
  if (!payment?.date) return 'dateRequired';
  return null;
}

const normalise = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

// The saved vendor/client picked from the dropdown — but only while the name
// field still shows that party. If the user picked one and then typed another
// name, the server links (or creates) by the typed name instead.
export function partyPayload(selectedId, typedName, saved) {
  const party = selectedId ? (saved || []).find((p) => p.id === selectedId) : null;
  return { id: party && normalise(party.name) === normalise(typedName) ? party.id : undefined };
}

export function apiErrorMessage(err, fallback) {
  const msg = err?.response?.data?.message;
  if (typeof msg === 'string' && msg) return msg;
  if (Array.isArray(msg) && msg.length) return msg.join(', ');
  const fields = msg?.fieldErrors;
  if (fields && typeof fields === 'object') {
    const parts = Object.entries(fields).map(([k, v]) => `${k}: ${[].concat(v).join(', ')}`);
    if (parts.length) return parts.join('; ');
  }
  return fallback;
}
