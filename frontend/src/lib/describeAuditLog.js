// Turns a raw audit log row (module path + action + redacted request body) into
// one plain-language sentence — the Audit Log page is read by ADMIN users, not
// developers, so "ledger/accounts/toggle-hidden" + a JSON blob means nothing to
// them, but "hid a Ledger Account" does.

const ACTION_VERB = { CREATE: 'created', UPDATE: 'updated', DELETE: 'deleted' };

// Modules whose plain meaning isn't "created/updated/deleted a record" — these
// fully replace the generated sentence instead of just naming the "what".
const SENTENCE_OVERRIDES = {
  'auth/login': (who) => `${who} logged in`,
  'auth/logout': (who) => `${who} logged out`,
  'auth/register': (who) => `${who} created an account`,
  'auth/change-password': (who) => `${who} changed their password`,
  'auth/refresh': (who) => `${who}'s session was refreshed`,
  'ledger/accounts/toggle-hidden': (who) => `${who} hid or unhid a Ledger Account`,
  'ledger/accounts/hidden/search': (who) => `${who} looked up a hidden account`,
};

// Human name for the "what" — used as "{who} {verb} {what}". Falls back to
// auto-formatting the last path segment when a module isn't listed here.
const MODULE_LABELS = {
  transactions: 'a Transaction',
  'ledger/accounts': 'a Ledger Account',
  'ledger/entries': 'a Ledger Entry',
  cheques: 'a Cheque',
  'bank-guarantees': 'a Bank Guarantee',
  'petty-cash': 'a Petty Cash voucher',
  'bank-accounts': 'a Bank Account',
  employees: 'an Employee',
  attendance: 'an Attendance record',
  leave: 'a Leave request',
  payroll: 'a Payroll entry',
  sales: 'a Sales Order',
  purchases: 'a Purchase Order',
  payments: 'a Payment',
  'credit-notes': 'a Credit Note',
  'debit-notes': 'a Debit Note',
  clients: 'a Client',
  vendors: 'a Vendor',
  inventory: 'an Inventory item',
  quotations: 'a Quotation',
  memos: 'a Memo',
  tasks: 'a Task',
  companies: 'a Company',
  users: 'a User',
};

// Fields (checked in this order) most likely to identify *which* record this
// was, pulled straight from the (already-redacted) request body.
const DETAIL_FIELDS = [
  'description', 'partyName', 'party_name', 'accountName', 'account_name',
  'name', 'title', 'chequeNumber', 'cheque_number', 'invoiceNumber',
  'invoice_number', 'orderNumber', 'order_number', 'email',
];

function humanizeModule(module) {
  if (MODULE_LABELS[module]) return MODULE_LABELS[module];
  const last = (module || '').split('/').filter(Boolean).pop() || 'record';
  const words = last.replace(/[-_]/g, ' ').replace(/s$/, '');
  const label = words.charAt(0).toUpperCase() + words.slice(1);
  return `a ${label} record`;
}

function extractDetail(changes) {
  if (!changes || typeof changes !== 'object') return '';
  const parts = [];
  if (changes.amount != null && changes.amount !== '') {
    parts.push(`NPR ${Number(changes.amount).toLocaleString()}`);
  }
  for (const key of DETAIL_FIELDS) {
    if (changes[key]) {
      parts.push(String(changes[key]));
      break;
    }
  }
  return parts.join(' — ');
}

export function describeAuditLog(row) {
  const who = row.user_email || row.userEmail || 'Someone';
  const override = SENTENCE_OVERRIDES[row.module];
  if (override) return override(who);

  const verb = ACTION_VERB[row.action] || (row.action || 'did something to').toLowerCase();
  const what = humanizeModule(row.module);
  const detail = extractDetail(row.changes);
  return `${who} ${verb} ${what}${detail ? ` (${detail})` : ''}`;
}
