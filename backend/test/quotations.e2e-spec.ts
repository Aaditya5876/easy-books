import { createTestApp, resetDb, createCompany, loginAs, Api, TestContext, nepalToday } from './helpers/app';

// What the Quotations page sends and expects back. Quotations have two
// separate fields: `status` (ACTIVE → CONVERTED / EXPIRED, set by the system or
// "mark expired") and `remark` (Quoted, Work done, Revised, Billed, Cancelled).
describe('Quotations page', () => {
  let ctx: TestContext;
  let admin: Api;
  const today = nepalToday();

  const pageBody = (n: string, extra: object = {}) => ({
    clientName: 'Hari Stores', clientContact: '9800000000', clientAddress: 'Baglung', clientPanVat: '123456789',
    dateAd: today, validUntil: '2026-12-31', quotationNumber: n, paymentMethod: 'CHEQUE', isVat: true,
    items: [{ description: 'Brake pad', quantity: 2, unit: 'Piece', unitPrice: 500 }],
    laborItems: [{ description: 'Fitting', amount: 200 }, { description: 'Wash', amount: 100 }],
    description: 'Valid for 30 days', remark: 'QUOTED', totalAmount: 0,
    ...extra,
  });

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    const companyId = (await createCompany(ctx.prisma, { name: 'Quote Co', businessType: 'RETAIL', modules: [] })).id;
    admin = (await loginAs(ctx, companyId, 'ADMIN')).api;
  });
  afterAll(async () => { await ctx.app.close(); });

  it('creates with every field the form collects; server computes the totals', async () => {
    const res = await admin.post('/api/v1/quotations', pageBody('QT-1'));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'ACTIVE', remark: 'QUOTED', clientContact: '9800000000', clientAddress: 'Baglung', clientPanVat: '123456789',
      paymentMethod: 'CHEQUE', description: 'Valid for 30 days',
      laborItems: [{ description: 'Fitting', amount: 200 }, { description: 'Wash', amount: 100 }],
    });
    expect(res.body.validUntil.slice(0, 10)).toBe('2026-12-31');
    expect(Number(res.body.laborCharges)).toBe(300);
    expect(Number(res.body.vatAmount)).toBeCloseTo(169, 2); // (1000 + 300) × 13%
    expect(Number(res.body.totalAmount)).toBeCloseTo(1469, 2);
  });

  it('a line discount is taken off once', async () => {
    const res = await admin.post('/api/v1/quotations', pageBody('QT-DISC', {
      isVat: false, laborItems: [], items: [{ description: 'Pump', quantity: 1, unitPrice: 1000, discountPercent: 10 }],
    }));
    expect([Number(res.body.subtotal), Number(res.body.discountTotal), Number(res.body.totalAmount)]).toEqual([1000, 100, 900]);
  });

  it('rejects the old made-up statuses', async () => {
    expect((await admin.post('/api/v1/quotations', pageBody('QT-OLD', { status: 'pending' }))).status).toBe(400);
  });

  it('editing items recomputes totals; a date-only valid-until is accepted', async () => {
    const q = (await admin.post('/api/v1/quotations', pageBody('QT-2'))).body;
    const res = await admin.put(`/api/v1/quotations/${q.id}`, {
      items: [{ description: 'Brake pad', quantity: 3, unitPrice: 500 }], laborItems: [], isVat: false, validUntil: '2027-01-15', totalAmount: 1,
    });
    expect(res.status).toBe(200);
    const saved = (await admin.get(`/api/v1/quotations/${q.id}`)).body;
    expect([Number(saved.subtotal), Number(saved.laborCharges), Number(saved.vatAmount), Number(saved.totalAmount)]).toEqual([1500, 0, 0, 1500]);
    expect(saved.validUntil.slice(0, 10)).toBe('2027-01-15');
  });

  it('remark changes on its own; expire and reactivate; a converted one is locked', async () => {
    const q = (await admin.post('/api/v1/quotations', pageBody('QT-3'))).body;
    expect((await admin.put(`/api/v1/quotations/${q.id}`, { remark: 'WORK_DONE' })).status).toBe(200);
    expect((await admin.get(`/api/v1/quotations/${q.id}`)).body).toMatchObject({ remark: 'WORK_DONE', status: 'ACTIVE' });

    expect((await admin.put(`/api/v1/quotations/${q.id}`, { status: 'EXPIRED' })).status).toBe(200);
    expect((await admin.post(`/api/v1/quotations/${q.id}/convert`)).status).toBe(400);
    expect((await admin.put(`/api/v1/quotations/${q.id}`, { status: 'ACTIVE' })).status).toBe(200);

    const sale = await admin.post(`/api/v1/quotations/${q.id}/convert`);
    expect(sale.status).toBe(201);
    const bill = await ctx.prisma.salesOrder.findFirst({ where: { notes: { contains: 'QT-3' } } });
    // The quotation's planned method (cheque) isn't a payment: the new bill is
    // unpaid (udharo) until "Receive Payment" records how it was actually paid.
    expect(bill).toMatchObject({ clientContact: '9800000000', clientAddress: 'Baglung', clientPanVat: '123456789', paymentMethod: 'CREDIT', status: 'PENDING' });
    expect(Number(bill!.laborCharges)).toBe(300);

    // Billed already: money and status can't change, notes/remark can.
    expect((await admin.put(`/api/v1/quotations/${q.id}`, { items: [{ description: 'x', quantity: 1, unitPrice: 1 }] })).status).toBe(400);
    expect((await admin.put(`/api/v1/quotations/${q.id}`, { status: 'ACTIVE' })).status).toBe(400);
    expect((await admin.put(`/api/v1/quotations/${q.id}`, { description: 'Paid by cheque' })).status).toBe(200);
    // Only the system marks a quotation converted.
    const other = (await admin.post('/api/v1/quotations', pageBody('QT-4'))).body;
    expect((await admin.put(`/api/v1/quotations/${other.id}`, { status: 'CONVERTED' })).status).toBe(400);
  });
});
