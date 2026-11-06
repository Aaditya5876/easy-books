import request = require('supertest');
import { createTestApp, resetDb, createCompany, createUser, PASSWORD, TestContext } from './helpers/app';
import { createSchool, School } from './helpers/school';

// Per-IP throttling alone doesn't stop guessing spread across many IPs, so
// each account locks for a while after repeated wrong passwords.
describe('Login hardening', () => {
  let ctx: TestContext;
  let school: School;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    school = await createSchool(ctx, 2);
  });
  afterAll(async () => ctx.app.close());

  it('locks a staff account after 5 wrong passwords, even for the right one', async () => {
    const companyId = (await createCompany(ctx.prisma)).id;
    const user = await createUser(ctx.prisma, companyId, 'ACCOUNTANT');
    const login = (password: string) => http().post('/api/v1/auth/login').send({ email: user.email, password });

    for (let i = 0; i < 5; i++) expect((await login('Wrong@123')).status).toBe(401);
    const locked = await login(PASSWORD);
    expect(locked.status).toBe(429);
    expect((await http().post('/api/v1/auth/quick-attendance').send({ email: user.email, password: PASSWORD, action: 'IN' })).status).toBe(429);

    // Once the lock lapses the right password works and the count starts over.
    await ctx.prisma.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    expect((await login(PASSWORD)).status).toBe(200);
    expect((await ctx.prisma.user.findUnique({ where: { id: user.id } }))?.failedLoginCount).toBe(0);
  });

  it('a successful login clears earlier failures', async () => {
    const companyId = (await createCompany(ctx.prisma)).id;
    const user = await createUser(ctx.prisma, companyId, 'STAFF');
    const login = (password: string) => http().post('/api/v1/auth/login').send({ email: user.email, password });
    for (let i = 0; i < 4; i++) await login('Wrong@123');
    expect((await login(PASSWORD)).status).toBe(200);
    for (let i = 0; i < 4; i++) await login('Wrong@123');
    expect((await login(PASSWORD)).status).toBe(200);
  });

  it('locks a portal account after 5 wrong passwords', async () => {
    const student = school.students[0];
    await school.admin.post('/api/v1/portal/set-password', { studentId: student.id, phone: student.phone, password: 'Kid@1234' });
    const login = (password: string) => http().post('/api/v1/portal/login').send({ phone: student.phone, password });
    for (let i = 0; i < 5; i++) expect((await login('Nope@1234')).status).toBe(401);
    expect((await login('Kid@1234')).status).toBe(429);
  });

  it('new passwords need at least 8 characters', async () => {
    const reg = await http().post('/api/v1/auth/register').send({ email: 'short@test.local', password: 'Ab@1234', name: 'X', companyName: 'Y' });
    expect(reg.status).toBe(400);
    const student = school.students[1];
    expect((await school.admin.post('/api/v1/portal/set-password', { studentId: student.id, phone: student.phone, password: 'Kid@123' })).status).toBe(400);
  });
});
