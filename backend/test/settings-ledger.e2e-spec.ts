import { createTestApp, resetDb, createCompany, createUser, login, loginAs, Api, TestContext, sent, nepalToday } from './helpers/app';
import { createSchool, billAndRelease, ledgerTotals, School } from './helpers/school';

const S = '/api/v1/school';

describe('Settings, ledger and reports', () => {
  let ctx: TestContext;
  let school: School;
  let admin: Api;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    school = await createSchool(ctx, 2);
    admin = school.admin;
    await billAndRelease(school);
  });
  afterAll(async () => { await ctx.app.close(); });

  describe('Settings → Users', () => {
    let invitedId: string;

    it('validates invites: role, ADMIN-only grants, staff tags', async () => {
      expect((await admin.post('/api/v1/users/invite', { email: 'x@test.local', name: 'X', role: 'GOD' })).status).toBe(400);
      expect((await admin.post('/api/v1/users/invite', { email: 'x@test.local', name: 'X', role: 'ADMIN' })).status).toBe(403);
      expect((await admin.post('/api/v1/users/invite', { email: 'x@test.local', name: 'X', role: 'STAFF', staffTags: ['PILOT'] })).status).toBe(400);
    });

    it('invites a staff member: login emailed, employee record created', async () => {
      sent.mail.length = 0;
      const res = await admin.post('/api/v1/users/invite', { email: 'invited@test.local', name: 'Invited', role: 'STAFF', staffTags: ['HR'] });
      expect(res.status).toBe(201);
      invitedId = res.body.userId;
      expect(sent.mail).toHaveLength(1);
      expect(((await admin.get('/api/v1/employees')).body as any[]).some((e) => e.email === 'invited@test.local')).toBe(true);
    });

    it('changes role, suspends, reactivates and removes', async () => {
      expect((await admin.patch(`/api/v1/users/${invitedId}/role`, { role: 'ACCOUNTANT' })).status).toBe(200);
      expect((await admin.patch(`/api/v1/users/${invitedId}/status`, { isActive: false })).status).toBe(200);
      expect((await admin.patch(`/api/v1/users/${invitedId}/status`, { isActive: true })).status).toBe(200);
      expect((await admin.del(`/api/v1/users/${invitedId}`)).status).toBe(200);
    });

    it('super admin Create Client gives the new admin an employee record (own attendance works)', async () => {
      const owner = await createUser(ctx.prisma, (await createCompany(ctx.prisma, { name: 'Platform' })).id, 'SUPER_ADMIN');
      const sa = await login(ctx.app, owner.email);
      const res = await sa.post('/api/v1/users/provision-client', { companyName: 'New School', businessType: 'SCHOOL', adminName: 'Principal', adminEmail: 'principal@test.local' });
      expect(res.status).toBe(201);
      const emp = await ctx.prisma.employee.findFirst({ where: { companyId: res.body.company.id, email: 'principal@test.local' } });
      expect(emp).toBeTruthy();
    });
  });

  describe('Settings → Preferences / Automation / Notifications', () => {
    it('saves invoice prefix and automation switches', async () => {
      const res = await admin.put(`/api/v1/companies/${school.companyId}`, { abbreviation: 'QTS', autoFeeBilling: false, autoPayroll: false });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ abbreviation: 'QTS', autoFeeBilling: false, autoPayroll: false });
    });

    it('ignores fields an admin may not change (and extra fields the edit dialog sends)', async () => {
      const before = await ctx.prisma.company.findUniqueOrThrow({ where: { id: school.companyId } });
      const res = await admin.put(`/api/v1/companies/${school.companyId}`, {
        ...before, name: 'Renamed School', _count: { users: 3 }, admins: [], invoiceSequence: 0, feeReceiptSequence: 0,
        enabledModules: ['EVERYTHING'], isActive: false, subscriptionExpiresAt: null,
      });
      expect(res.status).toBe(200);
      const after = await ctx.prisma.company.findUniqueOrThrow({ where: { id: school.companyId } });
      expect(after.name).toBe('Renamed School');
      expect(after.enabledModules).toEqual(before.enabledModules);
      expect(after.feeReceiptSequence).toBe(before.feeReceiptSequence);
      expect(after.invoiceSequence).toBe(before.invoiceSequence);
      expect(after.isActive).toBe(true);
    });

    it('payroll settings save', async () => {
      expect((await admin.patch(`/api/v1/companies/${school.companyId}/payroll-settings`, { workingDaysPerMonth: 26, standardStartTime: '10:00', standardEndTime: '16:00', attendanceDeductionEnabled: false })).status).toBe(200);
      expect((await admin.get(`/api/v1/companies/${school.companyId}/payroll-settings`)).body.workingDaysPerMonth).toBe(26);
    });

    it('notification bell and preferences load', async () => {
      expect((await admin.get('/api/v1/notifications')).status).toBe(200);
      expect((await admin.get('/api/v1/notifications/unread-count')).status).toBe(200);
      expect((await admin.get('/api/v1/notifications/preferences')).status).toBe(200);
    });

    it('bank accounts: required fields and create', async () => {
      expect((await admin.post('/api/v1/bank-accounts', { accountNumber: '1' })).status).toBe(400);
      expect((await admin.post('/api/v1/bank-accounts', { bankName: 'NIC Asia', accountName: 'School', accountNumber: '0011', accountType: 'CURRENT', openingBalance: 10000 })).status).toBe(201);
    });

    it('audit log records changes', async () => {
      expect(((await admin.get('/api/v1/audit-logs')).body.data ?? (await admin.get('/api/v1/audit-logs')).body).length).toBeGreaterThan(0);
    });
  });

  describe('ledger and transactions', () => {
    it('a manual expense posts a balanced pair to the ledger', async () => {
      const before = await ledgerTotals(admin);
      expect((await admin.post('/api/v1/transactions', { dateAd: nepalToday(), type: 'CASH', category: 'EXPENSE' })).status).toBe(400);
      const tx = await admin.post('/api/v1/transactions', { dateAd: nepalToday(), type: 'CASH', category: 'EXPENSE', amount: 2500, description: 'Electricity', partyName: 'NEA' });
      expect(tx.status).toBe(201);
      expect((await admin.put(`/api/v1/transactions/${tx.body.id}`, { description: 'Electricity Kartik' })).status).toBe(200);
      const after = await ledgerTotals(admin);
      expect(after.count).toBeGreaterThan(before.count);
      expect(after.debit).toBeCloseTo(after.credit, 2);
    });

    it('add an account and a manual journal entry; same account on both sides is refused', async () => {
      expect((await admin.post('/api/v1/ledger/accounts', { accountType: 'EXPENSE' })).status).toBe(400);
      const util = await admin.post('/api/v1/ledger/accounts', { accountName: 'Utilities Expense', accountCode: '5999', accountType: 'EXPENSE' });
      expect(util.status).toBe(201);
      const cash = ((await admin.get('/api/v1/ledger/accounts')).body as any[]).find((a) => /cash/i.test(a.accountName));
      expect((await admin.post('/api/v1/ledger/entries', { debitAccountId: util.body.id, creditAccountId: cash.id, amount: 300, description: 'Water', dateAd: nepalToday() })).status).toBe(201);
      expect((await admin.post('/api/v1/ledger/entries', { debitAccountId: cash.id, creditAccountId: cash.id, amount: 10, description: 'x', dateAd: nepalToday() })).status).toBe(400);
    });

    it('financial reports load and the trial balance balances', async () => {
      const q = { date: nepalToday(), from: '2026-07-17', to: nepalToday(), startDate: '2026-07-17', endDate: nepalToday() };
      for (const r of ['trial-balance', 'balance-sheet', 'cash-flow', 'day-book']) expect([r, (await admin.get(`/api/v1/reports/${r}`, q)).status]).toEqual([r, 200]);
      const tb = JSON.stringify((await admin.get('/api/v1/reports/trial-balance', q)).body);
      const dr = Number((tb.match(/"totalDebit":\s*"?([\d.]+)/) || [])[1]);
      const cr = Number((tb.match(/"totalCredit":\s*"?([\d.]+)/) || [])[1]);
      expect(dr).toBeGreaterThan(0);
      expect(dr).toBeCloseTo(cr, 2);
    });

    it('school analytics load', async () => {
      for (const a of ['attendance', 'fees', 'academics', 'operations']) expect([a, (await admin.get(`${S}/analytics/${a}`)).status]).toEqual([a, 200]);
    });
  });

  describe('fiscal year', () => {
    it('Premium school can read fiscal year status', async () => {
      expect((await admin.get('/api/v1/fiscal-year/status')).status).toBe(200);
    });
  });

  describe('accountant cannot manage users', () => {
    it('is refused', async () => {
      const ac = (await loginAs(ctx, school.companyId, 'ACCOUNTANT')).api;
      expect((await ac.get('/api/v1/users')).status).toBe(403);
    });
  });
});
