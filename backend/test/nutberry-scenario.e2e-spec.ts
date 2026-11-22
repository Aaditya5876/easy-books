import { createTestApp, resetDb, createCompany, loginAs, Api, TestContext, nepalToday } from './helpers/app';
import { ledgerTotals } from './helpers/school';

// The user's own end-to-end scenario, run exactly as the screens do it:
// Nutberry Cafe buys ingredients from Ghee Bhandar (paid in cash), bakes
// doughnuts and brownies (stock adjustments — there is no production feature
// yet), and sells to two clients: one pays in full, one on udharo who pays part
// later. Then every place the money and stock show up is checked.
describe('Scenario — Nutberry Cafe: buy, bake, sell', () => {
  let ctx: TestContext;
  let admin: Api;
  let companyId: string;
  const today = nepalToday();
  const expiry = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const ids: Record<string, string> = {};

  const balanceOf = async (accountName: string) =>
    Number((await ctx.prisma.ledgerAccount.findFirst({ where: { companyId, accountName } }))?.currentBalance ?? 0);
  const stockOf = async (key: string) => Number((await admin.get(`/api/v1/inventory/${ids[key]}`)).body.quantity);
  const item = (key: string, body: object) => admin.post('/api/v1/inventory', body).then((r) => { expect(r.status).toBe(201); ids[key] = r.body.id; });

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    companyId = (await createCompany(ctx.prisma, { name: 'Nutberry Cafe', businessType: 'FOOD_BEVERAGE', modules: [] })).id;
    admin = (await loginAs(ctx, companyId, 'ADMIN')).api;
  });
  afterAll(async () => { await ctx.app.close(); });

  it('1. vendor Ghee Bhandar and the two clients are created', async () => {
    for (const [key, url, body] of [
      ['ghee', '/api/v1/vendors', { name: 'Ghee Bhandar', phone: '9800000001' }],
      ['sita', '/api/v1/clients', { name: 'Sita Thapa', phone: '9800000002' }],
      ['hotel', '/api/v1/clients', { name: 'Hotel Everest', phone: '9800000003' }],
    ] as const) {
      const res = await admin.post(url, body);
      expect(res.status).toBe(201);
      ids[key] = res.body.id;
    }
  });

  it('2. purchase 5 kg cheese, 2 L milk, 3 kg dough, 4 kg sugar — paid in full by cash', async () => {
    // The Purchase page links each line to a stock item (creating it at 0 first).
    await item('cheese', { itemName: 'Cheese', quantity: 0, unit: 'Kg', unitPurchasePrice: 1200 });
    await item('milk', { itemName: 'Milk', quantity: 0, unit: 'Litre', unitPurchasePrice: 120 });
    await item('dough', { itemName: 'Dough', quantity: 0, unit: 'Kg', unitPurchasePrice: 150 });
    await item('sugar', { itemName: 'Sugar', quantity: 0, unit: 'Kg', unitPurchasePrice: 110 });

    const res = await admin.post('/api/v1/purchases', {
      vendorId: ids.ghee, vendorName: 'Ghee Bhandar', dateAd: today, isVat: false,
      payment: { type: 'FULL', paymentMethod: 'CASH' },
      items: [
        { inventoryItemId: ids.cheese, description: 'Cheese', quantity: 5, unit: 'Kg', unitPrice: 1200 },
        { inventoryItemId: ids.milk, description: 'Milk', quantity: 2, unit: 'Litre', unitPrice: 120 },
        { inventoryItemId: ids.dough, description: 'Dough', quantity: 3, unit: 'Kg', unitPrice: 150 },
        { inventoryItemId: ids.sugar, description: 'Sugar', quantity: 4, unit: 'Kg', unitPrice: 110 },
      ],
    });
    expect(res.status).toBe(201);
    expect(Number(res.body.totalAmount)).toBe(7130);
    expect(res.body.status).toBe('COMPLETED');
    expect([await stockOf('cheese'), await stockOf('milk'), await stockOf('dough'), await stockOf('sugar')]).toEqual([5, 2, 3, 4]);
    expect(await balanceOf('Purchase Expenses')).toBe(7130);
    expect(await balanceOf('Accounts Payable')).toBe(0);
    expect(await balanceOf('Cash in Hand')).toBe(-7130);
  });

  it('3. bake: ingredients used come out of stock; 40 doughnuts and 30 brownies (expire in 5 days) go in', async () => {
    for (const [key, qty] of [['cheese', 2], ['milk', 1], ['dough', 3], ['sugar', 2]] as const) {
      const r = await admin.patch(`/api/v1/inventory/${ids[key]}/adjust`, { adjustmentType: 'SUBTRACTION', quantityChange: qty, reason: 'Used for doughnuts and brownies' });
      expect(r.status).toBe(200);
    }
    await item('doughnut', { itemName: 'Doughnut', quantity: 40, unit: 'Piece', unitSellingPrice: 60, expiryDate: expiry });
    await item('brownie', { itemName: 'Brownie', quantity: 30, unit: 'Piece', unitSellingPrice: 120, expiryDate: expiry });

    expect([await stockOf('cheese'), await stockOf('milk'), await stockOf('dough'), await stockOf('sugar')]).toEqual([3, 1, 0, 2]);
    expect((await admin.get(`/api/v1/inventory/${ids.doughnut}`)).body.expiryDate.slice(0, 10)).toBe(expiry);
    // Moving stock around is not money: the ledger is untouched.
    expect(await balanceOf('Cash in Hand')).toBe(-7130);
  });

  it('4. Sita Thapa buys 10 doughnuts + 5 brownies — received in full, cash', async () => {
    const res = await admin.post('/api/v1/sales', {
      clientId: ids.sita, clientName: 'Sita Thapa', dateAd: today, isVat: false,
      payment: { type: 'FULL', paymentMethod: 'CASH' },
      items: [
        { inventoryItemId: ids.doughnut, description: 'Doughnut', quantity: 10, unit: 'Piece', unitPrice: 60 },
        { inventoryItemId: ids.brownie, description: 'Brownie', quantity: 5, unit: 'Piece', unitPrice: 120 },
      ],
    });
    expect(res.status).toBe(201);
    expect([Number(res.body.totalAmount), res.body.status]).toEqual([1200, 'COMPLETED']);
  });

  it('5. Hotel Everest buys 20 doughnuts + 15 brownies on udharo, then pays 2,000', async () => {
    const res = await admin.post('/api/v1/sales', {
      clientId: ids.hotel, clientName: 'Hotel Everest', dateAd: today, isVat: false,
      items: [
        { inventoryItemId: ids.doughnut, description: 'Doughnut', quantity: 20, unit: 'Piece', unitPrice: 60 },
        { inventoryItemId: ids.brownie, description: 'Brownie', quantity: 15, unit: 'Piece', unitPrice: 120 },
      ],
    });
    expect(res.status).toBe(201);
    expect([Number(res.body.totalAmount), res.body.status]).toEqual([3000, 'PENDING']);
    const pay = await admin.post(`/api/v1/sales/${res.body.id}/payment`, { amount: 2000, paymentMethod: 'CASH', dateAd: today });
    expect(pay.status).toBe(201);
    const bill = (await admin.get(`/api/v1/sales/${res.body.id}`)).body;
    expect([bill.status, Number(bill.paidAmount)]).toEqual(['PARTIALLY_PAID', 2000]);
  });

  it('6. everything adds up', async () => {
    // Stock
    expect([await stockOf('doughnut'), await stockOf('brownie')]).toEqual([10, 10]);
    // Ledger
    expect(await balanceOf('Cash in Hand')).toBe(-3930); // −7,130 + 1,200 + 2,000
    expect(await balanceOf('Accounts Payable')).toBe(0);
    expect(await balanceOf('Accounts Receivable')).toBe(1000);
    expect(await balanceOf('Sales Revenue')).toBe(4200);
    expect(await balanceOf('Purchase Expenses')).toBe(7130);
    const t = await ledgerTotals(admin);
    expect(t.debit).toBeCloseTo(t.credit, 2);
    // Vendor / client balances
    const vendors = (await admin.get('/api/v1/vendors')).body;
    expect(vendors.find((v: any) => v.id === ids.ghee).balance.due).toBe(0);
    const clients = (await admin.get('/api/v1/clients')).body;
    expect(clients.find((c: any) => c.id === ids.sita).balance.due).toBe(0);
    expect(clients.find((c: any) => c.id === ids.hotel).balance.due).toBe(1000);
    // Hotel Everest's statement: bill 3,000 Dr, payment 2,000 Cr → 1,000
    const st = (await admin.get(`/api/v1/clients/${ids.hotel}/statement`)).body;
    expect(st.lines.map((l: any) => [l.type, l.debit, l.credit, l.balance])).toEqual([
      ['BILL', 3000, 0, 3000],
      ['PAYMENT', 0, 2000, 1000],
    ]);
  });
});
