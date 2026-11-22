import { createTestApp, resetDb, createCompany, createUser, login, Api, TestContext } from './helpers/app';
import { adToBs } from '@easy-books/shared';

// Payroll the way a small business really meets it: GeoInfosys creates the
// company (its admin login gets an employee record automatically, salary 0),
// payroll settings were never configured, and the owner adds two salaried
// employees who don't use the app.
describe('Payroll — a business that never configured payroll settings', () => {
  let ctx: TestContext;
  let admin: Api;
  let adminEmployeeId: string;
  let cashierId: string;
  let bakerId: string;
  const month = adToBs(new Date()).slice(0, 7); // current BS month, e.g. 2083-08

  const summary = async () => (await admin.get('/api/v1/payroll/summary', { month })).body;
  const balanceOf = async (name: string) => {
    const accounts = (await admin.get('/api/v1/ledger/accounts')).body as any[];
    return Number(accounts.find((a) => a.accountName === name)?.currentBalance ?? 0);
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    const home = (await createCompany(ctx.prisma, { name: 'GeoInfosys', businessType: 'SERVICES', modules: [] })).id;
    const sa = await login(ctx.app, (await createUser(ctx.prisma, home, 'SUPER_ADMIN')).email);
    const res = await sa.post('/api/v1/users/provision-client', { companyName: 'Payroll Cafe', businessType: 'FOOD_BEVERAGE', adminName: 'Owner', adminEmail: 'owner@payroll.test' });
    expect(res.status).toBe(201);
    const companyId = res.body.company.id;
    admin = await login(ctx.app, 'owner@payroll.test', companyId, res.body.tempPassword);
    adminEmployeeId = (await ctx.prisma.employee.findFirst({ where: { companyId, email: 'owner@payroll.test' } }))!.id;
    cashierId = (await admin.post('/api/v1/employees', { name: 'Sita Cashier', basicSalary: 18000 })).body.id;
    bakerId = (await admin.post('/api/v1/employees', { name: 'Ram Baker', basicSalary: 25000 })).body.id;
    // Someone who left: deleted from Employees — must never be paid again.
    const gone = (await admin.post('/api/v1/employees', { name: 'Left Last Month', basicSalary: 20000 })).body.id;
    expect((await admin.del(`/api/v1/employees/${gone}`)).status).toBe(200);
  });
  afterAll(async () => { await ctx.app.close(); });

  it('Generate Payroll works without payroll settings and makes payslips only for people with a salary', async () => {
    const res = await admin.post('/api/v1/payroll/process', { month });
    expect([res.status, JSON.stringify(res.body).slice(0, 200)]).toEqual([201, expect.any(String)]);
    const rows = (await summary()).payrolls as any[];
    expect(rows.map((r) => r.employeeId).sort()).toEqual([cashierId, bakerId].sort());
    expect(rows.some((r) => r.employeeId === adminEmployeeId)).toBe(false);
  });

  it('net pay = gross − SSF − tax, and Salary Payable holds what is owed', async () => {
    const rows = (await summary()).payrolls as any[];
    for (const r of rows) {
      const net = Number(r.grossSalary) - Number(r.absentDeduction) - Number(r.hoursShortfallDeduction ?? 0) - Number(r.ssfEmployee) - Number(r.pit) - Number(r.otherDeductions ?? 0) + Number(r.overtimeAmount) + (r.isDashainBonus ? Number(r.basicSalary) : 0);
      expect(Number(r.netSalary)).toBeCloseTo(net, 2);
    }
    const owed = rows.reduce((s, r) => s + Number(r.netSalary), 0);
    expect(await balanceOf('Salary Payable')).toBeCloseTo(owed, 2);
  });

  it('paying one payslip moves its net out of cash; the ledger balances', async () => {
    const rows = (await summary()).payrolls as any[];
    const cashier = rows.find((r) => r.employeeId === cashierId);
    const before = await balanceOf('Cash in Hand');
    expect((await admin.patch(`/api/v1/payroll/${cashier.id}/mark-paid`)).status).toBe(200);
    expect(await balanceOf('Cash in Hand')).toBeCloseTo(before - Number(cashier.netSalary), 2);
    const entries = (await admin.get('/api/v1/ledger/entries')).body as any[];
    const dr = entries.reduce((s, e) => s + Number(e.debit), 0);
    const cr = entries.reduce((s, e) => s + Number(e.credit), 0);
    expect(dr).toBeCloseTo(cr, 2);
  });
});
