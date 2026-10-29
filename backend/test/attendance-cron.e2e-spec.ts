import { createTestApp, resetDb, createCompany, createUser, loginAs, Api, TestContext, PASSWORD, STANDARD, nepalToday } from './helpers/app';
import { createSchool, School } from './helpers/school';

describe('Staff attendance (login page, My Attendance, Staff Attendance)', () => {
  let ctx: TestContext;
  let school: School;
  beforeAll(async () => { ctx = await createTestApp(); await resetDb(ctx.prisma); school = await createSchool(ctx, 1); });
  afterAll(async () => { await ctx.app.close(); });

  const quick = (email: string, action: 'IN' | 'OUT', password = PASSWORD) =>
    new Api(ctx.app).agent.post('/api/v1/auth/quick-attendance').send({ email, password, action });

  it.each(['ADMIN', 'ACCOUNTANT', 'STAFF', 'TEACHER'] as const)('%s can check in and out from the login page', async (role) => {
    const user = await createUser(ctx.prisma, school.companyId, role);
    const inRes = await quick(user.email, 'IN');
    expect(inRes.status).toBe(200);
    expect(inRes.body.record.checkInTime).toMatch(/^\d{2}:\d{2}$/);
    expect((await quick(user.email, 'IN')).status).toBe(400);
    expect((await quick(user.email, 'OUT')).status).toBe(200);
    expect((await quick(user.email, 'OUT')).status).toBe(400);
  });

  it('records the Nepal date and time, not the server clock', async () => {
    const user = await createUser(ctx.prisma, school.companyId, 'STAFF');
    const res = await quick(user.email, 'IN');
    expect(res.body.record.date.slice(0, 10)).toBe(nepalToday());
    const nepalNow = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kathmandu', hour: '2-digit', minute: '2-digit', hour12: false });
    const diff = Math.abs(Number(nepalNow.replace(':', '')) - Number(res.body.record.checkInTime.replace(':', '')));
    expect(diff === 0 || diff === 1 || diff === 41).toBe(true); // same minute (or just ticked over)
  });

  it('refuses check-out before check-in, and a wrong password', async () => {
    const user = await createUser(ctx.prisma, school.companyId, 'TEACHER');
    expect((await quick(user.email, 'OUT')).status).toBe(400);
    expect((await quick(user.email, 'IN', 'wrong')).status).toBe(401);
  });

  it('platform owner gets a clear message', async () => {
    const owner = await createUser(ctx.prisma, school.companyId, 'SUPER_ADMIN');
    const res = await quick(owner.email, 'IN');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/platform owner/i);
  });

  it('a plan without staff attendance refuses login-page check-in', async () => {
    const company = await createCompany(ctx.prisma, { modules: STANDARD });
    const user = await createUser(ctx.prisma, company.id, 'TEACHER');
    expect((await quick(user.email, 'IN')).status).toBe(403);
  });

  it('My Attendance links the login to its employee record', async () => {
    const { api } = await loginAs(ctx, school.companyId, 'TEACHER');
    const today = (await api.get('/api/v1/attendance/self/today')).body;
    expect(today.linked).toBe(true);
    expect((await api.post('/api/v1/attendance/self', { action: 'IN' })).status).toBe(201);
  });

  it('Staff Attendance list shows employee names', async () => {
    const rows = (await school.admin.get('/api/v1/attendance')).body as any[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.employeeName)).toBe(true);
  });

  it('manual mark requires an employee and a valid status', async () => {
    expect((await school.admin.post('/api/v1/attendance', { date: '2026-10-26', status: 'ABSENT' })).status).toBe(400);
    const emp = (await school.admin.post('/api/v1/employees', { name: 'Driver', employeeId: 'D-1' })).body.id;
    expect((await school.admin.post('/api/v1/attendance', { employeeId: emp, date: '2026-10-26', status: 'SICK' })).status).toBe(400);
    expect((await school.admin.post('/api/v1/attendance', { employeeId: emp, date: '2026-10-26', status: 'ABSENT' })).status).toBe(201);
  });
});

describe('Cron endpoints (Vercel Cron)', () => {
  let ctx: TestContext;
  let school: School;
  beforeAll(async () => { ctx = await createTestApp(); await resetDb(ctx.prisma); school = await createSchool(ctx, 2); });
  afterAll(async () => { await ctx.app.close(); });

  const call = (path: string, auth?: string) => {
    const r = new Api(ctx.app).agent.get(`/api/v1/cron/${path}`);
    return auth ? r.set('Authorization', auth) : r;
  };

  it('refuse calls without the secret', async () => {
    expect((await call('nightly-automation')).status).toBe(401);
    expect((await call('nightly-automation', 'Bearer wrong')).status).toBe(401);
    expect((await call('expired-companies', 'Bearer wrong')).status).toBe(401);
  });

  it('refuse everything when no secret is configured', async () => {
    const secret = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      expect((await call('nightly-automation', 'Bearer undefined')).status).toBe(401);
    } finally {
      process.env.CRON_SECRET = secret;
    }
  });

  it('nightly automation bills students and payroll runs without a queue', async () => {
    const a = school.admin;
    await a.post('/api/v1/school/fee-heads/defaults');
    const tui = ((await a.get('/api/v1/school/fee-heads')).body as any[]).find((h) => h.code === 'TUI').id;
    await a.post('/api/v1/school/fee-structures', { classId: school.classId, feeHeadId: tui, name: 'Tuition', amount: 1000, frequency: 'MONTHLY' });
    await a.post('/api/v1/employees', { name: 'Teacher', employeeId: 'T-1', basicSalary: 20000 });

    expect((await call('nightly-automation', `Bearer ${process.env.CRON_SECRET}`)).status).toBe(200);
    const inv = (await a.get('/api/v1/school/fee-invoices')).body;
    expect((Array.isArray(inv) ? inv : inv.data)).toHaveLength(2);
    expect(await ctx.prisma.payroll.count({ where: { companyId: school.companyId } })).toBeGreaterThanOrEqual(1);
  });

  it('expired-companies notifies once', async () => {
    await ctx.prisma.company.update({ where: { id: school.companyId }, data: { subscriptionExpiresAt: new Date(Date.now() - 60_000) } });
    expect((await call('expired-companies', `Bearer ${process.env.CRON_SECRET}`)).status).toBe(200);
    const c = await ctx.prisma.company.findUniqueOrThrow({ where: { id: school.companyId } });
    expect(c.accessBlockedNotifiedAt).toBeTruthy();
  });
});
