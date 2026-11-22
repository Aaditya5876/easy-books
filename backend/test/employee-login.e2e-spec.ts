import { createTestApp, resetDb, createCompany, createUser, login, Api, TestContext } from './helpers/app';

// Employees vs app logins:
//  - Every login (invite / Create Client) is also an employee — attendance,
//    leave and payroll attach to that record. Their ROLE (app permission) is
//    not their DESIGNATION (job title): the auto-created record used to get
//    "ADMIN" as designation and a "USER-<uuid>" employee ID.
//  - Employees without a login (the baker, the cleaner) are HR records only.
//  - The Employees list shows each row's app access (role + duties) or none.
describe('Employees and app logins', () => {
  let ctx: TestContext;
  let admin: Api;
  let companyId: string;
  const list = async () => (await admin.get('/api/v1/employees')).body as any[];
  const row = async (email: string) => (await list()).find((e) => e.email === email);

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    const home = (await createCompany(ctx.prisma, { name: 'GeoInfosys', businessType: 'SERVICES', modules: [] })).id;
    const sa = await login(ctx.app, (await createUser(ctx.prisma, home, 'SUPER_ADMIN')).email);
    const res = await sa.post('/api/v1/users/provision-client', { companyName: 'Login Cafe', businessType: 'FOOD_BEVERAGE', adminName: 'Owner', adminEmail: 'owner@login.test' });
    companyId = res.body.company.id;
    admin = await login(ctx.app, 'owner@login.test', companyId, res.body.tempPassword);
  });
  afterAll(async () => { await ctx.app.close(); });

  it("the owner's employee record has no role as designation and a normal employee number", async () => {
    const owner = await row('owner@login.test');
    expect(owner.designation).toBeNull();
    expect(owner.employeeId).toMatch(/^EMP-\d{4}$/);
    expect(owner.login).toMatchObject({ role: 'ADMIN', isActive: true });
  });

  it('an invited user becomes an employee with their access shown, designation left for HR', async () => {
    expect((await admin.post('/api/v1/users/invite', { email: 'cash@login.test', name: 'Sita', role: 'STAFF', staffTags: ['SALES'] })).status).toBe(201);
    const sita = await row('cash@login.test');
    expect(sita).toMatchObject({ name: 'Sita', designation: null });
    expect(sita.employeeId).toMatch(/^EMP-\d{4}$/);
    expect(sita.login).toMatchObject({ role: 'STAFF', staffTags: ['SALES'], isActive: true });
  });

  it('an employee without a login shows no app access', async () => {
    await admin.post('/api/v1/employees', { name: 'Hari Cleaner', designation: 'Cleaner', basicSalary: 12000 });
    const hari = (await list()).find((e) => e.name === 'Hari Cleaner');
    expect(hari.login).toBeNull();
  });

  it('giving an existing employee app access links the same record (no duplicate), keeping their designation', async () => {
    await admin.post('/api/v1/employees', { name: 'Ram Baker', email: 'baker@login.test', designation: 'Baker', basicSalary: 25000 });
    const before = (await list()).length;
    expect((await admin.post('/api/v1/users/invite', { email: 'baker@login.test', name: 'Ram Baker', role: 'STAFF' })).status).toBe(201);
    expect((await list()).length).toBe(before);
    expect(await row('baker@login.test')).toMatchObject({ designation: 'Baker', login: { role: 'STAFF' } });
  });

  it("changing someone's role or suspending them changes access, never the designation", async () => {
    const user = await ctx.prisma.user.findUnique({ where: { email: 'baker@login.test' } });
    expect((await admin.patch(`/api/v1/users/${user!.id}/role`, { role: 'ACCOUNTANT', companyId })).status).toBe(200);
    expect((await admin.patch(`/api/v1/users/${user!.id}/status`, { isActive: false, companyId })).status).toBe(200);
    expect(await row('baker@login.test')).toMatchObject({ designation: 'Baker', login: { role: 'ACCOUNTANT', isActive: false } });
  });
});
