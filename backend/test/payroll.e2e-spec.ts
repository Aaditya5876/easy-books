import { createTestApp, resetDb, createCompany, loginAs, Api, TestContext, PREMIUM } from './helpers/app';

const MONTH = '2083-07';

describe('Payroll', () => {
  let ctx: TestContext;
  let admin: Api;
  let companyId: string;
  let driverId: string;
  let teacherId: string;

  const payrolls = async () => (await admin.get('/api/v1/payroll/summary', { month: MONTH })).body.payrolls as any[];
  const payrollOf = async (employeeId: string) => (await payrolls()).find((p) => p.employeeId === employeeId);
  const balance = async (name: RegExp) => {
    const accounts = (await admin.get('/api/v1/ledger/accounts')).body as any[];
    return accounts.filter((a) => name.test(a.accountName)).reduce((s, a) => s + Number(a.currentBalance), 0);
  };
  const entryCount = async () => ((await admin.get('/api/v1/ledger/entries')).body as any[]).length;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    companyId = (await createCompany(ctx.prisma, { modules: PREMIUM })).id;
    admin = (await loginAs(ctx, companyId, 'ADMIN')).api;
    driverId = (await admin.post('/api/v1/employees', { name: 'Hari Driver', employeeId: 'D-1', basicSalary: 18000 })).body.id;
    teacherId = (await admin.post('/api/v1/employees', { name: 'Ram Teacher', employeeId: 'T-1', basicSalary: 40000, allowances: { transport: 2000 } })).body.id;
    // 2 absences + 1 half day inside BS 2083-07
    for (const [date, status] of [['2026-10-26', 'ABSENT'], ['2026-10-27', 'ABSENT'], ['2026-10-28', 'HALF_DAY']]) {
      await admin.post('/api/v1/attendance', { employeeId: driverId, date, status });
    }
  });
  afterAll(async () => { await ctx.app.close(); });

  describe('calculation', () => {
    it('deducts absent and half days, SSF 11% and tax, and nets correctly', async () => {
      const res = await admin.post('/api/v1/payroll/calculate', { employeeId: driverId, month: MONTH });
      expect(res.status).toBe(201);
      const p = res.body;
      expect(p.absentDays).toBe(2);
      expect(p.halfDays).toBe(1);
      expect(p.absentDeduction).toBeCloseTo((2.5 * 18000) / 26, 1);
      expect(p.ssfEmployee).toBeCloseTo(1980, 2);
      expect(p.netSalary).toBeCloseTo(p.grossSalary - p.absentDeduction - p.ssfEmployee - p.pit + p.overtimeAmount + p.dashainBonus, 2);
    });

    it('Generate Payroll creates one payslip per active employee, including allowances', async () => {
      expect((await admin.post('/api/v1/payroll/process', { month: MONTH })).status).toBe(201);
      const rows = await payrolls();
      expect(rows).toHaveLength(2);
      expect(Number(rows.find((r) => r.employeeId === teacherId).grossSalary)).toBe(42000);
    });

    it('re-running Generate Payroll never duplicates payslips', async () => {
      await admin.post('/api/v1/payroll/process', { month: MONTH });
      const rows = await payrolls();
      expect(new Set(rows.map((r) => r.employeeId)).size).toBe(rows.length);
    });

    it('posts the accrual so the ledger stays balanced', async () => {
      const entries = (await admin.get('/api/v1/ledger/entries')).body as any[];
      const dr = entries.reduce((s, e) => s + Number(e.debit), 0);
      const cr = entries.reduce((s, e) => s + Number(e.credit), 0);
      expect(entries.length).toBeGreaterThan(0);
      expect(dr).toBeCloseTo(cr, 2);
    });
  });

  describe('validation', () => {
    it('rejects a badly formatted month on Calculate and Generate', async () => {
      expect((await admin.post('/api/v1/payroll/calculate', { employeeId: driverId, month: 'Kartik' })).status).toBe(400);
      expect((await admin.post('/api/v1/payroll/process', { month: '2083/07' })).status).toBe(400);
    });

    it('rejects 0 working days per month (would divide salary by zero)', async () => {
      const res = await admin.patch(`/api/v1/companies/${companyId}/payroll-settings`, { workingDaysPerMonth: 0 });
      expect(res.status).toBe(400);
    });

    it('returns 404, not a server error, for an unknown payslip', async () => {
      const unknown = '00000000-0000-0000-0000-000000000000';
      expect((await admin.patch(`/api/v1/payroll/${unknown}/adjust`, { otherDeductions: 1 })).status).toBe(404);
      expect((await admin.patch(`/api/v1/payroll/${unknown}/hold`, { isOnHold: true })).status).toBe(404);
      expect((await admin.patch(`/api/v1/payroll/${unknown}/mark-paid`)).status).toBe(404);
    });

    it('rejects negative other deductions', async () => {
      const p = await payrollOf(teacherId);
      expect((await admin.patch(`/api/v1/payroll/${p.id}/adjust`, { otherDeductions: -100 })).status).toBe(400);
    });
  });

  describe('hold', () => {
    it('a held salary cannot be paid', async () => {
      const p = await payrollOf(teacherId);
      await admin.patch(`/api/v1/payroll/${p.id}/hold`, { isOnHold: true, holdReason: 'Docs pending' });
      expect((await admin.patch(`/api/v1/payroll/${p.id}/mark-paid`)).status).toBe(400);
    });

    it('a hold survives re-running Generate Payroll (the nightly automation does this daily)', async () => {
      await admin.post('/api/v1/payroll/process', { month: MONTH });
      const p = await payrollOf(teacherId);
      expect(p.isOnHold).toBe(true);
      expect(p.status).toBe('ON_HOLD');
    });

    it('releasing the hold makes it payable again', async () => {
      const p = await payrollOf(teacherId);
      await admin.patch(`/api/v1/payroll/${p.id}/hold`, { isOnHold: false });
      const after = await payrollOf(teacherId);
      expect(after.status).toBe('PROCESSED');
      expect(after.isOnHold).toBe(false);
    });
  });

  describe('adjust (other deductions)', () => {
    it('reduces net pay and moves Salary Payable by the same amount', async () => {
      const p = await payrollOf(driverId);
      const payableBefore = await balance(/^Salary Payable$/);
      const res = await admin.patch(`/api/v1/payroll/${p.id}/adjust`, { otherDeductions: 500 });
      expect(res.status).toBe(200);
      expect(Number(res.body.netSalary)).toBeCloseTo(Number(p.netSalary) - 500, 2);
      expect(await balance(/^Salary Payable$/)).toBeCloseTo(payableBefore - 500, 2);
    });

    it('re-running Generate Payroll keeps the adjustment', async () => {
      const before = await payrollOf(driverId);
      await admin.post('/api/v1/payroll/process', { month: MONTH });
      const after = await payrollOf(driverId);
      expect(Number(after.otherDeductions)).toBe(500);
      expect(Number(after.netSalary)).toBeCloseTo(Number(before.netSalary), 2);
    });
  });

  describe('mark paid', () => {
    it('settles Salary Payable to zero for that payslip', async () => {
      const p = await payrollOf(driverId);
      const payableBefore = await balance(/^Salary Payable$/);
      expect((await admin.patch(`/api/v1/payroll/${p.id}/mark-paid`)).status).toBe(200);
      expect(await balance(/^Salary Payable$/)).toBeCloseTo(payableBefore - Number(p.netSalary), 2);
    });

    it('cannot be paid twice (no second ledger posting)', async () => {
      const p = await payrollOf(driverId);
      const before = await entryCount();
      expect((await admin.patch(`/api/v1/payroll/${p.id}/mark-paid`)).status).toBe(400);
      expect(await entryCount()).toBe(before);
    });

    it('a paid payslip cannot be held or adjusted', async () => {
      const p = await payrollOf(driverId);
      expect((await admin.patch(`/api/v1/payroll/${p.id}/hold`, { isOnHold: true, holdReason: 'x' })).status).toBe(400);
      expect((await admin.patch(`/api/v1/payroll/${p.id}/adjust`, { otherDeductions: 100 })).status).toBe(400);
    });

    it('re-running Generate Payroll leaves a paid payslip untouched', async () => {
      const before = await payrollOf(driverId);
      await admin.post('/api/v1/payroll/process', { month: MONTH });
      const after = await payrollOf(driverId);
      expect(after.status).toBe('PAID');
      expect(after.netSalary).toBe(before.netSalary);
      expect(after.otherDeductions).toBe(before.otherDeductions);
    });

    it('the whole ledger is still balanced after all of the above', async () => {
      const entries = (await admin.get('/api/v1/ledger/entries')).body as any[];
      const dr = entries.reduce((s, e) => s + Number(e.debit), 0);
      const cr = entries.reduce((s, e) => s + Number(e.credit), 0);
      expect(dr).toBeCloseTo(cr, 2);
    });
  });

  describe('roles', () => {
    it('accountant can view and adjust but not generate or pay; teacher sees nothing', async () => {
      const accountant = (await loginAs(ctx, companyId, 'ACCOUNTANT')).api;
      const teacher = (await loginAs(ctx, companyId, 'TEACHER')).api;
      const p = await payrollOf(teacherId);
      expect((await accountant.get('/api/v1/payroll/summary', { month: MONTH })).status).toBe(200);
      expect((await accountant.post('/api/v1/payroll/process', { month: MONTH })).status).toBe(403);
      expect((await accountant.patch(`/api/v1/payroll/${p.id}/mark-paid`)).status).toBe(403);
      expect((await teacher.get('/api/v1/payroll/summary', { month: MONTH })).status).toBe(403);
    });
  });
});
