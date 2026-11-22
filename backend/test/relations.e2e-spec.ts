import { createTestApp, resetDb, createCompany, loginAs, Api, TestContext, nepalToday } from './helpers/app';
import { ledgerTotals } from './helpers/school';

// How the modules stay in step with each other: quotation → sale → stock /
// client / ledger, editing a bill, deleting someone who still owes money, and
// bills made from a Workflow job.
describe('Relations between quotations, stock, bills, parties, ledger and workflow', () => {
  let ctx: TestContext;
  let admin: Api;
  let companyId: string;
  const today = nepalToday();
  const balanceOf = async (accountName: string) =>
    Number((await ctx.prisma.ledgerAccount.findFirst({ where: { companyId, accountName } }))?.currentBalance ?? 0);

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    companyId = (await createCompany(ctx.prisma, { name: 'Relations Cafe', businessType: 'FOOD_BEVERAGE', modules: [] })).id;
    admin = (await loginAs(ctx, companyId, 'ADMIN')).api;
  });
  afterAll(async () => { await ctx.app.close(); });

  it('a quotation for a typed name becomes an udharo sale: stock out, client created and linked, ledger posted', async () => {
    const cake = (await admin.post('/api/v1/inventory', { itemName: 'Cake', quantity: 10, unit: 'Piece', unitSellingPrice: 500 })).body.id;
    const q = await admin.post('/api/v1/quotations', {
      clientName: 'Ram Party Palace', dateAd: today, quotationNumber: 'Q-REL-1', totalAmount: 1500,
      items: [{ inventoryItemId: cake, description: 'Cake', quantity: 3, unitPrice: 500 }],
    });
    expect(q.status).toBe(201);
    // A quotation itself never touches stock or the ledger.
    expect(Number((await admin.get(`/api/v1/inventory/${cake}`)).body.quantity)).toBe(10);
    expect(await balanceOf('Accounts Receivable')).toBe(0);

    const sale = await admin.post(`/api/v1/quotations/${q.body.id}/convert`);
    expect(sale.status).toBe(201);
    expect(Number((await admin.get(`/api/v1/inventory/${cake}`)).body.quantity)).toBe(7);
    const client = await ctx.prisma.client.findFirst({ where: { companyId, name: 'Ram Party Palace' } });
    expect(client).not.toBeNull();
    const bill = (await admin.get(`/api/v1/sales/${sale.body.id}`)).body;
    expect(bill).toMatchObject({ clientId: client!.id, status: 'PENDING', paymentMethod: 'CREDIT' });
    expect(await balanceOf('Accounts Receivable')).toBe(1500);
    const row = (await admin.get('/api/v1/clients')).body.find((c: any) => c.id === client!.id);
    expect(row.balance.due).toBe(1500);
  });

  it("changing a bill's date moves its ledger entries to that date", async () => {
    const res = await admin.post('/api/v1/purchases', { vendorName: 'Date Vendor', dateAd: today, items: [{ description: 'Flour', quantity: 1, unitPrice: 100 }] });
    expect((await admin.put(`/api/v1/purchases/${res.body.id}`, { dateAd: '2026-01-15' })).status).toBe(200);
    const entries = await ctx.prisma.ledgerEntry.findMany({ where: { companyId, referenceId: res.body.id } });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.dateAd.toISOString().slice(0, 10) === '2026-01-15')).toBe(true);

    const s = await admin.post('/api/v1/sales', { clientName: 'Date Client', dateAd: today, items: [{ description: 'Tea', quantity: 1, unitPrice: 50 }] });
    expect((await admin.put(`/api/v1/sales/${s.body.id}`, { dateAd: '2026-01-16' })).status).toBe(200);
    const saleEntries = await ctx.prisma.ledgerEntry.findMany({ where: { companyId, referenceId: s.body.id } });
    expect(saleEntries.every((e) => e.dateAd.toISOString().slice(0, 10) === '2026-01-16')).toBe(true);
  });

  it('a vendor or client who still has money owing cannot be deleted; once settled, they can', async () => {
    const v = (await admin.post('/api/v1/vendors', { name: 'Owed Vendor' })).body.id;
    const bill = (await admin.post('/api/v1/purchases', { vendorId: v, vendorName: 'Owed Vendor', dateAd: today, items: [{ description: 'Butter', quantity: 1, unitPrice: 800 }] })).body.id;
    const refused = await admin.del(`/api/v1/vendors/${v}`);
    expect(refused.status).toBe(400);
    expect(refused.body.message).toContain('800');
    await admin.post(`/api/v1/purchases/${bill}/payment`, { amount: 800, paymentMethod: 'CASH', dateAd: today });
    expect((await admin.del(`/api/v1/vendors/${v}`)).status).toBe(200);

    const c = (await admin.post('/api/v1/clients', { name: 'Owing Client', openingBalance: 250 })).body.id;
    expect((await admin.del(`/api/v1/clients/${c}`)).status).toBe(400);
    expect((await admin.put(`/api/v1/clients/${c}`, { openingBalance: 0 })).status).toBe(200);
    expect((await admin.del(`/api/v1/clients/${c}`)).status).toBe(200);
  });

  it('a purchase made from a Workflow job is linked to it and paid the way it was chosen', async () => {
    const job = (await admin.post('/api/v1/tasks', { title: 'Wedding order', partyType: 'CLIENT', partyName: 'Gita' })).body.id;
    const res = await admin.post('/api/v1/purchases', {
      taskId: job, vendorName: 'Job Supplier', dateAd: today, payment: { type: 'FULL', paymentMethod: 'BANK_TRANSFER' },
      items: [{ description: 'Cream', quantity: 2, unitPrice: 300 }],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ taskId: job, status: 'COMPLETED' });
    const links = (await admin.get(`/api/v1/tasks/${job}/links`)).body;
    expect(links.purchases.map((p: any) => p.id)).toEqual([res.body.id]);
    const t = await ledgerTotals(admin);
    expect(t.debit).toBeCloseTo(t.credit, 2);
  });
});
