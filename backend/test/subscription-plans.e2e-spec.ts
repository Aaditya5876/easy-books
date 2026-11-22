import { createTestApp, resetDb, createCompany, createUser, login, Api, TestContext } from './helpers/app';
import { ScheduledTasksService } from '../src/application/services/scheduled-tasks.service';

// OneBook plans (price sheet "one book pricing.xlsx"): a new client gets a
// one-month Premium trial; the first purchase (installation fee) gives a year;
// renewals are monthly / quarterly / half-yearly / yearly. Basic = the admin
// alone, Standard/Premium = more users with roles.
describe('Subscription plans', () => {
  let ctx: TestContext;
  let sa: Api;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bsYear = (require('@easy-books/shared').adToBs(new Date()) as string).slice(0, 4);
  const DAY = 24 * 60 * 60 * 1000;
  const months = (from: Date, n: number) => { const d = new Date(from); d.setMonth(d.getMonth() + n); return d; };
  const near = (a: string | Date, b: Date, ms = 60_000) => Math.abs(new Date(a).getTime() - b.getTime()) < ms;

  const provision = (companyName: string, businessType: string, adminEmail: string, extra: object = {}) =>
    sa.post('/api/v1/users/provision-client', { companyName, businessType, adminName: 'Owner', adminEmail, ...extra });

  async function adminOf(companyId: string, email: string, tempPassword: string) {
    const api = await login(ctx.app, email, companyId, tempPassword);
    return api;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    const home = (await createCompany(ctx.prisma, { name: 'GeoInfosys', businessType: 'SERVICES', modules: [] })).id;
    const superAdmin = await createUser(ctx.prisma, home, 'SUPER_ADMIN');
    sa = await login(ctx.app, superAdmin.email);
  });
  afterAll(async () => { await ctx.app.close(); });

  describe('price list', () => {
    it('comes from the price sheet, one row per product line and tier', async () => {
      const res = await sa.get('/api/v1/subscriptions/prices');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(15);
      const row = (line: string, tier: string) => res.body.find((r: any) => r.productLine === line && r.tier === tier);
      expect(row('HOTEL_CAFE', 'BASIC')).toMatchObject({ installationFee: 8000, monthly: 500, quarterly: 1800, halfYearly: 2950, yearly: 4530 });
      expect(row('SCHOOL', 'PREMIUM')).toMatchObject({ installationFee: 106000, yearly: 34000 });
      expect(row('TRADING', 'PREMIUM')).toMatchObject({ quarterly: 9559, yearly: 31908 });
    });

    it('only GeoInfosys can see or change it', async () => {
      const c = (await createCompany(ctx.prisma, { name: 'Peek Shop', businessType: 'RETAIL', modules: [] })).id;
      const admin = await login(ctx.app, (await createUser(ctx.prisma, c, 'ADMIN')).email, c);
      expect((await admin.get('/api/v1/subscriptions/prices')).status).toBe(403);
    });

    it('GeoInfosys can edit a price; bad numbers are refused', async () => {
      const rows = (await sa.get('/api/v1/subscriptions/prices')).body;
      const hrm = rows.find((r: any) => r.productLine === 'HRM_CRM' && r.tier === 'BASIC');
      const bad = await sa.put(`/api/v1/subscriptions/prices/${hrm.id}`, { installationFee: -1, monthly: 800, quarterly: 2800, halfYearly: 4600, yearly: 8000 });
      expect(bad.status).toBe(400);
      expect(bad.body.message).toMatch(/Installation fee must be at least 0/);
      const ok = await sa.put(`/api/v1/subscriptions/prices/${hrm.id}`, { installationFee: 12500, monthly: 800, quarterly: 2800, halfYearly: 4600, yearly: 8000 });
      expect(ok.status).toBe(200);
      expect(ok.body.installationFee).toBe(12500);
    });
  });

  describe('a new client', () => {
    let cafe: string;
    let admin: Api;

    it('starts on a one-month free Premium trial, on the product line of its business type', async () => {
      const res = await provision('Nutberry Cafe', 'FOOD_BEVERAGE', 'owner@nutberry.test');
      expect(res.status).toBe(201);
      cafe = res.body.company.id;
      const company = await ctx.prisma.company.findUnique({ where: { id: cafe } });
      expect(company).toMatchObject({ productLine: 'HOTEL_CAFE', planTier: 'PREMIUM', planStatus: 'TRIAL' });
      expect(near(company!.subscriptionExpiresAt!, months(new Date(), 1))).toBe(true);
      expect(company!.trialEndsAt).toEqual(company!.subscriptionExpiresAt);
      admin = await adminOf(cafe, 'owner@nutberry.test', res.body.tempPassword);
    });

    it.each([
      ['SCHOOL', 'SCHOOL'], ['PHARMACY', 'CLINIC_PHARMACY'], ['SERVICES', 'HRM_CRM'],
      ['RETAIL', 'TRADING'], ['ELECTRONICS', 'TRADING'], ['MANUFACTURING', 'TRADING'], ['Mobile repair', 'TRADING'],
    ])('business type %s is billed as %s', async (type, line) => {
      const res = await provision(`Co ${type}`, type, `${type.replace(/\W/g, '').toLowerCase()}@lines.test`);
      expect(res.status).toBe(201);
      expect((await ctx.prisma.company.findUnique({ where: { id: res.body.company.id } }))!.productLine).toBe(line);
    });

    it("the admin sees their plan, days left, user count and their line's prices", async () => {
      const res = await admin.get(`/api/v1/subscriptions/company/${cafe}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        productLine: 'HOTEL_CAFE', planTier: 'PREMIUM', planStatus: 'TRIAL', isExpired: false,
        users: { active: 1, max: null }, payments: [],
      });
      expect(res.body.daysLeft).toBeGreaterThanOrEqual(28);
      expect(res.body.daysLeft).toBeLessThanOrEqual(31);
      expect(res.body.prices.map((p: any) => p.tier)).toEqual(['BASIC', 'STANDARD', 'PREMIUM']);
      expect(res.body.prices[0]).toMatchObject({ installationFee: 8000, monthly: 500 });
    });

    it("another company's admin cannot see it", async () => {
      const other = (await createCompany(ctx.prisma, { name: 'Nosy Shop', businessType: 'RETAIL', modules: [] })).id;
      const nosy = await login(ctx.app, (await createUser(ctx.prisma, other, 'ADMIN')).email, other);
      expect((await nosy.get(`/api/v1/subscriptions/company/${cafe}`)).status).toBe(403);
    });

    it('during the trial the admin can add users (trial is Premium)', async () => {
      const res = await admin.post('/api/v1/users/invite', { email: 'cashier@nutberry.test', name: 'Cashier', role: 'STAFF' });
      expect(res.status).toBe(201);
    });

    it('only GeoInfosys can activate or renew', async () => {
      expect((await admin.post(`/api/v1/subscriptions/company/${cafe}/activate`, { planTier: 'BASIC', paymentMethod: 'CASH' })).status).toBe(403);
      expect((await admin.post(`/api/v1/subscriptions/company/${cafe}/renew`, { period: 'YEARLY', paymentMethod: 'CASH' })).status).toBe(403);
    });

    it('renewing before the plan is bought is refused — the first purchase is the installation', async () => {
      const res = await sa.post(`/api/v1/subscriptions/company/${cafe}/renew`, { period: 'MONTHLY', paymentMethod: 'CASH' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/activate/i);
    });

    it('Basic cannot be bought while the company has other active logins', async () => {
      const res = await sa.post(`/api/v1/subscriptions/company/${cafe}/activate`, { planTier: 'BASIC', paymentMethod: 'CASH' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Basic/);
      expect(res.body.message).toMatch(/2 active/);
      expect((await ctx.prisma.company.findUnique({ where: { id: cafe } }))!.planStatus).toBe('TRIAL');
    });

    it('buying Basic during the trial: installation fee, a receipt, and the year starts when the trial ends — no trial days lost', async () => {
      const cashier = await ctx.prisma.user.findUnique({ where: { email: 'cashier@nutberry.test' } });
      expect((await admin.patch(`/api/v1/users/${cashier!.id}/status`, { isActive: false })).status).toBe(200);
      const trialEnds = (await ctx.prisma.company.findUnique({ where: { id: cafe } }))!.trialEndsAt!;

      const res = await sa.post(`/api/v1/subscriptions/company/${cafe}/activate`, { planTier: 'BASIC', paymentMethod: 'BANK_TRANSFER', reference: 'TXN-1' });
      expect(res.status).toBe(201);
      expect(res.body.payment).toMatchObject({
        kind: 'ACTIVATION', planTier: 'BASIC', months: 12, amount: 8000, paymentMethod: 'BANK_TRANSFER',
        receiptNumber: `SUB-${bsYear}-0001`,
      });
      expect(near(res.body.payment.periodStart, trialEnds)).toBe(true);
      const company = await ctx.prisma.company.findUnique({ where: { id: cafe } });
      // The plan they bought applies straight away; the paid year runs on from the trial's end.
      expect(company).toMatchObject({ planTier: 'BASIC', planStatus: 'ACTIVE' });
      expect(near(company!.subscriptionExpiresAt!, months(trialEnds, 12))).toBe(true);
    });

    it('activating twice is refused — the next purchase is a renewal', async () => {
      const res = await sa.post(`/api/v1/subscriptions/company/${cafe}/activate`, { planTier: 'PREMIUM', paymentMethod: 'CASH' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/renew/i);
    });

    it('on Basic the admin cannot invite anyone or switch a suspended login back on', async () => {
      const invite = await admin.post('/api/v1/users/invite', { email: 'waiter@nutberry.test', name: 'Waiter', role: 'STAFF' });
      expect(invite.status).toBe(403);
      expect(invite.body.message).toMatch(/Basic plan/);
      expect(await ctx.prisma.user.findUnique({ where: { email: 'waiter@nutberry.test' } })).toBeNull();

      const cashier = await ctx.prisma.user.findUnique({ where: { email: 'cashier@nutberry.test' } });
      const restore = await admin.patch(`/api/v1/users/${cashier!.id}/status`, { isActive: true });
      expect(restore.status).toBe(403);
      expect((await ctx.prisma.user.findUnique({ where: { id: cashier!.id } }))!.isActive).toBe(false);
    });

    it('renewing early adds the time on top of the current expiry — no days lost', async () => {
      const before = (await ctx.prisma.company.findUnique({ where: { id: cafe } }))!.subscriptionExpiresAt!;
      const res = await sa.post(`/api/v1/subscriptions/company/${cafe}/renew`, { period: 'QUARTERLY', paymentMethod: 'CASH' });
      expect(res.status).toBe(201);
      expect(res.body.payment).toMatchObject({ kind: 'RENEWAL', period: 'QUARTERLY', months: 3, amount: 1800, receiptNumber: `SUB-${bsYear}-0002` });
      const after = (await ctx.prisma.company.findUnique({ where: { id: cafe } }))!.subscriptionExpiresAt!;
      expect(after.getTime()).toBe(months(before, 3).getTime());
    });

    it('upgrading to Standard at renewal charges the Standard price and allows more users', async () => {
      const res = await sa.post(`/api/v1/subscriptions/company/${cafe}/renew`, { period: 'YEARLY', planTier: 'STANDARD', paymentMethod: 'QR' });
      expect(res.status).toBe(201);
      expect(res.body.payment).toMatchObject({ planTier: 'STANDARD', amount: 9500 });
      const cashier = await ctx.prisma.user.findUnique({ where: { email: 'cashier@nutberry.test' } });
      expect((await admin.patch(`/api/v1/users/${cashier!.id}/status`, { isActive: true })).status).toBe(200);
      expect((await admin.post('/api/v1/users/invite', { email: 'waiter@nutberry.test', name: 'Waiter', role: 'STAFF' })).status).toBe(201);
    });

    it('a discounted amount can be typed in; bad input is refused with a clear message', async () => {
      const disc = await sa.post(`/api/v1/subscriptions/company/${cafe}/renew`, { period: 'MONTHLY', amount: 700, paymentMethod: 'CASH', note: 'Dashain offer' });
      expect(disc.status).toBe(201);
      expect(disc.body.payment).toMatchObject({ amount: 700, note: 'Dashain offer' });

      const badPeriod = await sa.post(`/api/v1/subscriptions/company/${cafe}/renew`, { period: 'WEEKLY', paymentMethod: 'CASH' });
      expect(badPeriod.status).toBe(400);
      expect(badPeriod.body.message).toMatch(/monthly, quarterly/i);
      const badAmount = await sa.post(`/api/v1/subscriptions/company/${cafe}/renew`, { period: 'MONTHLY', amount: -5, paymentMethod: 'CASH' });
      expect(badAmount.status).toBe(400);
      const noMethod = await sa.post(`/api/v1/subscriptions/company/${cafe}/renew`, { period: 'MONTHLY' });
      expect(noMethod.status).toBe(400);
    });

    it('the admin sees every payment, newest first', async () => {
      const res = await admin.get(`/api/v1/subscriptions/company/${cafe}`);
      expect(res.body.payments.map((p: any) => p.kind)).toEqual(['RENEWAL', 'RENEWAL', 'RENEWAL', 'ACTIVATION']);
      expect(res.body.payments[3]).toMatchObject({ amount: 8000, reference: 'TXN-1' });
      expect(res.body.users).toEqual({ active: 3, max: null });
    });

    it('renewing after expiry starts from today and lets everyone back in', async () => {
      await ctx.prisma.company.update({ where: { id: cafe }, data: { subscriptionExpiresAt: new Date(Date.now() - 5 * DAY) } });
      expect((await admin.get('/api/v1/clients')).status).toBe(403);

      const res = await sa.post(`/api/v1/subscriptions/company/${cafe}/renew`, { period: 'MONTHLY', paymentMethod: 'CASH' });
      expect(res.status).toBe(201);
      const company = await ctx.prisma.company.findUnique({ where: { id: cafe } });
      expect(near(company!.subscriptionExpiresAt!, months(new Date(), 1))).toBe(true);
      expect(company!.accessBlockedNotifiedAt).toBeNull();
      expect((await admin.get('/api/v1/clients')).status).toBe(200);
    });

    it('the admin can ask for a renewal with a period; GeoInfosys is told which', async () => {
      const res = await admin.post(`/api/v1/companies/${cafe}/request-renewal`, { period: 'HALF_YEARLY', planTier: 'PREMIUM' });
      expect(res.status).toBe(201);
      const note = await ctx.prisma.notification.findFirst({ where: { type: 'SUBSCRIPTION_RENEWAL_REQUESTED', referenceId: cafe } });
      expect(note!.message).toMatch(/Half-yearly/);
      expect(note!.message).toMatch(/Premium/);
    });
  });

  describe('asking for a cheaper plan while the free Premium trial still runs', () => {
    let shop: string;
    let owner: Api;
    let pwd: string;
    const requests = () => ctx.prisma.notification.count({ where: { type: 'SUBSCRIPTION_RENEWAL_REQUESTED', referenceId: shop } });

    beforeAll(async () => {
      const res = await provision('Tea Shop ABC', 'FOOD_BEVERAGE', 'owner@abctea.test');
      shop = res.body.company.id;
      pwd = res.body.tempPassword;
      owner = await adminOf(shop, 'owner@abctea.test', pwd);
    });

    it('needs the password — without it nothing is sent', async () => {
      const res = await owner.post(`/api/v1/companies/${shop}/request-renewal`, { planTier: 'BASIC' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/password/i);
      expect(await requests()).toBe(0);
    });

    it('a wrong password is refused (403, not a logout)', async () => {
      const res = await owner.post(`/api/v1/companies/${shop}/request-renewal`, { planTier: 'STANDARD', password: 'wrong-one' });
      expect(res.status).toBe(403);
      expect(await requests()).toBe(0);
    });

    it('with the right password it is sent, and GeoInfosys is told the trial ends early', async () => {
      const res = await owner.post(`/api/v1/companies/${shop}/request-renewal`, { planTier: 'BASIC', password: pwd });
      expect(res.status).toBe(201);
      const note = await ctx.prisma.notification.findFirst({ where: { type: 'SUBSCRIPTION_RENEWAL_REQUESTED', referenceId: shop } });
      expect(note!.message).toMatch(/Basic/);
      expect(note!.message).toMatch(/ends the free Premium trial early/i);
      expect(note!.message).not.toContain(pwd);
    });

    it('asking for Premium during the trial gives nothing up — no password needed', async () => {
      expect((await owner.post(`/api/v1/companies/${shop}/request-renewal`, { planTier: 'PREMIUM' })).status).toBe(201);
    });

    it('after the trial ran out, a cheaper plan needs no password', async () => {
      const past = new Date(Date.now() - DAY);
      await ctx.prisma.company.update({ where: { id: shop }, data: { trialEndsAt: past, subscriptionExpiresAt: past } });
      // Like the app: sent without a companyId, so the locked-out admin can still ask.
      owner.companyId = undefined;
      expect((await owner.post(`/api/v1/companies/${shop}/request-renewal`, { planTier: 'BASIC' })).status).toBe(201);
    });
  });

  it('a client who already paid can start on a paid plan right away', async () => {
    const res = await provision('Paid Pharmacy', 'PHARMACY', 'owner@paidpharmacy.test', { plan: { planTier: 'STANDARD', paymentMethod: 'CASH' } });
    expect(res.status).toBe(201);
    const company = await ctx.prisma.company.findUnique({ where: { id: res.body.company.id }, include: { subscriptionPayments: true } });
    expect(company).toMatchObject({ productLine: 'CLINIC_PHARMACY', planTier: 'STANDARD', planStatus: 'ACTIVE' });
    expect(near(company!.subscriptionExpiresAt!, months(new Date(), 12))).toBe(true);
    expect(company!.subscriptionPayments).toEqual([expect.objectContaining({ kind: 'ACTIVATION', amount: expect.anything() })]);
    expect(Number(company!.subscriptionPayments[0].amount)).toBe(24000);
  });

  it('companies set up before plans existed keep unlimited access and users', async () => {
    const old = (await createCompany(ctx.prisma, { name: 'Old Client', businessType: 'RETAIL', modules: [] })).id;
    const admin = await login(ctx.app, (await createUser(ctx.prisma, old, 'ADMIN')).email, old);
    const res = await admin.get(`/api/v1/subscriptions/company/${old}`);
    expect(res.body).toMatchObject({ planTier: null, planStatus: null, subscriptionExpiresAt: null, daysLeft: null, users: { active: 1, max: null } });
    expect((await admin.post('/api/v1/users/invite', { email: 'clerk@old.test', name: 'Clerk', role: 'STAFF' })).status).toBe(201);
    // …and GeoInfosys can put them on a plan (activation, even with 0 paid).
    const act = await sa.post(`/api/v1/subscriptions/company/${old}/activate`, { planTier: 'PREMIUM', amount: 0, paymentMethod: 'OTHER', note: 'Existing client' });
    expect(act.status).toBe(201);
    expect(act.body.payment.amount).toBe(0);
    // No trial to carry over: the year starts today.
    expect(near(act.body.company.subscriptionExpiresAt, months(new Date(), 12))).toBe(true);
  });

  it('buying after the trial ran out: the year starts today', async () => {
    const res = await provision('Late Buyer', 'RETAIL', 'owner@latebuyer.test');
    const id = res.body.company.id;
    const past = new Date(Date.now() - 3 * DAY);
    await ctx.prisma.company.update({ where: { id }, data: { trialEndsAt: past, subscriptionExpiresAt: past } });
    const act = await sa.post(`/api/v1/subscriptions/company/${id}/activate`, { planTier: 'STANDARD', paymentMethod: 'CASH' });
    expect(act.status).toBe(201);
    expect(near(act.body.payment.periodStart, new Date())).toBe(true);
    expect(near(act.body.company.subscriptionExpiresAt, months(new Date(), 12))).toBe(true);
  });

  describe('expiry reminders (nightly)', () => {
    it('tells the admin 30, 7 and 1 day(s) before — once per step', async () => {
      const res = await provision('Reminder Cafe', 'FOOD_BEVERAGE', 'owner@reminder.test');
      const id = res.body.company.id;
      const tasks = ctx.app.get(ScheduledTasksService);
      const count = () => ctx.prisma.notification.count({ where: { companyId: id, type: 'SUBSCRIPTION_EXPIRING', user: { role: 'ADMIN' } } });

      await ctx.prisma.company.update({ where: { id }, data: { subscriptionExpiresAt: new Date(Date.now() + 20 * DAY) } });
      await tasks.notifyExpiringSubscriptions();
      await tasks.notifyExpiringSubscriptions();
      expect(await count()).toBe(1);
      const first = await ctx.prisma.notification.findFirst({ where: { companyId: id, type: 'SUBSCRIPTION_EXPIRING' } });
      expect(first!.message).toMatch(/free trial/i);

      await ctx.prisma.company.update({ where: { id }, data: { subscriptionExpiresAt: new Date(Date.now() + 5 * DAY) } });
      await tasks.notifyExpiringSubscriptions();
      expect(await count()).toBe(2);

      await ctx.prisma.company.update({ where: { id }, data: { subscriptionExpiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000) } });
      await tasks.notifyExpiringSubscriptions();
      await tasks.notifyExpiringSubscriptions();
      expect(await count()).toBe(3);
    });

    it('starts over after a renewal, and never nags far-off or unlimited plans', async () => {
      const res = await provision('Fresh Cafe', 'FOOD_BEVERAGE', 'owner@fresh.test', { plan: { planTier: 'PREMIUM', paymentMethod: 'CASH' } });
      const id = res.body.company.id;
      const tasks = ctx.app.get(ScheduledTasksService);
      await tasks.notifyExpiringSubscriptions();
      expect(await ctx.prisma.notification.count({ where: { companyId: id, type: 'SUBSCRIPTION_EXPIRING' } })).toBe(0);

      await ctx.prisma.company.update({ where: { id }, data: { subscriptionExpiresAt: new Date(Date.now() + 3 * DAY) } });
      await tasks.notifyExpiringSubscriptions();
      expect((await ctx.prisma.company.findUnique({ where: { id } }))!.expiryReminderDays).toBe(7);
      await sa.post(`/api/v1/subscriptions/company/${id}/renew`, { period: 'MONTHLY', paymentMethod: 'CASH' });
      expect((await ctx.prisma.company.findUnique({ where: { id } }))!.expiryReminderDays).toBeNull();
    });
  });
});
