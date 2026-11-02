import { createTestApp, resetDb, login, TestContext } from './helpers/app';
import { createSchool, School } from './helpers/school';

const S = '/api/v1/school';

// A staff user must never reach another company's records by leaving
// companyId off the request: services filter with `where: { id, companyId }`,
// and Prisma drops an undefined filter, matching the id in any company.
describe('Tenant isolation', () => {
  let ctx: TestContext;
  let a: School;
  let b: School;
  let clientB: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    a = await createSchool(ctx, 1);
    b = await createSchool(ctx, 1);
    clientB = (await ctx.prisma.client.create({ data: { companyId: b.companyId, name: 'B Client' } })).id;
  });
  afterAll(async () => ctx.app.close());

  // Company A's admin, logged in, but sending no companyId.
  async function adminAWithoutCompanyId() {
    const user = await ctx.prisma.user.findFirst({ where: { role: 'ADMIN', userCompanies: { some: { companyId: a.companyId } } } });
    return login(ctx.app, user!.email);
  }

  it('rejects requests that omit companyId instead of matching any company', async () => {
    const api = await adminAWithoutCompanyId();
    const student = b.students[0].id;

    expect((await api.get(`${S}/students/${student}`)).status).toBe(400);
    expect((await api.put(`${S}/students/${student}`, { name: 'Renamed by A' })).status).toBe(400);
    expect((await api.put(`${S}/classes/${b.classId}`, { name: 'Hijacked' })).status).toBe(400);
    expect((await api.put(`/api/v1/clients/${clientB}`, { name: 'Hijacked' })).status).toBe(400);
    expect((await api.del(`${S}/students/${student}`)).status).toBe(400);

    const row = await ctx.prisma.student.findUnique({ where: { id: student } });
    expect(row).toMatchObject({ name: 'Student 1', status: 'ACTIVE' });
    expect((await ctx.prisma.schoolClass.findUnique({ where: { id: b.classId } }))?.name).toBe('Class 5');
    expect((await ctx.prisma.client.findUnique({ where: { id: clientB } }))?.name).toBe('B Client');
  });

  it("still 404s another company's record when A sends its own companyId", async () => {
    expect((await a.admin.put(`${S}/students/${b.students[0].id}`, { name: 'X' })).status).toBe(404);
  });

  it('keeps user-scoped routes working without companyId', async () => {
    const api = await adminAWithoutCompanyId();
    expect((await api.get('/api/v1/auth/me')).status).toBe(200);
    expect((await api.get('/api/v1/notifications')).status).toBe(200);
    expect((await api.get('/api/v1/companies/user-companies')).status).toBe(200);
    expect((await api.get(`/api/v1/companies/${a.companyId}`)).status).toBe(200);
  });
});
