import { createTestApp, resetDb, Api, TestContext } from './helpers/app';
import { createSchool, portalLogin, portalCookieToken, School } from './helpers/school';

// A portal session lives in an HttpOnly cookie (page scripts can't read it),
// and stops working as soon as the parent logs out, changes the password, or
// the school resets/disables access — not 30 days later.
describe('Portal sessions', () => {
  let ctx: TestContext;
  let school: School;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    school = await createSchool(ctx, 2);
  });
  afterAll(async () => ctx.app.close());

  const login = (phone: string, password = 'Kid@12345') =>
    new Api(ctx.app).agent.post('/api/v1/portal/login').send({ phone, password });
  // A client holding a copied token (e.g. stolen), sent as a Bearer header.
  const holding = (token?: string) => Object.assign(new Api(ctx.app), { bearer: token });

  it('login sets an HttpOnly cookie and never hands the token to page scripts', async () => {
    const student = school.students[0];
    await portalLogin(ctx, school, student);
    const res = await login(student.phone);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeUndefined();
    const cookie = ([] as string[]).concat(res.headers['set-cookie']).find((c) => c.startsWith('portalToken='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('logout revokes the token and clears the cookie', async () => {
    const student = school.students[0];
    const portal = await portalLogin(ctx, school, student);
    const stolen = holding(portalCookieToken(await login(student.phone)));
    expect((await portal.get('/api/v1/portal/me')).status).toBe(200);
    expect((await stolen.get('/api/v1/portal/me')).status).toBe(200);
    const out = await portal.post('/api/v1/portal/logout');
    expect(out.status).toBe(201);
    expect(String(out.headers['set-cookie'])).toMatch(/portalToken=;/);
    expect((await stolen.get('/api/v1/portal/me')).status).toBe(401);
    expect((await portal.get('/api/v1/portal/me')).status).toBe(401);
  });

  it('changing the password revokes other sessions but keeps this one', async () => {
    const student = school.students[1];
    const portal = await portalLogin(ctx, school, student);
    const stolen = holding(portalCookieToken(await login(student.phone)));
    const res = await portal.patch('/api/v1/portal/change-password', { currentPassword: 'Kid@12345', newPassword: 'Kid@99999' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect((await stolen.get('/api/v1/portal/me')).status).toBe(401);
    expect((await portal.get('/api/v1/portal/me')).status).toBe(200);
  });

  it('an admin password reset revokes the old session', async () => {
    const student = school.students[0];
    const portal = await portalLogin(ctx, school, student);
    await school.admin.post('/api/v1/portal/set-password', { studentId: student.id, phone: student.phone, password: 'Reset@123' });
    expect((await portal.get('/api/v1/portal/me')).status).toBe(401);
  });

  it('tokens expire within 7 days', async () => {
    const student = school.students[0];
    await portalLogin(ctx, school, student);
    const token = portalCookieToken(await login(student.phone))!;
    const { exp, iat } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(exp - iat).toBeLessThanOrEqual(7 * 24 * 3600);
  });
});
