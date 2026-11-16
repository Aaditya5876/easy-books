// The Quotations page keeps its form in snake_case (adapter style); the API
// wants camelCase and its own status values. This is the one translation.
//
// Two separate fields on a quotation:
//   status — ACTIVE → CONVERTED (made into a bill) or EXPIRED. System-owned
//            except "mark expired / reactivate".
//   remark — where the work stands: Quoted, Work done, Revised, Billed, Cancelled.

export const QUOTATION_STATUSES = ['ACTIVE', 'CONVERTED', 'EXPIRED'];
export const QUOTATION_REMARKS = ['QUOTED', 'WORK_DONE', 'REVISED', 'BILLED', 'CANCELLED'];

const text = (v) => {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
};
const day = (v) => (v ? String(v).slice(0, 10) : null);

export function quotationItems(items) {
  return (items || [])
    .filter((i) => text(i.description) && Number(i.quantity) > 0)
    .map((i) => ({
      ...(i.inventory_item_id ? { inventoryItemId: i.inventory_item_id } : {}),
      description: text(i.description),
      quantity: Number(i.quantity),
      ...(i.unit ? { unit: i.unit } : {}),
      unitPrice: Number(i.unit_price) || 0,
      ...(Number(i.discount_percent) ? { discountPercent: Number(i.discount_percent) } : {}),
    }));
}

export function quotationLabor(laborItems) {
  return (laborItems || [])
    .filter((l) => text(l.description) || Number(l.amount) > 0)
    .map((l) => ({ description: text(l.description) || '', amount: Number(l.amount) || 0 }));
}

// Preview only — the server always recomputes.
export function quotationTotal(form) {
  const items = quotationItems(form.items).reduce((s, i) => s + i.quantity * i.unitPrice * (1 - (i.discountPercent || 0) / 100), 0);
  const labor = quotationLabor(form.labor_items).reduce((s, l) => s + l.amount, 0);
  const taxable = items + labor;
  return Math.round((form.is_vat ? taxable * 1.13 : taxable) * 100) / 100;
}

// `converted`: the quotation is already billed — only notes, remark, validity
// and the job link may change.
export function toQuotationPayload(form, { isEdit = false, converted = false } = {}) {
  const base = {
    remark: QUOTATION_REMARKS.includes(form.remark) ? form.remark : 'QUOTED',
    description: text(form.notes),
    validUntil: day(form.valid_until),
    ...(isEdit ? { taskId: form.task_id || null } : form.task_id ? { taskId: form.task_id } : {}),
  };
  if (converted) return base;
  return {
    ...base,
    ...(form.client_id ? { clientId: form.client_id } : {}),
    clientName: text(form.client_name) || '',
    clientContact: text(form.client_contact),
    clientAddress: text(form.client_address),
    clientPanVat: text(form.client_pan),
    dateAd: day(form.date_ad),
    quotationNumber: text(form.quotation_number) || '',
    paymentMethod: String(form.payment_type || 'cash').toUpperCase(),
    isVat: !!form.is_vat,
    items: quotationItems(form.items),
    laborItems: quotationLabor(form.labor_items),
    totalAmount: quotationTotal(form),
  };
}

// API row (adapter snake_case) → the page's edit form.
export function quotationToForm(q) {
  const items = (q.items || []).map((i) => ({
    ...i,
    unit: i.unit || 'Piece',
    total: Number(i.quantity || 0) * Number(i.unit_price || 0),
  }));
  const labor = Array.isArray(q.labor_items) && q.labor_items.length
    ? q.labor_items.map((l) => ({ description: l.description || '', amount: Number(l.amount) || 0 }))
    : Number(q.labor_charges)
      ? [{ description: '', amount: Number(q.labor_charges) }]
      : [{ description: '', amount: 0 }];
  return {
    ...q,
    task_id: q.task_id || '',
    client_pan: q.client_pan_vat || '',
    date_ad: day(q.date_ad) || '',
    valid_until: day(q.valid_until) || '',
    payment_type: String(q.payment_method || 'CASH').toLowerCase(),
    notes: q.description || '',
    remark: q.remark || 'QUOTED',
    items: items.length ? items : [{ description: '', quantity: 1, unit: 'Piece', unit_price: 0, total: 0 }],
    labor_items: labor,
  };
}
