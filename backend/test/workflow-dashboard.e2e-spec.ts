import { createTestApp, resetDb, createCompany, loginAs, Api, TestContext, nepalToday } from './helpers/app';
import { ScheduledTasksService } from '../src/application/services/scheduled-tasks.service';

// Workflow (job cards / order slips), the business dashboard overview shared
// by every company type, fixed/variable expense tagging and the recycle bin.
describe('Workflow, dashboard overview, recycle bin', () => {
  let ctx: TestContext;
  let admin: Api;
  let companyId: string;
  const today = nepalToday();

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    companyId = (await createCompany(ctx.prisma, { name: 'Workflow Traders', businessType: 'RETAIL', modules: [] })).id;
    admin = (await loginAs(ctx, companyId, 'ADMIN')).api;
  });
  afterAll(async () => { await ctx.app.close(); });

  describe('workflow tasks', () => {
    it('saves job-card details and numbers tasks per company', async () => {
      const first = await admin.post('/api/v1/tasks', {
        title: 'Service bike', workflowType: 'JOB_CARD', category: 'Operations', priority: 'HIGH', status: 'PENDING',
        dueDate: '2026-12-01', dueTime: '14:30', department: 'Workshop',
        assignedTo: 'ram@test.local', assignedName: 'Ram', assignedContact: '9800000000',
        partyType: 'CLIENT', partyName: 'Hari Stores', partyContact: '9811111111',
      });
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({
        taskNumber: 1, workflowType: 'JOB_CARD', category: 'Operations', dueTime: '14:30', department: 'Workshop',
        assignedName: 'Ram', assignedContact: '9800000000', partyType: 'CLIENT', partyName: 'Hari Stores',
      });
      const second = await admin.post('/api/v1/tasks', { title: 'Deliver order', workflowType: 'ORDER_SLIP' });
      expect(second.body.taskNumber).toBe(2);

      const other = (await createCompany(ctx.prisma, { name: 'Other Co', businessType: 'RETAIL', modules: [] })).id;
      const otherAdmin = (await loginAs(ctx, other, 'ADMIN')).api;
      expect((await otherAdmin.post('/api/v1/tasks', { title: 'Theirs' })).body.taskNumber).toBe(1);
    });

    it('rejects an unknown workflow type; accepts urgent priority', async () => {
      expect((await admin.post('/api/v1/tasks', { title: 'X', workflowType: 'NOPE' })).status).toBe(400);
      expect((await admin.post('/api/v1/tasks', { title: 'Rush', priority: 'URGENT' })).body.priority).toBe('URGENT');
    });

    it('edits keep the task number and accept a date-only due date', async () => {
      const t = (await admin.post('/api/v1/tasks', { title: 'Fix printer' })).body;
      const res = await admin.put(`/api/v1/tasks/${t.id}`, { dueDate: '2026-12-15', status: 'IN_PROGRESS', taskNumber: 999 });
      expect(res.status).toBe(200);
      const saved = (await admin.get(`/api/v1/tasks/${t.id}`)).body;
      expect(saved.taskNumber).toBe(t.taskNumber);
      expect(saved.status).toBe('IN_PROGRESS');
      expect(saved.dueDate.slice(0, 10)).toBe('2026-12-15');
    });

    it('works for a school company too', async () => {
      const school = (await createCompany(ctx.prisma, { name: 'Workflow School' })).id;
      const schoolAdmin = (await loginAs(ctx, school, 'ADMIN')).api;
      const res = await schoolAdmin.post('/api/v1/tasks', { title: 'Repair bench', workflowType: 'JOB_CARD' });
      expect(res.status).toBe(201);
      expect(res.body.taskNumber).toBe(1);
    });
  });

  describe('connected records (job → quotation → purchase → bill → payment)', () => {
    let task: any;
    let clientId: string;
    let employeeId: string;
    let otherCompanyId: string;
    let otherTaskId: string;

    beforeAll(async () => {
      clientId = (await admin.post('/api/v1/clients', { name: 'Linked Client', phone: '9800000001' })).body.id;
      employeeId = (await admin.post('/api/v1/employees', { name: 'Ram Mechanic', employeeId: 'EMP-LINK-1', basicSalary: 0 })).body.id;
      otherCompanyId = (await createCompany(ctx.prisma, { name: 'Stranger Co', businessType: 'RETAIL', modules: [] })).id;
      const stranger = (await loginAs(ctx, otherCompanyId, 'ADMIN')).api;
      otherTaskId = (await stranger.post('/api/v1/tasks', { title: 'Not yours' })).body.id;
    });

    it('a task can point at an existing client and employee of the same company only', async () => {
      const res = await admin.post('/api/v1/tasks', {
        title: 'Service bike', workflowType: 'JOB_CARD', partyType: 'CLIENT', partyId: clientId, partyName: 'Linked Client',
        assignedEmployeeId: employeeId, assignedName: 'Ram Mechanic',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ partyId: clientId, assignedEmployeeId: employeeId });
      task = res.body;

      const strangerClient = (await ctx.prisma.client.create({ data: { companyId: otherCompanyId, name: 'Theirs' } })).id;
      expect((await admin.post('/api/v1/tasks', { title: 'X', partyType: 'CLIENT', partyId: strangerClient })).status).toBe(400);
      const strangerEmp = (await ctx.prisma.employee.create({ data: { companyId: otherCompanyId, name: 'Theirs', employeeId: 'S-1' } })).id;
      expect((await admin.post('/api/v1/tasks', { title: 'X', assignedEmployeeId: strangerEmp })).status).toBe(400);
      expect((await admin.put(`/api/v1/tasks/${task.id}`, { assignedEmployeeId: strangerEmp })).status).toBe(400);
    });

    it('records created from the job remember it; a quotation converted to a bill keeps the link', async () => {
      const quote = await admin.post('/api/v1/quotations', {
        clientId, clientName: 'Linked Client', dateAd: today, quotationNumber: 'Q-LINK-1', totalAmount: 500, taskId: task.id,
        items: [{ description: 'Labour', quantity: 1, unitPrice: 500 }],
      });
      expect(quote.status).toBe(201);
      expect(quote.body.taskId).toBe(task.id);
      const converted = await admin.post(`/api/v1/quotations/${quote.body.id}/convert`);
      expect(converted.status).toBe(201);
      const convertedSale = await ctx.prisma.salesOrder.findFirst({ where: { companyId, notes: { contains: 'Q-LINK-1' } } });
      expect(convertedSale!.taskId).toBe(task.id);

      const purchase = await admin.post('/api/v1/purchases', {
        vendorName: 'Parts Shop', dateAd: today, paymentMethod: 'CREDIT', taskId: task.id,
        items: [{ description: 'Brake pad', quantity: 1, unitPrice: 400 }],
      });
      expect(purchase.status).toBe(201);
      const sale = await admin.post('/api/v1/sales', {
        clientId, clientName: 'Linked Client', dateAd: today, paymentMethod: 'CREDIT', taskId: task.id,
        items: [{ description: 'Brake pad fitted', quantity: 1, unitPrice: 1000 }],
      });
      expect(sale.status).toBe(201);
      expect((await admin.post(`/api/v1/sales/${sale.body.id}/payment`, { amount: 300, paymentMethod: 'CASH', dateAd: today })).status).toBe(201);

      expect((await admin.post('/api/v1/vendors', { name: 'Parts Shop', taskId: task.id })).status).toBe(201);
      expect((await admin.post('/api/v1/employees', { name: 'Helper', employeeId: 'EMP-LINK-2', taskId: task.id })).status).toBe(201);
      expect((await admin.post('/api/v1/memos', { category: 'job_card', dateAd: today, referenceId: task.id, title: 'Scan' })).status).toBe(201);
    });

    it("refuses to link anything to another company's task", async () => {
      const before = await ctx.prisma.salesOrder.count({ where: { companyId } });
      const res = await admin.post('/api/v1/sales', {
        clientName: 'X', dateAd: today, taskId: otherTaskId, items: [{ description: 'x', quantity: 1, unitPrice: 1 }],
      });
      expect(res.status).toBe(400);
      expect(await ctx.prisma.salesOrder.count({ where: { companyId } })).toBe(before);
      for (const [url, body] of [
        ['/api/v1/purchases', { vendorName: 'X', dateAd: today, items: [{ description: 'x', quantity: 1, unitPrice: 1 }] }],
        ['/api/v1/quotations', { clientName: 'X', dateAd: today, quotationNumber: 'Q-BAD', totalAmount: 1, items: [{ description: 'x', quantity: 1, unitPrice: 1 }] }],
        ['/api/v1/clients', { name: 'X' }],
        ['/api/v1/vendors', { name: 'X' }],
        ['/api/v1/employees', { name: 'X', employeeId: 'EMP-BAD' }],
      ] as const) {
        expect([url, (await admin.post(url, { ...body, taskId: otherTaskId })).status]).toEqual([url, 400]);
      }
    });

    it('the job shows everything connected to it, with money totals and a timeline', async () => {
      const res = await admin.get(`/api/v1/tasks/${task.id}/links`);
      expect(res.status).toBe(200);
      const l = res.body;
      expect(l.quotations).toHaveLength(1);
      expect(l.sales).toHaveLength(2);
      expect(l.purchases).toHaveLength(1);
      expect(l.vendors).toHaveLength(1);
      expect(l.employees).toHaveLength(1);
      expect(l.documents).toHaveLength(1);
      expect(l.client).toMatchObject({ id: clientId, name: 'Linked Client' });
      expect(l.assignedEmployee).toMatchObject({ id: employeeId, name: 'Ram Mechanic' });
      expect(l.summary).toEqual({ quoted: 500, billed: 1500, received: 300, outstanding: 1200, purchaseCost: 400, margin: 1100 });
      expect(l.timeline[0].kind).toBe('TASK_CREATED');
      expect(l.timeline.map((e: any) => e.kind)).toEqual(expect.arrayContaining(['QUOTATION', 'SALE', 'PURCHASE', 'DOCUMENT', 'PAYMENT']));

      const list = (await admin.get('/api/v1/tasks')).body;
      expect(list.find((x: any) => x.id === task.id).linkCounts).toEqual({ quotations: 1, sales: 2, purchases: 1, documents: 1 });
      expect((await admin.get(`/api/v1/tasks/${otherTaskId}/links`)).status).toBe(404);
    });
  });

  describe('quotation totals', () => {
    it('applies VAT and labour charges the form sends', async () => {
      const q = await admin.post('/api/v1/quotations', {
        clientName: 'Vat Co', dateAd: today, quotationNumber: 'Q-VAT', totalAmount: 0, isVat: true, laborCharges: 100,
        items: [{ description: 'Part', quantity: 2, unitPrice: 450 }],
      });
      expect(q.status).toBe(201);
      expect(Number(q.body.vatAmount)).toBeCloseTo(130, 2);
      expect(Number(q.body.totalAmount)).toBeCloseTo(1130, 2);
    });
  });

  describe('editing keeps fields the edit did not mention', () => {
    it('quotation: a converted quotation stays converted (no second bill)', async () => {
      const q = (await admin.post('/api/v1/quotations', { clientName: 'Keep', dateAd: today, quotationNumber: 'Q-KEEP', totalAmount: 10, remark: 'WORK_DONE', items: [{ description: 'x', quantity: 1, unitPrice: 10 }] })).body;
      expect((await admin.post(`/api/v1/quotations/${q.id}/convert`)).status).toBe(201);
      expect((await admin.put(`/api/v1/quotations/${q.id}`, { description: 'note' })).status).toBe(200);
      expect((await admin.get(`/api/v1/quotations/${q.id}`)).body).toMatchObject({ status: 'CONVERTED', remark: 'BILLED' });
      expect((await admin.post(`/api/v1/quotations/${q.id}/convert`)).status).toBe(400);
    });

    it('employee: changing the phone keeps salary and status', async () => {
      const e = (await admin.post('/api/v1/employees', { name: 'Sita', employeeId: 'EMP-KEEP', basicSalary: 30000, status: 'ON_LEAVE' })).body;
      expect((await admin.put(`/api/v1/employees/${e.id}`, { phone: '9800000009' })).status).toBe(200);
      const saved = await ctx.prisma.employee.findUnique({ where: { id: e.id } });
      expect([Number(saved!.basicSalary), saved!.status]).toEqual([30000, 'ON_LEAVE']);
    });

    it('client: changing the phone keeps the CRM status', async () => {
      const c = (await admin.post('/api/v1/clients', { name: 'Prospect Co', crmStatus: 'PROSPECT' })).body;
      // Edit forms send the whole loaded record back, including taskId: null.
      expect((await admin.put(`/api/v1/clients/${c.id}`, { phone: '1', taskId: null })).status).toBe(200);
      expect((await ctx.prisma.client.findUnique({ where: { id: c.id } }))!.crmStatus).toBe('PROSPECT');
    });
  });

  describe('fixed and variable expense accounts', () => {
    it('pre-sets common fixed costs, lets the user change it, ignores non-expense accounts', async () => {
      const rent = await admin.post('/api/v1/ledger/accounts', { accountName: 'Office Rent', accountType: 'EXPENSE' });
      expect(rent.status).toBe(201);
      expect(rent.body.costBehavior).toBe('FIXED');
      const delivery = await admin.post('/api/v1/ledger/accounts', { accountName: 'Delivery Charges', accountType: 'EXPENSE' });
      expect(delivery.body.costBehavior).toBe('VARIABLE');
      const chosen = await admin.post('/api/v1/ledger/accounts', { accountName: 'Generator Fuel', accountType: 'EXPENSE', costBehavior: 'FIXED' });
      expect(chosen.body.costBehavior).toBe('FIXED');
      expect((await admin.put(`/api/v1/ledger/accounts/${delivery.body.id}`, { costBehavior: 'FIXED' })).status).toBe(200);
      expect((await admin.get(`/api/v1/ledger/accounts/${delivery.body.id}`)).body.costBehavior).toBe('FIXED');
      const income = await admin.post('/api/v1/ledger/accounts', { accountName: 'Rent Income', accountType: 'INCOME' });
      expect(income.body.costBehavior).toBeNull();
      expect((await admin.post('/api/v1/ledger/accounts', { accountName: 'Bad', accountType: 'EXPENSE', costBehavior: 'SOMETIMES' })).status).toBe(400);
    });

    it('renaming an account keeps its opening balance', async () => {
      const acct = (await admin.post('/api/v1/ledger/accounts', { accountName: 'Old Name', accountType: 'ASSET', openingBalance: 500 })).body;
      expect((await admin.put(`/api/v1/ledger/accounts/${acct.id}`, { accountName: 'New Name' })).status).toBe(200);
      expect(Number((await admin.get(`/api/v1/ledger/accounts/${acct.id}`)).body.openingBalance)).toBe(500);
    });
  });

  describe('dashboard overview', () => {
    let overview: any;

    beforeAll(async () => {
      const co = (await createCompany(ctx.prisma, { name: 'Dash Traders', businessType: 'RETAIL', modules: [] })).id;
      const a = (await loginAs(ctx, co, 'ADMIN')).api;
      const item = (await a.post('/api/v1/inventory', { itemName: 'Brake Pad', quantity: 10, unit: 'PCS', unitPurchasePrice: 400, unitSellingPrice: 1000, lowStockThreshold: 3 })).body;
      await a.post('/api/v1/inventory', { itemName: 'Chain', quantity: 0, unit: 'PCS', unitPurchasePrice: 100, unitSellingPrice: 200 });
      await a.post('/api/v1/sales', {
        clientName: 'Hari Stores', dateAd: today, isVat: false, paymentMethod: 'CREDIT',
        items: [{ inventoryItemId: item.id, description: 'Brake Pad', quantity: 1, unitPrice: 1000 }],
      });
      await a.post('/api/v1/purchases', {
        vendorName: 'Ktm Suppliers', dateAd: today, isVat: false, paymentMethod: 'CREDIT',
        items: [{ inventoryItemId: item.id, description: 'Brake Pad', quantity: 1, unitPrice: 400 }],
      });
      const rent = (await a.post('/api/v1/ledger/accounts', { accountName: 'Shop Rent', accountType: 'EXPENSE' })).body;
      const fuel = (await a.post('/api/v1/ledger/accounts', { accountName: 'Delivery Fuel', accountType: 'EXPENSE' })).body;
      expect((await a.post('/api/v1/transactions', { dateAd: today, type: 'CASH', category: 'EXPENSE', amount: 300, description: 'Rent', debitAccountId: rent.id })).status).toBe(201);
      expect((await a.post('/api/v1/transactions', { dateAd: today, type: 'CASH', category: 'EXPENSE', amount: 50, description: 'Fuel', debitAccountId: fuel.id })).status).toBe(201);
      expect((await a.post('/api/v1/transactions', { dateAd: '2030-01-15', type: 'CHEQUE', category: 'INCOME', amount: 700, partyName: 'Sita Traders', reference: 'CHQ-77', status: 'PENDING', description: 'Advance' })).status).toBe(201);
      await a.post('/api/v1/quotations', { clientName: 'Hari', dateAd: today, quotationNumber: 'Q-9', totalAmount: 500, remark: 'WORK_DONE', items: [{ description: 'x', quantity: 1, unitPrice: 500 }] });
      await a.post('/api/v1/tasks', { title: 'Open job', status: 'PENDING', assignedName: 'Ram', dueDate: '2020-01-01' });
      await a.post('/api/v1/tasks', { title: 'Busy job', status: 'IN_PROGRESS' });
      await a.post('/api/v1/tasks', { title: 'Finished job', status: 'COMPLETED' });
      await a.post('/api/v1/tasks', { title: 'Meet client', workflowType: 'APPOINTMENT', dueDate: '2030-01-01', dueTime: '10:00' });
      const res = await a.get('/api/v1/dashboard/overview');
      expect(res.status).toBe(200);
      overview = res.body;
    });

    it('fiscal-year totals and profit without double-counting purchases', () => {
      expect(overview.kpis).toMatchObject({ totalSales: 1000, totalPurchase: 400, totalExpenses: 350 });
      expect(overview.profitLoss.netProfit).toBe(1000 - 400 - 350);
      expect(overview.expenseSplit).toMatchObject({ fixed: 300, variable: 50 });
      expect(overview.cashInHand).toBe(-350);
      expect(overview.ledgerSummary).toMatchObject({ receivable: 1000, payable: 400, salesCount: 1, purchaseCount: 1, expenseCount: 2 });
      expect(overview.monthly.length).toBeGreaterThan(0);
    });

    it('inventory, quotations and tasks', () => {
      expect(overview.inventory).toMatchObject({ totalItems: 2, outOfStockCount: 1, lowStockCount: 0, stockValue: 10000, soldValueFY: 1000 });
      expect(overview.inventory.topSelling[0]).toMatchObject({ name: 'Brake Pad', quantity: 1, amount: 1000 });
      expect(overview.inventory.aging.length).toBe(4);
      expect(overview.quotations.byRemark.WORK_DONE).toEqual({ count: 1, amount: 500 });
      expect(overview.tasks).toMatchObject({ total: 4, completed: 1, inProgress: 1, incomplete: 2, overdue: 1 });
      expect(overview.tasks.active.find((t: any) => t.title === 'Open job')).toMatchObject({ assignedName: 'Ram', overdue: true });
      expect(overview.tasks.appointments[0]).toMatchObject({ title: 'Meet client', dueTime: '10:00' });
    });

    it('cheque reminders carry the cheque details', () => {
      expect(overview.cheques.payable).toEqual([]);
      expect(overview.cheques.receivable[0]).toMatchObject({ partyName: 'Sita Traders', chequeNumber: 'CHQ-77', amount: 700, isPostDated: true });
      expect(overview.cheques.receivable[0].issuedDate).toBeTruthy();
      expect(overview.cashFlow).toMatchObject({ outflow: 350 });
    });

    it('school companies get the same overview with fee collection; staff are refused', async () => {
      const school = (await createCompany(ctx.prisma, { name: 'Dash School' })).id;
      const a = (await loginAs(ctx, school, 'ADMIN')).api;
      const res = await a.get('/api/v1/dashboard/overview');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ isSchool: true, kpis: { feeCollection: 0 } });
      const staff = (await loginAs(ctx, school, 'STAFF')).api;
      expect((await staff.get('/api/v1/dashboard/overview')).status).toBe(403);
    });
  });

  describe('recycle bin', () => {
    const del = async (title: string) => {
      const id = (await admin.post('/api/v1/tasks', { title })).body.id;
      expect((await admin.del(`/api/v1/tasks/${id}`)).status).toBe(200);
      return id;
    };

    it('restores or permanently deletes several items at once', async () => {
      const [a, b, c] = [await del('Bin A'), await del('Bin B'), await del('Bin C')];
      const restored = await admin.post('/api/v1/recycle-bin/restore-many', { items: [{ id: a, type: 'task' }, { id: b, type: 'task' }] });
      expect(restored.status).toBe(201);
      expect(restored.body).toEqual({ count: 2 });
      expect((await ctx.prisma.task.findUnique({ where: { id: a } }))!.deletedAt).toBeNull();
      expect((await admin.post('/api/v1/recycle-bin/delete-many', { items: [{ id: c, type: 'task' }] })).body).toEqual({ count: 1 });
      expect(await ctx.prisma.task.findUnique({ where: { id: c } })).toBeNull();
    });

    it('restore-all brings back everything', async () => {
      const ids = [await del('All 1'), await del('All 2')];
      expect((await admin.post('/api/v1/recycle-bin/restore-all')).status).toBe(201);
      for (const id of ids) expect((await ctx.prisma.task.findUnique({ where: { id } }))!.deletedAt).toBeNull();
    });

    it('auto-delete is a company setting applied by the nightly job', async () => {
      expect((await admin.put('/api/v1/recycle-bin/settings', { retentionDays: 5 })).status).toBe(400);
      expect((await admin.put('/api/v1/recycle-bin/settings', { retentionDays: 7 })).status).toBe(200);
      expect((await admin.get('/api/v1/recycle-bin/settings')).body).toEqual({ retentionDays: 7 });
      const old = await del('Old one');
      const recent = await del('Recent one');
      await ctx.prisma.task.update({ where: { id: old }, data: { deletedAt: new Date(Date.now() - 10 * 86_400_000) } });
      await ctx.app.get(ScheduledTasksService).runMonthlyAutomation();
      expect(await ctx.prisma.task.findUnique({ where: { id: old } })).toBeNull();
      expect(await ctx.prisma.task.findUnique({ where: { id: recent } })).not.toBeNull();
    });
  });
});
