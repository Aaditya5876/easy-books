import { createTestApp, resetDb, createCompany, loginAs, Api, TestContext } from './helpers/app';

// Employee ID is optional on the form: left blank, the next free EMP-number
// is given; a typed one is kept; duplicates are still refused.
describe('Employee ID', () => {
  let ctx: TestContext;
  let admin: Api;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    const companyId = (await createCompany(ctx.prisma, { name: 'Staff Cafe', businessType: 'FOOD_BEVERAGE', modules: [] })).id;
    admin = (await loginAs(ctx, companyId, 'ADMIN')).api;
  });
  afterAll(async () => { await ctx.app.close(); });

  it('blank gets EMP-0001, EMP-0002…; a typed ID is kept; a duplicate is refused', async () => {
    const a = await admin.post('/api/v1/employees', { name: 'Asha' });
    expect(a.status).toBe(201);
    expect(a.body.employeeId).toBe('EMP-0001');
    const b = await admin.post('/api/v1/employees', { name: 'Bikash', employeeId: '' });
    expect(b.body.employeeId).toBe('EMP-0002');
    const c = await admin.post('/api/v1/employees', { name: 'Chandra', employeeId: ' BAKER-7 ' });
    expect(c.body.employeeId).toBe('BAKER-7');
    expect((await admin.post('/api/v1/employees', { name: 'Dup', employeeId: 'EMP-0001' })).status).toBe(409);
    // Numbering continues after the highest EMP-number, not the count.
    await admin.post('/api/v1/employees', { name: 'Typed', employeeId: 'EMP-0010' });
    expect((await admin.post('/api/v1/employees', { name: 'Next' })).body.employeeId).toBe('EMP-0011');
  });

  it('editing without an ID keeps the existing one', async () => {
    const e = (await admin.post('/api/v1/employees', { name: 'Keep Me' })).body;
    expect((await admin.put(`/api/v1/employees/${e.id}`, { name: 'Kept', employeeId: '' })).status).toBe(200);
    const after = (await admin.get(`/api/v1/employees/${e.id}`)).body;
    expect(after).toMatchObject({ name: 'Kept', employeeId: e.employeeId });
  });
});
