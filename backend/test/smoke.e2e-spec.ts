import { createTestApp, resetDb, createCompany, loginAs, TestContext } from './helpers/app';

describe('test harness', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await createTestApp(); await resetDb(ctx.prisma); });
  afterAll(async () => { await ctx.app.close(); });

  it('logs in and reads the current user', async () => {
    const company = await createCompany(ctx.prisma);
    const { api, user } = await loginAs(ctx, company.id, 'ADMIN');
    const me = await api.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(user.email);
  });

  it('runs against the test database, never dev', async () => {
    const [{ current_database }] = await ctx.prisma.$queryRawUnsafe<{ current_database: string }[]>('SELECT current_database()');
    expect(current_database).toBe('easybooks_test');
  });
});
