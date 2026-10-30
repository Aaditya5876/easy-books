import { createTestApp, resetDb, createCompany, loginAs, Api, TestContext, nepalToday } from './helpers/app';
import { ledgerTotals } from './helpers/school';

// The business (non-school) product: clients, vendors, inventory, sales,
// purchases, quotations, credit/debit notes, memos, tasks, dashboard.
describe('Business product', () => {
  let ctx: TestContext;
  let admin: Api;
  let companyId: string;
  let clientId: string;
  let vendorId: string;
  let itemId: string;
  const today = nepalToday();

  const stockOf = async (id: string) => Number((await admin.get(`/api/v1/inventory/${id}`)).body.quantity);
  const balanced = async () => {
    const t = await ledgerTotals(admin);
    expect(t.debit).toBeCloseTo(t.credit, 2);
    return t;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    companyId = (await createCompany(ctx.prisma, { name: 'Test Traders', businessType: 'RETAIL', modules: [] })).id;
    admin = (await loginAs(ctx, companyId, 'ADMIN')).api;
  });
  afterAll(async () => { await ctx.app.close(); });

  describe('clients and vendors', () => {
    it('validate and save', async () => {
      expect((await admin.post('/api/v1/clients', { phone: '1' })).status).toBe(400);
      expect((await admin.post('/api/v1/clients', { name: 'Bad', email: 'nope' })).status).toBe(400);
      const c = await admin.post('/api/v1/clients', { name: 'Hari Stores', contactPerson: 'Hari', phone: '9800000000', panVat: '123456789' });
      expect(c.status).toBe(201);
      clientId = c.body.id;
      expect((await admin.put(`/api/v1/clients/${clientId}`, { address: 'Pokhara' })).status).toBe(200);
      expect((await admin.post('/api/v1/vendors', { contactPerson: 'x' })).status).toBe(400);
      const v = await admin.post('/api/v1/vendors', { name: 'Ktm Suppliers', phone: '9811111111' });
      expect(v.status).toBe(201);
      vendorId = v.body.id;
    });
  });

  describe('inventory', () => {
    it('creates an item and adjusts stock with history', async () => {
      const item = await admin.post('/api/v1/inventory', { itemName: 'Brake Pad', partNumber: 'BP-1', quantity: 10, unit: 'PCS', unitPurchasePrice: 500, unitSellingPrice: 800, lowStockThreshold: 3 });
      expect(item.status).toBe(201);
      itemId = item.body.id;
      // An unknown type used to be treated as SUBTRACTION and silently removed stock.
      expect((await admin.patch(`/api/v1/inventory/${itemId}/adjust`, { adjustmentType: 'ADD', quantityChange: 5, reason: 'x' })).status).toBe(400);
      expect(await stockOf(itemId)).toBe(10);
      expect((await admin.patch(`/api/v1/inventory/${itemId}/adjust`, { adjustmentType: 'ADDITION', quantityChange: 5, reason: 'Delivery' })).status).toBe(200);
      expect(await stockOf(itemId)).toBe(15);
      expect((await admin.patch(`/api/v1/inventory/${itemId}/adjust`, { adjustmentType: 'ADDITION', quantityChange: -3, reason: 'x' })).status).toBe(400);
      expect((await admin.get(`/api/v1/inventory/${itemId}/adjustments`)).body.length).toBeGreaterThan(0);
      expect((await admin.post('/api/v1/inventory', { itemName: 'Bad', unitSellingPrice: -1 })).status).toBe(400);
    });
  });

  describe('sales', () => {
    let saleId: string;
    let saleTotal: number;

    it('creates a VAT invoice: totals, stock out, ledger posted', async () => {
      expect((await admin.post('/api/v1/sales', { clientName: 'X', dateAd: today, items: [] })).status).toBe(400);
      const res = await admin.post('/api/v1/sales', {
        clientId, clientName: 'Hari Stores', dateAd: today, isVat: true, paymentMethod: 'CREDIT',
        items: [{ inventoryItemId: itemId, description: 'Brake Pad', quantity: 2, unitPrice: 800, discountPercent: 0 }],
      });
      expect(res.status).toBe(201);
      saleId = res.body.id;
      saleTotal = Number(res.body.totalAmount ?? res.body.grandTotal);
      expect(saleTotal).toBeCloseTo(1600 * 1.13, 2);
      expect(await stockOf(itemId)).toBe(13);
      await balanced();
    });

    it('records part then full payment; overpaying is refused', async () => {
      expect((await admin.post(`/api/v1/sales/${saleId}/payment`, { amount: saleTotal + 100, paymentMethod: 'CASH', dateAd: today })).status).toBe(400);
      expect((await admin.post(`/api/v1/sales/${saleId}/payment`, { amount: 1000, paymentMethod: 'CASH', dateAd: today })).status).toBe(201);
      expect((await admin.get(`/api/v1/sales/${saleId}`)).body.status).toBe('PARTIALLY_PAID');
      expect((await admin.post(`/api/v1/sales/${saleId}/payment`, { amount: Number((saleTotal - 1000).toFixed(2)), paymentMethod: 'CASH', dateAd: today })).status).toBe(201);
      expect((await admin.get(`/api/v1/sales/${saleId}`)).body.status).toBe('COMPLETED');
      expect((await admin.get(`/api/v1/payments/sales/${saleId}`)).body.length).toBe(2);
      await balanced();
    });

    it('credit note against the sale', async () => {
      expect((await admin.post('/api/v1/credit-notes', { clientId, salesOrderId: saleId, dateAd: today, amount: 0, reason: 'x' })).status).toBe(400);
      const cn = await admin.post('/api/v1/credit-notes', { clientId, salesOrderId: saleId, dateAd: today, amount: 200, reason: 'Damaged item returned' });
      expect(cn.status).toBe(201);
      expect((await admin.patch(`/api/v1/credit-notes/${cn.body.id}/apply`)).status).toBe(200);
      await balanced();
    });
  });

  describe('purchases', () => {
    it('stock in, payment, debit note; ledger balanced', async () => {
      const res = await admin.post('/api/v1/purchases', {
        vendorId, vendorName: 'Ktm Suppliers', dateAd: today, isVat: false, paymentMethod: 'CREDIT',
        items: [{ inventoryItemId: itemId, description: 'Brake Pad', quantity: 10, unitPrice: 500 }],
      });
      expect(res.status).toBe(201);
      expect(await stockOf(itemId)).toBe(23);
      const total = Number(res.body.totalAmount ?? res.body.grandTotal);
      expect(total).toBe(5000);
      expect((await admin.post(`/api/v1/purchases/${res.body.id}/payment`, { amount: 5000, paymentMethod: 'BANK_TRANSFER', dateAd: today })).status).toBe(201);
      expect((await admin.post('/api/v1/debit-notes', { vendorId, purchaseOrderId: res.body.id, dateAd: today, amount: -5, reason: 'x' })).status).toBe(400);
      expect((await admin.post('/api/v1/debit-notes', { vendorId, purchaseOrderId: res.body.id, dateAd: today, amount: 50 })).status).toBe(400);
      const dn = await admin.post('/api/v1/debit-notes', { vendorId, purchaseOrderId: res.body.id, dateAd: today, amount: 500, reason: 'One box short' });
      expect(dn.status).toBe(201);
      await balanced();
    });
  });

  describe('quotations', () => {
    it('quote, then convert once into a sale', async () => {
      const q = await admin.post('/api/v1/quotations', {
        clientId, clientName: 'Hari Stores', dateAd: today, quotationNumber: 'Q-001', totalAmount: 1600,
        items: [{ inventoryItemId: itemId, description: 'Brake Pad', quantity: 2, unitPrice: 800 }],
      });
      expect(q.status).toBe(201);
      expect((await admin.post('/api/v1/quotations', { clientName: 'X', dateAd: today, quotationNumber: 'Q-001', totalAmount: 1, items: [{ description: 'x', quantity: 1, unitPrice: 1 }] })).status).toBe(409);
      expect((await admin.post(`/api/v1/quotations/${q.body.id}/convert`)).status).toBe(201);
      expect((await admin.get(`/api/v1/quotations/${q.body.id}`)).body.status).toBe('CONVERTED');
      expect((await admin.post(`/api/v1/quotations/${q.body.id}/convert`)).status).toBe(400);
    });
  });

  describe('memo, tasks, dashboard', () => {
    it('memo and task CRUD with the date-only values the forms send', async () => {
      const m = await admin.post('/api/v1/memos', { category: 'quotation', clientName: 'Hari', content: 'Quote', dateAd: today, validUntil: '2026-12-31', amount: 1600 });
      expect(m.status).toBe(201);
      expect(m.body.title).toBe('Hari');
      expect((await admin.put(`/api/v1/memos/${m.body.id}`, { content: 'Renewed', dueDate: '2027-01-15', startDate: '' })).status).toBe(200);
      expect((await admin.post('/api/v1/tasks', { description: 'no title' })).status).toBe(400);
      const t = await admin.post('/api/v1/tasks', { title: 'Call supplier', priority: 'HIGH', dueDate: '2026-11-05' });
      expect(t.status).toBe(201);
      expect((await admin.put(`/api/v1/tasks/${t.body.id}`, { status: 'COMPLETED' })).status).toBe(200);
    });

    it('dashboard widgets load', async () => {
      for (const w of ['', '/top-clients', '/top-vendors', '/pending-receivables', '/pending-payables', '/sales-trend', '/alerts', '/hr-summary', '/recent-activity', '/vat-summary']) {
        expect([w, (await admin.get(`/api/v1/dashboard${w}`)).status]).toEqual([w, 200]);
      }
    });
  });

  describe('roles', () => {
    it('staff can view and update tasks but not create sales or clients', async () => {
      const staff = (await loginAs(ctx, companyId, 'STAFF')).api;
      expect((await staff.get('/api/v1/sales')).status).toBe(200);
      expect((await staff.post('/api/v1/sales', { clientName: 'X', dateAd: today, items: [{ description: 'x', quantity: 1, unitPrice: 1 }] })).status).toBe(403);
      expect((await staff.post('/api/v1/clients', { name: 'X' })).status).toBe(403);
      const task = (await admin.post('/api/v1/tasks', { title: 'Staff task' })).body.id;
      expect((await staff.put(`/api/v1/tasks/${task}`, { status: 'IN_PROGRESS' })).status).toBe(200);
    });

    it('a teacher login is refused on a business company', async () => {
      expect((await admin.post('/api/v1/users/invite', { email: 't@test.local', name: 'T', role: 'TEACHER' })).status).toBe(400);
    });
  });
});
