import { randomUUID } from 'crypto';
import { createTestApp, resetDb, createCompany, loginAs, Api, TestContext, nepalToday } from './helpers/app';
import { createSchool, billAndRelease, ledgerTotals } from './helpers/school';
import { LedgerPostingService } from '../src/application/services/ledger-posting.service';

// Money must be recorded exactly once:
//  - a retried / double-clicked request with the same Idempotency-Key replays
//    the first result instead of creating a second record;
//  - two payments racing each other can never take a bill past its total;
//  - a payment and its ledger entries are saved together or not at all.
describe('Idempotency and money safety', () => {
  let ctx: TestContext;
  let admin: Api;
  let companyId: string;
  const today = nepalToday();
  const key = () => randomUUID();

  const newSale = async (unitPrice = 1600) => (await admin.post('/api/v1/sales', {
    clientName: 'Hari', dateAd: today, paymentMethod: 'CREDIT', items: [{ description: 'Service', quantity: 1, unitPrice }],
  })).body;
  const balanced = async (api: Api) => {
    const t = await ledgerTotals(api);
    expect(t.debit).toBeCloseTo(t.credit, 2);
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    companyId = (await createCompany(ctx.prisma, { name: 'Money Co', businessType: 'RETAIL', modules: [] })).id;
    admin = (await loginAs(ctx, companyId, 'ADMIN')).api;
  });
  afterAll(async () => { await ctx.app.close(); });
  afterEach(() => jest.restoreAllMocks());

  describe('Idempotency-Key', () => {
    it('a repeated request replays the first result instead of creating a second bill', async () => {
      const k = key();
      const body = { clientName: 'Retry Co', dateAd: today, paymentMethod: 'CASH', items: [{ description: 'Oil', quantity: 1, unitPrice: 500 }] };
      const first = await admin.post('/api/v1/sales', body).set('Idempotency-Key', k);
      const second = await admin.post('/api/v1/sales', body).set('Idempotency-Key', k);
      expect([first.status, second.status]).toEqual([201, 201]);
      expect(second.body.id).toBe(first.body.id);
      expect(second.headers['idempotent-replayed']).toBe('true');
      expect(await ctx.prisma.salesOrder.count({ where: { companyId, clientName: 'Retry Co' } })).toBe(1);
    });

    it('the same key with a different body is refused', async () => {
      const k = key();
      expect((await admin.post('/api/v1/vendors', { name: 'A' }).set('Idempotency-Key', k)).status).toBe(201);
      expect((await admin.post('/api/v1/vendors', { name: 'B' }).set('Idempotency-Key', k)).status).toBe(422);
    });

    it('a failed request does not burn the key — fixing it and retrying works', async () => {
      const k = key();
      expect((await admin.post('/api/v1/vendors', { phone: '1' }).set('Idempotency-Key', k)).status).toBe(400);
      expect((await admin.post('/api/v1/vendors', { name: 'Fixed' }).set('Idempotency-Key', k)).status).toBe(201);
    });

    it('two simultaneous requests with one key record one payment', async () => {
      const sale = await newSale(5000);
      const k = key();
      const pay = () => admin.post(`/api/v1/sales/${sale.id}/payment`, { amount: 1000, paymentMethod: 'CASH', dateAd: today }).set('Idempotency-Key', k);
      const results = await Promise.all([pay(), pay(), pay()]);
      expect(results.every((r) => [201, 409].includes(r.status))).toBe(true);
      expect(await ctx.prisma.payment.count({ where: { salesOrderId: sale.id } })).toBe(1);
      expect(Number((await ctx.prisma.salesOrder.findUnique({ where: { id: sale.id } }))!.paidAmount)).toBe(1000);
    });

    it('keys belong to one user — another user with the same key is not affected', async () => {
      const other = (await loginAs(ctx, companyId, 'ADMIN')).api;
      const k = key();
      const a = await admin.post('/api/v1/vendors', { name: 'Mine' }).set('Idempotency-Key', k);
      const b = await other.post('/api/v1/vendors', { name: 'Theirs' }).set('Idempotency-Key', k);
      expect([a.status, b.status]).toEqual([201, 201]);
      expect(b.body.id).not.toBe(a.body.id);
    });

    it('rejects an unusable key', async () => {
      expect((await admin.post('/api/v1/vendors', { name: 'X' }).set('Idempotency-Key', 'x'.repeat(300))).status).toBe(400);
    });
  });

  describe('payments racing each other', () => {
    it('sales: five 1000 payments on a 1600 bill — exactly one goes through', async () => {
      const sale = await newSale(1600);
      const results = await Promise.all(Array.from({ length: 5 }, () =>
        admin.post(`/api/v1/sales/${sale.id}/payment`, { amount: 1000, paymentMethod: 'CASH', dateAd: today })));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 400)).toHaveLength(4);
      expect(await ctx.prisma.payment.count({ where: { salesOrderId: sale.id } })).toBe(1);
      const order = await ctx.prisma.salesOrder.findUnique({ where: { id: sale.id } });
      expect([Number(order!.paidAmount), order!.status]).toEqual([1000, 'PARTIALLY_PAID']);
      await balanced(admin);
    });

    it('purchase: same race on a purchase bill', async () => {
      const po = (await admin.post('/api/v1/purchases', {
        vendorName: 'Supplier', dateAd: today, paymentMethod: 'CREDIT', items: [{ description: 'Stock', quantity: 1, unitPrice: 1600 }],
      })).body;
      const results = await Promise.all(Array.from({ length: 5 }, () =>
        admin.post(`/api/v1/purchases/${po.id}/payment`, { amount: 1000, paymentMethod: 'CASH', dateAd: today })));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(Number((await ctx.prisma.purchaseOrder.findUnique({ where: { id: po.id } }))!.paidAmount)).toBe(1000);
      await balanced(admin);
    });

    it('two different payments that fit are both kept (no lost update)', async () => {
      const sale = await newSale(3000);
      const results = await Promise.all([1000, 1500].map((amount) =>
        admin.post(`/api/v1/sales/${sale.id}/payment`, { amount, paymentMethod: 'CASH', dateAd: today })));
      expect(results.map((r) => r.status)).toEqual([201, 201]);
      expect(Number((await ctx.prisma.salesOrder.findUnique({ where: { id: sale.id } }))!.paidAmount)).toBe(2500);
    });

    it('school fees: racing counter payments never exceed the invoice; receipt numbers stay unique', async () => {
      const school = await createSchool(ctx, 1);
      const invoice = Object.values(await billAndRelease(school, 3000))[0] as any;
      const results = await Promise.all(Array.from({ length: 4 }, () =>
        school.admin.patch(`/api/v1/school/fee-invoices/${invoice.id}/payment`, { amount: 2000, method: 'CASH' })));
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      const inv = await ctx.prisma.feeInvoice.findUnique({ where: { id: invoice.id } });
      expect(Number(inv!.paidAmount)).toBe(2000);
      expect(await ctx.prisma.feePayment.count({ where: { invoiceId: invoice.id, status: 'CONFIRMED' } })).toBe(1);

      // Two payments that both fit, at once: both saved with different receipts.
      const two = await Promise.all([500, 500].map((amount) =>
        school.admin.patch(`/api/v1/school/fee-invoices/${invoice.id}/payment`, { amount, method: 'CASH' })));
      expect(two.map((r) => r.status)).toEqual([200, 200]);
      const receipts = (await ctx.prisma.feePayment.findMany({ where: { invoiceId: invoice.id } })).map((p) => p.receiptNo);
      expect(new Set(receipts).size).toBe(receipts.length);
      expect(Number((await ctx.prisma.feeInvoice.findUnique({ where: { id: invoice.id } }))!.paidAmount)).toBe(3000);
      await balanced(school.admin);
    });

    it('school fees: a payment proof confirmed twice at once is applied once', async () => {
      const school = await createSchool(ctx, 1);
      const invoice = Object.values(await billAndRelease(school, 3000))[0] as any;
      const proof = await ctx.prisma.feePayment.create({
        data: { companyId: school.companyId, invoiceId: invoice.id, amount: 1000, method: 'ESEWA', status: 'PENDING_REVIEW', submittedByPortal: true, proofScreenshotUrl: '/uploads/x.png' },
      });
      const results = await Promise.all([1, 2, 3].map(() =>
        school.admin.patch(`/api/v1/school/fee-payments/${proof.id}/confirm`)));
      expect(results.filter((r) => r.status < 300)).toHaveLength(1);
      expect(Number((await ctx.prisma.feeInvoice.findUnique({ where: { id: invoice.id } }))!.paidAmount)).toBe(1000);
      expect(await ctx.prisma.transaction.count({ where: { referenceType: 'FEE_PAYMENT', referenceId: proof.id } })).toBe(1);
    });
  });

  describe('all or nothing', () => {
    it('if the ledger posting fails, the payment is not saved either', async () => {
      const sale = await newSale(1600);
      jest.spyOn(LedgerPostingService.prototype, 'postPaymentReceived').mockRejectedValueOnce(new Error('ledger down'));
      const res = await admin.post(`/api/v1/sales/${sale.id}/payment`, { amount: 500, paymentMethod: 'CASH', dateAd: today });
      expect(res.status).toBe(500);
      expect(await ctx.prisma.payment.count({ where: { salesOrderId: sale.id } })).toBe(0);
      expect(Number((await ctx.prisma.salesOrder.findUnique({ where: { id: sale.id } }))!.paidAmount)).toBe(0);
    });

    it('if the ledger posting fails, the bill and its stock change are not saved', async () => {
      const item = (await admin.post('/api/v1/inventory', { itemName: 'Atomic Item', quantity: 5, unit: 'PCS', unitSellingPrice: 100 })).body;
      jest.spyOn(LedgerPostingService.prototype, 'postSalesOrder').mockRejectedValueOnce(new Error('ledger down'));
      const before = await ctx.prisma.salesOrder.count({ where: { companyId } });
      const res = await admin.post('/api/v1/sales', {
        clientName: 'Atomic', dateAd: today, items: [{ inventoryItemId: item.id, description: 'Atomic Item', quantity: 2, unitPrice: 100 }],
      });
      expect(res.status).toBe(500);
      expect(await ctx.prisma.salesOrder.count({ where: { companyId } })).toBe(before);
      expect(Number((await ctx.prisma.inventoryItem.findUnique({ where: { id: item.id } }))!.quantity)).toBe(5);
    });

    it('if a fee ledger posting fails, the receipt is not saved', async () => {
      const school = await createSchool(ctx, 1);
      const invoice = Object.values(await billAndRelease(school, 3000))[0] as any;
      jest.spyOn(LedgerPostingService.prototype, 'postManualJournalEntryTx').mockRejectedValueOnce(new Error('ledger down'));
      const res = await school.admin.patch(`/api/v1/school/fee-invoices/${invoice.id}/payment`, { amount: 1000, method: 'CASH' });
      expect(res.status).toBe(500);
      expect(await ctx.prisma.feePayment.count({ where: { invoiceId: invoice.id } })).toBe(0);
      expect(Number((await ctx.prisma.feeInvoice.findUnique({ where: { id: invoice.id } }))!.paidAmount)).toBe(0);
    });

    it('"To Sale" clicked twice at once makes one bill', async () => {
      const q = (await admin.post('/api/v1/quotations', {
        clientName: 'Twice', dateAd: today, quotationNumber: 'Q-TWICE', totalAmount: 0, items: [{ description: 'Job', quantity: 1, unitPrice: 900 }],
      })).body;
      const results = await Promise.all([1, 2, 3].map(() => admin.post(`/api/v1/quotations/${q.id}/convert`)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(await ctx.prisma.salesOrder.count({ where: { companyId, notes: { contains: 'Q-TWICE' } } })).toBe(1);
      await balanced(admin);
    });

    it('two sales racing for the last units cannot oversell stock', async () => {
      const item = (await admin.post('/api/v1/inventory', { itemName: 'Last Units', quantity: 3, unit: 'PCS', unitSellingPrice: 100 })).body;
      const results = await Promise.all(Array.from({ length: 3 }, () => admin.post('/api/v1/sales', {
        clientName: 'Rush', dateAd: today, items: [{ inventoryItemId: item.id, description: 'Last Units', quantity: 2, unitPrice: 100 }],
      })));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(Number((await ctx.prisma.inventoryItem.findUnique({ where: { id: item.id } }))!.quantity)).toBe(1);
    });
  });
});
