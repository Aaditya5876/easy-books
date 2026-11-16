import { describe, it, expect } from 'vitest';
import { toQuotationPayload, quotationToForm, quotationTotal } from './quotations';

const form = {
  task_id: '', client_name: ' Hari Stores ', client_contact: '980', client_address: '', client_pan: '123',
  quotation_number: 'QT-1', is_vat: true, payment_type: 'cheque', date_ad: '2026-11-16', valid_until: '',
  remark: 'QUOTED', notes: 'Valid 30 days',
  items: [
    { description: 'Brake pad', quantity: 2, unit: 'Piece', unit_price: '500', total: 1000 },
    { description: '', quantity: 1, unit: 'Piece', unit_price: 0, total: 0 },
  ],
  labor_items: [{ description: 'Fitting', amount: '300' }, { description: '', amount: 0 }],
};

describe('quotation payload', () => {
  it('sends what the API validates — no made-up status, labour as lines', () => {
    expect(toQuotationPayload(form)).toEqual({
      remark: 'QUOTED', description: 'Valid 30 days', validUntil: null,
      clientName: 'Hari Stores', clientContact: '980', clientAddress: null, clientPanVat: '123',
      dateAd: '2026-11-16', quotationNumber: 'QT-1', paymentMethod: 'CHEQUE', isVat: true,
      items: [{ description: 'Brake pad', quantity: 2, unit: 'Piece', unitPrice: 500 }],
      laborItems: [{ description: 'Fitting', amount: 300 }],
      totalAmount: 1469,
    });
  });

  it('on edit sends the job link (or null) and, once billed, only the editable bits', () => {
    expect(toQuotationPayload({ ...form, task_id: '' }, { isEdit: true }).taskId).toBeNull();
    expect(toQuotationPayload({ ...form, task_id: 't1', remark: 'BILLED' }, { isEdit: true, converted: true }))
      .toEqual({ remark: 'BILLED', description: 'Valid 30 days', validUntil: null, taskId: 't1' });
  });

  it('an unknown remark falls back to Quoted', () => {
    expect(toQuotationPayload({ ...form, remark: 'pending' }).remark).toBe('QUOTED');
  });

  it('turns an API row back into the edit form', () => {
    const f = quotationToForm({
      id: 'q1', client_name: 'Hari', client_pan_vat: '123', date_ad: '2026-11-16T00:00:00.000Z', valid_until: null,
      payment_method: 'CREDIT', description: 'n', remark: 'WORK_DONE', task_id: null,
      items: [{ description: 'Pad', quantity: 2, unit_price: 500 }], labor_items: null, labor_charges: '150',
    });
    expect(f).toMatchObject({
      client_pan: '123', date_ad: '2026-11-16', valid_until: '', payment_type: 'credit', notes: 'n', remark: 'WORK_DONE', task_id: '',
      labor_items: [{ description: '', amount: 150 }],
    });
    expect(f.items[0]).toMatchObject({ unit: 'Piece', total: 1000 });
    expect(quotationTotal({ ...f, is_vat: false })).toBe(1150);
  });
});
