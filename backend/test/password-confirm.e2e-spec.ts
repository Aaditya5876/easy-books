import { createTestApp, resetDb, createCompany, loginAs, Api, TestContext, PASSWORD } from './helpers/app';

// "Enter your password to continue" prompts must really check the password,
// on the server, with the same lockout as login — not just "is logged in".
describe('Password re-confirmation', () => {
  let ctx: TestContext;
  let companyId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    companyId = (await createCompany(ctx.prisma, { name: 'Confirm Co', businessType: 'RETAIL', modules: [] })).id;
  });
  afterAll(async () => { await ctx.app.close(); });

  it('verify-password accepts the right password and refuses a wrong one', async () => {
    const { api } = await loginAs(ctx, companyId, 'ACCOUNTANT');
    expect((await api.post('/api/v1/auth/verify-password', { password: PASSWORD })).body).toEqual({ valid: true });
    const wrong = await api.post('/api/v1/auth/verify-password', { password: 'nope' });
    expect(wrong.status).toBe(403); // not 401 — that would log the user out
    expect((await api.post('/api/v1/auth/verify-password', {})).status).toBe(400);
  });

  it('five wrong tries lock it (right password then refused too), like login', async () => {
    const { api } = await loginAs(ctx, companyId, 'ACCOUNTANT');
    for (let i = 0; i < 5; i++) await api.post('/api/v1/auth/verify-password', { password: 'guess' + i });
    expect((await api.post('/api/v1/auth/verify-password', { password: PASSWORD })).status).toBe(429);
  });

  it('editing an inventory item needs the right password, checked by the server', async () => {
    const { api } = await loginAs(ctx, companyId, 'ADMIN');
    const item = (await api.post('/api/v1/inventory', { itemName: 'Locked Item', quantity: 5, unitSellingPrice: 100 })).body;
    const url = `/api/v1/inventory/${item.id}`;
    expect((await api.put(url, { unitSellingPrice: 1 })).status).toBe(400);
    expect((await api.put(url, { unitSellingPrice: 1, password: 'wrong' })).status).toBe(403);
    expect(Number((await ctx.prisma.inventoryItem.findUnique({ where: { id: item.id } }))!.unitSellingPrice)).toBe(100);
    const ok = await api.put(url, { unitSellingPrice: 150, password: PASSWORD });
    expect(ok.status).toBe(200);
    expect(Number(ok.body.unitSellingPrice)).toBe(150);
    expect(ok.body.password).toBeUndefined();
  });

  it('the recycle bin password check uses the same lockout', async () => {
    const { api } = await loginAs(ctx, companyId, 'ADMIN');
    for (let i = 0; i < 5; i++) await api.post('/api/v1/recycle-bin/verify', { password: 'guess' + i });
    expect((await api.post('/api/v1/recycle-bin/verify', { password: PASSWORD })).status).toBe(429);
  });
});
