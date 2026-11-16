import { createTestApp, resetDb, createCompany, loginAs, Api, TestContext, nepalToday } from './helpers/app';

// An edit that changes one field must leave every other field alone. zod 4
// re-applies .default()s inside .partial(), so update schemas derived from
// create schemas used to reset untouched fields (stock to 0, a pending cheque
// to COMPLETED, SSF back on…).
describe('Editing one field keeps the rest', () => {
  let ctx: TestContext;
  let admin: Api;
  let companyId: string;
  const today = nepalToday();

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    companyId = (await createCompany(ctx.prisma, { name: 'Edit Co', businessType: 'RETAIL', modules: [] })).id;
    admin = (await loginAs(ctx, companyId, 'ADMIN')).api;
  });
  afterAll(async () => { await ctx.app.close(); });

  it('inventory item: renaming keeps stock and prices', async () => {
    const item = (await admin.post('/api/v1/inventory', { itemName: 'Chain', quantity: 12, unit: 'SET', unitPurchasePrice: 300, unitSellingPrice: 450, lowStockThreshold: 2 })).body;
    expect((await admin.put(`/api/v1/inventory/${item.id}`, { itemName: 'Chain 428' })).status).toBe(200);
    const saved = await ctx.prisma.inventoryItem.findUnique({ where: { id: item.id } });
    expect([saved!.itemName, Number(saved!.quantity), saved!.unit, Number(saved!.unitPurchasePrice), Number(saved!.unitSellingPrice), Number(saved!.lowStockThreshold)])
      .toEqual(['Chain 428', 12, 'SET', 300, 450, 2]);
  });

  it('bank account: renaming keeps the balance and type', async () => {
    const bank = (await admin.post('/api/v1/bank-accounts', { bankName: 'NIC Asia', accountNumber: '001', currentBalance: 50000, paymentType: 'ESEWA' })).body;
    expect((await admin.put(`/api/v1/bank-accounts/${bank.id}`, { branch: 'Baglung' })).status).toBe(200);
    const saved = await ctx.prisma.bankAccount.findUnique({ where: { id: bank.id } });
    expect([Number(saved!.currentBalance), saved!.paymentType, saved!.branch]).toEqual([50000, 'ESEWA', 'Baglung']);
  });

  it('transaction: editing a pending cheque note keeps it pending and posts no money', async () => {
    const txn = (await admin.post('/api/v1/transactions', { dateAd: today, type: 'CHEQUE', category: 'INCOME', amount: 700, status: 'PENDING', partyName: 'Sita', description: 'Advance' })).body;
    const realBefore = await ctx.prisma.ledgerEntry.count({ where: { companyId, referenceType: 'TRANSACTION', referenceId: txn.id } });
    expect((await admin.put(`/api/v1/transactions/${txn.id}`, { description: 'Advance for job' })).status).toBe(200);
    expect((await ctx.prisma.transaction.findUnique({ where: { id: txn.id } }))!.status).toBe('PENDING');
    expect(await ctx.prisma.ledgerEntry.count({ where: { companyId, referenceType: 'TRANSACTION', referenceId: txn.id } })).toBe(realBefore);
  });

  it('attendance: adding a note keeps overtime', async () => {
    const emp = (await admin.post('/api/v1/employees', { name: 'Ram', employeeId: 'E-ATT' })).body;
    const att = await admin.post('/api/v1/attendance', { employeeId: emp.id, date: today, status: 'PRESENT', overtimeHours: 2 });
    expect(att.status).toBe(201);
    expect((await admin.put(`/api/v1/attendance/${att.body.id}`, { notes: 'Stayed late' })).status).toBe(200);
    expect(Number((await ctx.prisma.attendance.findUnique({ where: { id: att.body.id } }))!.overtimeHours)).toBe(2);
  });

  it('payroll settings: changing working days keeps SSF / tax switched off', async () => {
    const url = `/api/v1/companies/${companyId}/payroll-settings`;
    expect((await admin.patch(url, { ssfApplicable: false, pitApplicable: false, ssfEmployeeRate: 0 })).status).toBeLessThan(300);
    expect((await admin.patch(url, { workingDaysPerMonth: 25 })).status).toBeLessThan(300);
    const s = await ctx.prisma.companyPayrollSettings.findUnique({ where: { companyId } });
    expect([s!.ssfApplicable, s!.pitApplicable, Number(s!.ssfEmployeeRate), s!.workingDaysPerMonth]).toEqual([false, false, 0, 25]);
  });

  it('vendor and memo edits keep their other fields', async () => {
    const v = (await admin.post('/api/v1/vendors', { name: 'Parts', phone: '98', email: 'p@x.com' })).body;
    expect((await admin.put(`/api/v1/vendors/${v.id}`, { address: 'Pokhara' })).status).toBe(200);
    expect((await ctx.prisma.vendor.findUnique({ where: { id: v.id } }))).toMatchObject({ phone: '98', email: 'p@x.com', address: 'Pokhara' });
    const m = (await admin.post('/api/v1/memos', { category: 'job_card', title: 'Card', dateAd: today, amount: 900, status: 'Quoted' })).body;
    expect((await admin.put(`/api/v1/memos/${m.id}`, { content: 'more' })).status).toBe(200);
    expect((await ctx.prisma.memoDocument.findUnique({ where: { id: m.id } }))).toMatchObject({ category: 'job_card', status: 'Quoted' });
  });

  it('no update rule anywhere fills in a default', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const shared = require('@easy-books/shared');
    const leaks = Object.keys(shared)
      .filter((k) => /^Update\w+Schema$/.test(k))
      .map((k) => [k, shared[k].safeParse({})] as const)
      .filter(([, r]) => r.success && Object.keys(r.data).length > 0)
      .map(([k, r]) => `${k}: ${JSON.stringify(r.data)}`);
    expect(leaks).toEqual([]);
  });
});
