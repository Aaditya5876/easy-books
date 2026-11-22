import { createTestApp, resetDb, createCompany, createUser, login, Api, TestContext } from './helpers/app';

// Deleting a client company and setting it up again with the same email.
// Before: deleting a company left its users behind with no company at all, so
// re-creating the client with the same admin email failed with "A user with
// this email already exists" — for an account that could not log in anywhere.
describe('Company lifecycle — delete, then set up again with the same email', () => {
  let ctx: TestContext;
  let superAdmin: Api;
  let saId: string;
  const provision = (companyName: string, adminEmail: string) => superAdmin.post('/api/v1/users/provision-client', {
    companyName, businessType: 'FOOD_BEVERAGE', adminName: 'John Lennon', adminEmail,
  });

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    const home = (await createCompany(ctx.prisma, { name: 'GeoInfosys', businessType: 'SERVICES', modules: [] })).id;
    const sa = await createUser(ctx.prisma, home, 'SUPER_ADMIN');
    saId = sa.id;
    superAdmin = await login(ctx.app, sa.email);
  });
  afterAll(async () => { await ctx.app.close(); });

  it("deleting a company removes logins that belonged only to it, keeps everyone else's", async () => {
    const res = await provision('Nutberry Cafe', 'john@nutberry.test');
    expect(res.status).toBe(201);
    const cafe = res.body.company.id;
    const other = (await createCompany(ctx.prisma, { name: 'Other Branch', businessType: 'FOOD_BEVERAGE', modules: [] })).id;
    const onlyHere = await createUser(ctx.prisma, cafe, 'STAFF');
    const alsoElsewhere = await createUser(ctx.prisma, cafe, 'ACCOUNTANT'); // default = the cafe
    await ctx.prisma.userCompany.create({ data: { userId: alsoElsewhere.id, companyId: other, isDefault: false } });

    expect((await superAdmin.del(`/api/v1/companies/${cafe}`)).status).toBe(200);

    expect(await ctx.prisma.user.findUnique({ where: { email: 'john@nutberry.test' } })).toBeNull();
    expect(await ctx.prisma.user.findUnique({ where: { id: onlyHere.id } })).toBeNull();
    // Still works in the other branch, which is now their default.
    const links = await ctx.prisma.userCompany.findMany({ where: { userId: alsoElsewhere.id } });
    expect(links).toEqual([expect.objectContaining({ companyId: other, isDefault: true })]);
    // The SUPER_ADMIN (linked to every client they create) is never removed.
    expect(await ctx.prisma.user.findUnique({ where: { id: saId } })).not.toBeNull();
  });

  it('the same email can be used again for the new company, and that admin can log in', async () => {
    const res = await provision('Nutberry Cafe', 'john@nutberry.test');
    expect(res.status).toBe(201);
    const admin = await ctx.prisma.user.findUnique({ where: { email: 'john@nutberry.test' }, include: { userCompanies: true } });
    expect(admin).toMatchObject({ role: 'ADMIN', mustChangePassword: true });
    expect(admin!.userCompanies).toEqual([expect.objectContaining({ companyId: res.body.company.id, isDefault: true })]);
    await expect(login(ctx.app, 'john@nutberry.test', undefined, res.body.tempPassword)).resolves.toBeDefined();
  });

  it('an account already left without any company (by an older delete) is reused, not refused', async () => {
    await ctx.prisma.user.create({ data: { email: 'orphan@cafe.test', name: 'Old Name', password: 'x', role: 'STAFF', isActive: false, failedLoginCount: 7 } });
    const res = await provision('Second Cafe', 'orphan@cafe.test');
    expect(res.status).toBe(201);
    const user = await ctx.prisma.user.findUnique({ where: { email: 'orphan@cafe.test' }, include: { userCompanies: true } });
    expect(user).toMatchObject({ role: 'ADMIN', name: 'John Lennon', isActive: true, failedLoginCount: 0, mustChangePassword: true });
    expect(user!.userCompanies).toHaveLength(1);
    await expect(login(ctx.app, 'orphan@cafe.test', undefined, res.body.tempPassword)).resolves.toBeDefined();
  });

  it('an email still in use by another company is refused clearly, and nothing is created', async () => {
    const busy = (await createCompany(ctx.prisma, { name: 'Busy Bakery', businessType: 'FOOD_BEVERAGE', modules: [] })).id;
    await createUser(ctx.prisma, busy, 'ADMIN', { email: 'busy@bakery.test' });
    const before = await ctx.prisma.company.count();
    const res = await provision('Another Cafe', 'busy@bakery.test');
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Busy Bakery');
    expect(await ctx.prisma.company.count()).toBe(before);
  });

  it("a SUPER_ADMIN's email can never become a client admin", async () => {
    const sa = await ctx.prisma.user.findUnique({ where: { id: saId } });
    expect((await provision('Sneaky Cafe', sa!.email)).status).toBe(409);
  });
});
