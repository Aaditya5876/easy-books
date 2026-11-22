import { createTestApp, resetDb, createCompany, loginAs, Api, TestContext, nepalToday } from './helpers/app';

// Business STAFF permissions:
//  - Leave: a plain STAFF login manages only their OWN leave (the /self
//    screens); other people's requests and balances need ADMIN, ACCOUNTANT or
//    an HR-tagged STAFF. Before, any STAFF could read everyone's requests
//    (with reasons), file leave for others and cancel anyone's request.
//  - SALES ("Sales / Counter") tag: a cashier can make sales bills, receive
//    payments and Close & Bill a table — without edit/delete or the ledger.
describe('Staff permissions — leave privacy and the Sales/Counter tag', () => {
  let ctx: TestContext;
  let companyId: string;
  let admin: Api;
  let staff: Api;
  let staffEmail: string;
  let hr: Api;
  let cashier: Api;
  let leaveTypeId: string;
  let otherEmployeeId: string;
  const today = nepalToday();

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    companyId = (await createCompany(ctx.prisma, { name: 'Counter Cafe', businessType: 'FOOD_BEVERAGE', modules: [] })).id;
    admin = (await loginAs(ctx, companyId, 'ADMIN')).api;
    const plain = await loginAs(ctx, companyId, 'STAFF');
    staff = plain.api;
    staffEmail = plain.user.email;
    hr = (await loginAs(ctx, companyId, 'STAFF', ['HR'])).api;
    cashier = (await loginAs(ctx, companyId, 'STAFF', ['SALES'])).api;

    leaveTypeId = (await admin.post('/api/v1/leave/types', { name: 'Sick', daysPerYear: 12 })).body.id;
    otherEmployeeId = (await admin.post('/api/v1/employees', { name: 'Someone Else' })).body.id;
  });
  afterAll(async () => { await ctx.app.close(); });

  describe('leave', () => {
    let otherRequestId: string;
    beforeAll(async () => {
      const r = await admin.post('/api/v1/leave/requests', { employeeId: otherEmployeeId, leaveTypeId, startDate: today, endDate: today, reason: 'Hospital visit' });
      expect(r.status).toBe(201);
      otherRequestId = r.body.id;
    });

    it("a plain STAFF login can't see, file or cancel other people's leave", async () => {
      expect((await staff.get('/api/v1/leave/requests')).status).toBe(403);
      expect((await staff.get(`/api/v1/leave/requests/${otherRequestId}`)).status).toBe(403);
      expect((await staff.post('/api/v1/leave/requests', { employeeId: otherEmployeeId, leaveTypeId, startDate: today, endDate: today })).status).toBe(403);
      expect((await staff.patch(`/api/v1/leave/requests/${otherRequestId}/cancel`)).status).toBe(403);
      expect((await staff.get(`/api/v1/leave/balances/${otherEmployeeId}`)).status).toBe(403);
    });

    it('…but still uses their own leave screens, including their own balance', async () => {
      expect((await staff.get('/api/v1/leave/self/context')).status).toBe(200);
      const mine = await ctx.prisma.employee.findFirst({ where: { companyId, email: staffEmail } });
      expect(mine).not.toBeNull();
      expect((await staff.get(`/api/v1/leave/balances/${mine!.id}`)).status).toBe(200);
      expect((await staff.post('/api/v1/leave/self/requests', { leaveTypeId, startDate: today, endDate: today, reason: 'Fever' })).status).toBe(201);
    });

    it('HR-tagged staff, accountants and admins manage everyone’s leave', async () => {
      expect((await hr.get('/api/v1/leave/requests')).status).toBe(200);
      expect((await hr.get(`/api/v1/leave/balances/${otherEmployeeId}`)).status).toBe(200);
      expect((await hr.patch(`/api/v1/leave/requests/${otherRequestId}/cancel`)).status).toBe(200);
      const accountant = (await loginAs(ctx, companyId, 'ACCOUNTANT')).api;
      expect((await accountant.get('/api/v1/leave/requests')).status).toBe(200);
    });
  });

  describe('Sales / Counter tag', () => {
    const saleBody = { clientName: 'Walk-in', dateAd: today, items: [{ description: 'Coffee', quantity: 2, unitPrice: 150 }] };

    it('plain staff still cannot make sales', async () => {
      expect((await staff.post('/api/v1/sales', saleBody)).status).toBe(403);
    });

    it('a cashier makes a sale paid in cash, and one on udharo then receives the payment', async () => {
      const paid = await cashier.post('/api/v1/sales', { ...saleBody, payment: { type: 'FULL', paymentMethod: 'CASH' } });
      expect(paid.status).toBe(201);
      expect(paid.body.status).toBe('COMPLETED');

      const credit = await cashier.post('/api/v1/sales', { ...saleBody, clientName: 'Regular Ram' });
      expect(credit.status).toBe(201);
      const pay = await cashier.post(`/api/v1/sales/${credit.body.id}/payment`, { amount: 300, paymentMethod: 'CASH', dateAd: today });
      expect(pay.status).toBe(201);
    });

    it('a cashier can Close & Bill a table', async () => {
      const table = (await admin.post('/api/v1/spaces', { name: 'T1', type: 'Table' })).body;
      const sess = (await cashier.post(`/api/v1/spaces/${table.id}/sessions`, { mode: 'OCCUPY', guestName: 'Table guest' })).body;
      await cashier.post(`/api/v1/space-sessions/${sess.id}/charges`, { description: 'Momo', quantity: 1, unitPrice: 200 });
      expect((await staff.post(`/api/v1/space-sessions/${sess.id}/close`, { paymentMethod: 'CASH' })).status).toBe(403);
      const closed = await cashier.post(`/api/v1/space-sessions/${sess.id}/close`, { paymentMethod: 'CASH' });
      expect(closed.status).toBe(201);
      expect(closed.body.paid).toBe(true);
    });

    it('a cashier cannot edit or delete bills, buy, or open the books', async () => {
      const sale = (await cashier.post('/api/v1/sales', saleBody)).body;
      expect((await cashier.put(`/api/v1/sales/${sale.id}`, { notes: 'x' })).status).toBe(403);
      expect((await cashier.del(`/api/v1/sales/${sale.id}`)).status).toBe(403);
      expect((await cashier.post('/api/v1/purchases', { vendorName: 'V', dateAd: today, items: [{ description: 'Milk', quantity: 1, unitPrice: 100 }] })).status).toBe(403);
      expect((await cashier.get('/api/v1/ledger/entries')).status).toBe(403);
      expect((await cashier.get('/api/v1/transactions')).status).toBe(403);
      // Jobs are created by admin/accountant — not through a cashier's sale.
      expect((await cashier.post('/api/v1/sales', { ...saleBody, createJob: true })).status).toBe(403);
    });

    it('the tag can be given to a staff member from Settings → Users', async () => {
      const invite = await admin.post('/api/v1/users/invite', { email: 'counter@cafe.test', name: 'Counter', role: 'STAFF', staffTags: ['SALES'] });
      expect(invite.status).toBe(201);
      const user = await ctx.prisma.user.findUnique({ where: { email: 'counter@cafe.test' } });
      expect(user!.staffTags).toEqual(['SALES']);
    });
  });
});
