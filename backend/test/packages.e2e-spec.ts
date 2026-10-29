import { createTestApp, resetDb, createCompany, loginAs, TestContext, PREMIUM, STANDARD, BASE } from './helpers/app';

const S = '/api/v1/school';
const FINANCE_TOOLS = ['/api/v1/fiscal-year/status', '/api/v1/fixed-assets', '/api/v1/petty-cash', '/api/v1/cheques', '/api/v1/bank-guarantees'];

describe('Package (plan) access', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await createTestApp(); await resetDb(ctx.prisma); });
  afterAll(async () => { await ctx.app.close(); });

  const adminFor = async (modules: string[], businessType = 'SCHOOL') => {
    const company = await createCompany(ctx.prisma, { modules, businessType });
    return (await loginAs(ctx, company.id, 'ADMIN')).api;
  };

  it('Premium school can use fiscal year, fixed assets, petty cash, cheques and bank guarantees', async () => {
    const admin = await adminFor(PREMIUM);
    for (const url of FINANCE_TOOLS) expect([url, (await admin.get(url)).status]).toEqual([url, 200]);
  });

  it('Standard and Base schools cannot (no ledger in their plan)', async () => {
    for (const modules of [STANDARD, BASE]) {
      const admin = await adminFor(modules);
      for (const url of FINANCE_TOOLS) expect([url, (await admin.get(url)).status]).toEqual([url, 403]);
    }
  });

  it('older business accounts on the legacy FINANCE key, or unrestricted, keep access', async () => {
    for (const modules of [['FINANCE'], []]) {
      const admin = await adminFor(modules, 'RETAIL');
      for (const url of FINANCE_TOOLS) expect([url, (await admin.get(url)).status]).toEqual([url, 200]);
    }
  });

  describe('what each school plan includes', () => {
    const always = [`${S}/students`, `${S}/classes`, `${S}/fee-invoices`, `${S}/fee-heads`, `${S}/attendance/summary`, `${S}/notices`, '/api/v1/employees', '/api/v1/employees/directory', '/api/v1/notifications/unread-count'];
    const academics = [`${S}/exams`, `${S}/homework`, `${S}/study-materials`, `${S}/timetable`];
    const premiumOnly = [`${S}/library/books`, `${S}/hostel/rooms`, `${S}/transport/routes`, '/api/v1/payroll/summary', '/api/v1/attendance', '/api/v1/leave/types', '/api/v1/ledger/accounts', '/api/v1/transactions'];

    it.each([
      ['BASE', BASE, always, [...academics, ...premiumOnly]],
      ['STANDARD', STANDARD, [...always, ...academics], premiumOnly],
      ['PREMIUM', PREMIUM, [...always, ...academics, ...premiumOnly], []],
    ])('%s', async (_name, modules, allowed, blocked) => {
      const admin = await adminFor(modules);
      for (const url of allowed) expect([url, (await admin.get(url, { month: '2083-07', classId: '00000000-0000-0000-0000-000000000000' })).status]).toEqual([url, 200]);
      for (const url of blocked) expect([url, (await admin.get(url, { month: '2083-07' })).status]).toEqual([url, 403]);
    });
  });
});
