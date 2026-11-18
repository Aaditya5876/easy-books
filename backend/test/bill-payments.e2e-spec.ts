import { createTestApp, resetDb, createCompany, loginAs, Api, TestContext, nepalToday } from './helpers/app';
import { ledgerTotals } from './helpers/school';

// Purchases and sales: paying now (in full / part) or on udharo, recording
// payments later, linking every bill to its vendor/client, the per-party
// balance + statement, and creating a Workflow job together with the bill.
describe('Bills — pay now / pay later, party balances, workflow job', () => {
  let ctx: TestContext;
  let admin: Api;
  let companyId: string;
  let otherCompanyVendorId: string;
  let otherCompanyClientId: string;
  let ramId: string;
  let shyamId: string;
  const today = nepalToday();

  const balanceOf = async (accountName: string, cid = companyId) =>
    Number((await ctx.prisma.ledgerAccount.findFirst({ where: { companyId: cid, accountName } }))?.currentBalance ?? 0);
  const balanced = async (api = admin) => {
    const t = await ledgerTotals(api);
    expect(t.debit).toBeCloseTo(t.credit, 2);
  };
  const books = (qty: number, price: number) => [{ description: 'Books', quantity: qty, unitPrice: price }];
  const purchase = (body: object) => admin.post('/api/v1/purchases', { dateAd: today, isVat: false, items: books(50, 1000), ...body });
  const sale = (body: object) => admin.post('/api/v1/sales', { dateAd: today, isVat: false, items: books(10, 1200), ...body });

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    companyId = (await createCompany(ctx.prisma, { name: 'ABC Stationery', businessType: 'RETAIL', modules: [] })).id;
    admin = (await loginAs(ctx, companyId, 'ADMIN')).api;

    const otherId = (await createCompany(ctx.prisma, { name: 'Other Co', businessType: 'RETAIL', modules: [] })).id;
    otherCompanyVendorId = (await ctx.prisma.vendor.create({ data: { companyId: otherId, name: 'Their Vendor' } })).id;
    otherCompanyClientId = (await ctx.prisma.client.create({ data: { companyId: otherId, name: 'Their Client' } })).id;
  });
  afterAll(async () => { await ctx.app.close(); });

  describe('opening balance', () => {
    it('a vendor opening balance is saved and posted: Cr Accounts Payable', async () => {
      const v = await admin.post('/api/v1/vendors', { name: 'Ram Traders', openingBalance: 1000 });
      expect(v.status).toBe(201);
      ramId = v.body.id;
      expect(Number((await admin.get(`/api/v1/vendors/${ramId}`)).body.openingBalance)).toBe(1000);
      expect(await balanceOf('Accounts Payable')).toBe(1000);
      // DR Opening Balance Equity: money already owed lowers the owner's equity.
      expect(await balanceOf('Opening Balance Equity')).toBe(-1000);
      await balanced();
    });

    it('changing it re-posts the difference instead of adding it twice', async () => {
      expect((await admin.put(`/api/v1/vendors/${ramId}`, { openingBalance: 1500 })).status).toBe(200);
      expect(await balanceOf('Accounts Payable')).toBe(1500);
      expect((await admin.put(`/api/v1/vendors/${ramId}`, { openingBalance: 0 })).status).toBe(200);
      expect(await balanceOf('Accounts Payable')).toBe(0);
      expect((await admin.put(`/api/v1/vendors/${ramId}`, { openingBalance: 1000 })).status).toBe(200);
      expect(await balanceOf('Accounts Payable')).toBe(1000);
      await balanced();
    });

    it('a client opening balance is posted: Dr Accounts Receivable', async () => {
      const c = await admin.post('/api/v1/clients', { name: 'Shyam Books', openingBalance: 500 });
      expect(c.status).toBe(201);
      shyamId = c.body.id;
      expect(await balanceOf('Accounts Receivable')).toBe(500);
      await balanced();
    });

    it('refuses a negative opening balance', async () => {
      expect((await admin.post('/api/v1/vendors', { name: 'Bad', openingBalance: -5 })).status).toBe(400);
      expect((await admin.post('/api/v1/clients', { name: 'Bad', openingBalance: -5 })).status).toBe(400);
    });
  });

  describe('purchase: pay now or udharo', () => {
    it('udharo: Pending, nothing paid, Dr Purchases / Cr Accounts Payable, linked to the vendor', async () => {
      const ap = await balanceOf('Accounts Payable');
      const res = await purchase({ vendorId: ramId, vendorName: 'Ram Traders' });
      expect(res.status).toBe(201);
      const bill = (await admin.get(`/api/v1/purchases/${res.body.id}`)).body;
      expect(bill).toMatchObject({ status: 'PENDING', vendorId: ramId, paymentMethod: 'CREDIT' });
      expect(Number(bill.paidAmount)).toBe(0);
      expect(bill.payments).toHaveLength(0);
      expect(await balanceOf('Accounts Payable')).toBe(ap + 50000);
      await balanced();
    });

    it('paid in full by cash: Completed, cash goes down, nothing left owed', async () => {
      const [ap, cash] = [await balanceOf('Accounts Payable'), await balanceOf('Cash in Hand')];
      const res = await purchase({ vendorId: ramId, vendorName: 'Ram Traders', payment: { type: 'FULL', paymentMethod: 'CASH' } });
      expect(res.status).toBe(201);
      const bill = (await admin.get(`/api/v1/purchases/${res.body.id}`)).body;
      expect(bill).toMatchObject({ status: 'COMPLETED', paymentMethod: 'CASH' });
      expect(Number(bill.paidAmount)).toBe(50000);
      expect(bill.payments).toHaveLength(1);
      expect(bill.payments[0].dateAd.slice(0, 10)).toBe(today);
      expect(await balanceOf('Accounts Payable')).toBe(ap);
      expect(await balanceOf('Cash in Hand')).toBe(cash - 50000);
      await balanced();
    });

    it('part paid by bank: Partially Paid, the rest is still owed', async () => {
      const [ap, bank] = [await balanceOf('Accounts Payable'), await balanceOf('Bank Account')];
      const res = await purchase({ vendorId: ramId, vendorName: 'Ram Traders', payment: { type: 'PARTIAL', amount: 20000, paymentMethod: 'BANK_TRANSFER', referenceNumber: 'TXN-1' } });
      expect(res.status).toBe(201);
      const bill = (await admin.get(`/api/v1/purchases/${res.body.id}`)).body;
      expect(bill.status).toBe('PARTIALLY_PAID');
      expect(Number(bill.paidAmount)).toBe(20000);
      expect(bill.payments[0].referenceNumber).toBe('TXN-1');
      expect(await balanceOf('Accounts Payable')).toBe(ap + 30000);
      expect(await balanceOf('Bank Account')).toBe(bank - 20000);
      await balanced();
    });

    it('refuses a bad pay-now choice and saves nothing', async () => {
      const before = await ctx.prisma.purchaseOrder.count({ where: { companyId } });
      const bad = [
        { type: 'PARTIAL', amount: 0, paymentMethod: 'CASH' },
        { type: 'PARTIAL', amount: -5, paymentMethod: 'CASH' },
        { type: 'PARTIAL', amount: 50001, paymentMethod: 'CASH' },
        { type: 'PARTIAL', amount: 'abc', paymentMethod: 'CASH' },
        { type: 'FULL' },
        { type: 'FULL', paymentMethod: 'GOLD' },
        { type: 'SOMETIMES', paymentMethod: 'CASH' },
      ];
      for (const payment of bad) {
        const res = await purchase({ vendorId: ramId, vendorName: 'Ram Traders', payment });
        expect([JSON.stringify(payment), res.status]).toEqual([JSON.stringify(payment), 400]);
      }
      expect(await ctx.prisma.purchaseOrder.count({ where: { companyId } })).toBe(before);
    });
  });

  describe('record a payment later', () => {
    let billId: string;
    beforeAll(async () => {
      billId = (await purchase({ vendorId: ramId, vendorName: 'Ram Traders', items: books(5, 1000) })).body.id;
    });

    it('refuses zero, negative, non-numeric, over-the-due, a missing date or an unknown method', async () => {
      const pay = (body: object) => admin.post(`/api/v1/purchases/${billId}/payment`, { amount: 100, paymentMethod: 'CASH', dateAd: today, ...body });
      for (const body of [{ amount: 0 }, { amount: -100 }, { amount: 'abc' }, { amount: 5001 }, { dateAd: undefined }, { dateAd: 'not-a-date' }, { paymentMethod: 'GOLD' }, { paymentMethod: undefined }]) {
        expect([JSON.stringify(body), (await pay(body)).status]).toEqual([JSON.stringify(body), 400]);
      }
      const bill = (await admin.get(`/api/v1/purchases/${billId}`)).body;
      expect([bill.status, Number(bill.paidAmount)]).toEqual(['PENDING', 0]);
    });

    it('part then the rest: Pending → Partially Paid → Completed; nothing more can be paid', async () => {
      const ap = await balanceOf('Accounts Payable');
      expect((await admin.post(`/api/v1/purchases/${billId}/payment`, { amount: 2000, paymentMethod: 'CASH', dateAd: today })).status).toBe(201);
      expect((await admin.get(`/api/v1/purchases/${billId}`)).body.status).toBe('PARTIALLY_PAID');
      expect((await admin.post(`/api/v1/purchases/${billId}/payment`, { amount: 3000, paymentMethod: 'CHEQUE', dateAd: today, referenceNumber: 'CHQ-9' })).status).toBe(201);
      const bill = (await admin.get(`/api/v1/purchases/${billId}`)).body;
      expect([bill.status, Number(bill.paidAmount), bill.payments.length]).toEqual(['COMPLETED', 5000, 2]);
      expect((await admin.post(`/api/v1/purchases/${billId}/payment`, { amount: 1, paymentMethod: 'CASH', dateAd: today })).status).toBe(400);
      expect(await balanceOf('Accounts Payable')).toBe(ap - 5000);
      await balanced();
    });

    it('a deleted bill cannot be paid', async () => {
      const id = (await purchase({ vendorId: ramId, vendorName: 'Ram Traders', items: books(1, 100) })).body.id;
      expect((await admin.del(`/api/v1/purchases/${id}`)).status).toBe(200);
      expect((await admin.post(`/api/v1/purchases/${id}/payment`, { amount: 100, paymentMethod: 'CASH', dateAd: today })).status).toBe(404);
    });
  });

  describe('every bill belongs to its vendor / client', () => {
    it('a typed vendor name is linked to the existing vendor (any case), or a new vendor is created', async () => {
      const typed = await purchase({ vendorName: '  ram traders ', items: books(1, 10) });
      expect(typed.status).toBe(201);
      expect(typed.body.vendorId).toBe(ramId);
      const fresh = await purchase({ vendorName: 'Gita Suppliers', vendorContact: '9800000000', items: books(1, 10) });
      expect(fresh.status).toBe(201);
      const gita = await ctx.prisma.vendor.findFirst({ where: { companyId, name: 'Gita Suppliers' } });
      expect(gita).toMatchObject({ phone: '9800000000' });
      expect(fresh.body.vendorId).toBe(gita!.id);
    });

    it("refuses another company's vendor or client", async () => {
      expect((await purchase({ vendorId: otherCompanyVendorId, vendorName: 'X' })).status).toBe(400);
      expect((await sale({ clientId: otherCompanyClientId, clientName: 'X' })).status).toBe(400);
    });

    it('a fully paid walk-in sale stays unlinked; an udharo sale to a new name creates the client', async () => {
      const walkIn = await sale({ clientName: 'Walk-in Customer', items: books(1, 50), payment: { type: 'FULL', paymentMethod: 'CASH' } });
      expect(walkIn.status).toBe(201);
      expect(walkIn.body.clientId).toBeNull();
      expect(await ctx.prisma.client.count({ where: { companyId, name: 'Walk-in Customer' } })).toBe(0);

      const credit = await sale({ clientName: 'Hari Sharma', items: books(1, 50) });
      expect(credit.status).toBe(201);
      const hari = await ctx.prisma.client.findFirst({ where: { companyId, name: 'Hari Sharma' } });
      expect(credit.body.clientId).toBe(hari!.id);
    });
  });

  describe('sale: receive now or udharo', () => {
    it('udharo: Pending, Dr Accounts Receivable / Cr Sales', async () => {
      const ar = await balanceOf('Accounts Receivable');
      const res = await sale({ clientId: shyamId, clientName: 'Shyam Books' });
      expect(res.status).toBe(201);
      const bill = (await admin.get(`/api/v1/sales/${res.body.id}`)).body;
      expect(bill).toMatchObject({ status: 'PENDING', clientId: shyamId, paymentMethod: 'CREDIT' });
      expect(await balanceOf('Accounts Receivable')).toBe(ar + 12000);
      await balanced();
    });

    it('received in full: Completed, cash goes up, nothing left owed', async () => {
      const [ar, cash] = [await balanceOf('Accounts Receivable'), await balanceOf('Cash in Hand')];
      const res = await sale({ clientId: shyamId, clientName: 'Shyam Books', payment: { type: 'FULL', paymentMethod: 'CASH' } });
      expect(res.status).toBe(201);
      expect((await admin.get(`/api/v1/sales/${res.body.id}`)).body.status).toBe('COMPLETED');
      expect(await balanceOf('Accounts Receivable')).toBe(ar);
      expect(await balanceOf('Cash in Hand')).toBe(cash + 12000);
      await balanced();
    });

    it('part received, then the rest later', async () => {
      const res = await sale({ clientId: shyamId, clientName: 'Shyam Books', payment: { type: 'PARTIAL', amount: 2000, paymentMethod: 'QR' } });
      expect(res.status).toBe(201);
      expect((await admin.get(`/api/v1/sales/${res.body.id}`)).body.status).toBe('PARTIALLY_PAID');
      for (const body of [{ amount: 0 }, { amount: -1 }, { amount: 10001 }, { dateAd: undefined }]) {
        expect((await admin.post(`/api/v1/sales/${res.body.id}/payment`, { amount: 100, paymentMethod: 'CASH', dateAd: today, ...body })).status).toBe(400);
      }
      expect((await admin.post(`/api/v1/sales/${res.body.id}/payment`, { amount: 10000, paymentMethod: 'CASH', dateAd: today })).status).toBe(201);
      expect((await admin.get(`/api/v1/sales/${res.body.id}`)).body.status).toBe('COMPLETED');
      await balanced();
    });
  });

  describe('deleting an unpaid bill', () => {
    it('takes its ledger entries back out', async () => {
      const [ap, ar] = [await balanceOf('Accounts Payable'), await balanceOf('Accounts Receivable')];
      const p = (await purchase({ vendorId: ramId, vendorName: 'Ram Traders', items: books(3, 100) })).body.id;
      const s = (await sale({ clientId: shyamId, clientName: 'Shyam Books', items: books(2, 100) })).body.id;
      expect(await balanceOf('Accounts Payable')).toBe(ap + 300);
      expect(await balanceOf('Accounts Receivable')).toBe(ar + 200);
      expect((await admin.del(`/api/v1/purchases/${p}`)).status).toBe(200);
      expect((await admin.del(`/api/v1/sales/${s}`)).status).toBe(200);
      expect(await balanceOf('Accounts Payable')).toBe(ap);
      expect(await balanceOf('Accounts Receivable')).toBe(ar);
      expect(await ctx.prisma.ledgerEntry.count({ where: { companyId, referenceId: { in: [p, s] } } })).toBe(0);
      await balanced();
    });
  });

  describe('vendor / client balance and statement', () => {
    it('vendor: opening + bills − payments − debit notes, as a running statement', async () => {
      const hari = (await admin.post('/api/v1/vendors', { name: 'Hari Wholesale', openingBalance: 1000 })).body.id;
      const bill = (await purchase({ vendorId: hari, vendorName: 'Hari Wholesale', items: books(5, 1000) })).body;
      expect((await admin.post(`/api/v1/purchases/${bill.id}/payment`, { amount: 2000, paymentMethod: 'CASH', dateAd: today })).status).toBe(201);
      expect((await admin.post('/api/v1/debit-notes', { vendorId: hari, purchaseOrderId: bill.id, dateAd: today, amount: 500, reason: 'Damaged' })).status).toBe(201);
      // A bill typed for someone else must not count towards Hari.
      await purchase({ vendorName: 'Someone Else', items: books(1, 999) });

      const row = (await admin.get('/api/v1/vendors')).body.find((v: any) => v.id === hari);
      expect(row.balance).toEqual({ openingBalance: 1000, billed: 5000, paid: 2000, returns: 500, due: 3500 });

      const st = (await admin.get(`/api/v1/vendors/${hari}/statement`)).body;
      expect(st.lines.map((l: any) => [l.type, l.debit, l.credit, l.balance])).toEqual([
        ['OPENING', 0, 1000, 1000],
        ['BILL', 0, 5000, 6000],
        ['PAYMENT', 2000, 0, 4000],
        ['RETURN', 500, 0, 3500],
      ]);
      expect(st.lines[1].reference).toBe(bill.orderNumber);
      expect(st.closingBalance).toBe(3500);
    });

    it('client: opening + bills − receipts − credit notes', async () => {
      const gopal = (await admin.post('/api/v1/clients', { name: 'Gopal Store', openingBalance: 500 })).body.id;
      const bill = (await sale({ clientId: gopal, clientName: 'Gopal Store', items: books(1, 1000) })).body;
      expect((await admin.post(`/api/v1/sales/${bill.id}/payment`, { amount: 400, paymentMethod: 'CASH', dateAd: today })).status).toBe(201);
      expect((await admin.post('/api/v1/credit-notes', { clientId: gopal, salesOrderId: bill.id, dateAd: today, amount: 100, reason: 'Returned' })).status).toBe(201);

      const row = (await admin.get('/api/v1/clients')).body.find((c: any) => c.id === gopal);
      expect(row.balance).toEqual({ openingBalance: 500, billed: 1000, paid: 400, returns: 100, due: 1000 });

      const st = (await admin.get(`/api/v1/clients/${gopal}/statement`)).body;
      expect(st.lines.map((l: any) => [l.type, l.debit, l.credit, l.balance])).toEqual([
        ['OPENING', 500, 0, 500],
        ['BILL', 1000, 0, 1500],
        ['PAYMENT', 0, 400, 1100],
        ['RETURN', 0, 100, 1000],
      ]);
      expect(st.closingBalance).toBe(1000);
    });

    it("another company's vendor statement is not found", async () => {
      expect((await admin.get(`/api/v1/vendors/${otherCompanyVendorId}/statement`)).status).toBe(404);
      expect((await admin.get(`/api/v1/clients/${otherCompanyClientId}/statement`)).status).toBe(404);
    });
  });

  describe('workflow job created with the bill', () => {
    it('creates a linked job filled from the bill', async () => {
      const res = await purchase({ vendorId: ramId, vendorName: 'Ram Traders', items: books(2, 500), createJob: true });
      expect(res.status).toBe(201);
      const task = await ctx.prisma.task.findFirst({ where: { id: res.body.taskId, companyId } });
      expect(task).toMatchObject({ partyType: 'VENDOR', partyId: ramId, partyName: 'Ram Traders', status: 'PENDING' });
      expect(task!.title).toContain(res.body.orderNumber);
      expect(task!.taskNumber).toBeGreaterThan(0);
      const links = (await admin.get(`/api/v1/tasks/${task!.id}/links`)).body;
      expect(links.purchases.map((p: any) => p.id)).toEqual([res.body.id]);

      const s = await sale({ clientId: shyamId, clientName: 'Shyam Books', items: books(1, 500), createJob: true, payment: { type: 'FULL', paymentMethod: 'CASH' } });
      expect(s.status).toBe(201);
      const saleTask = await ctx.prisma.task.findFirst({ where: { id: s.body.taskId } });
      expect(saleTask).toMatchObject({ partyType: 'CLIENT', partyId: shyamId, taskNumber: task!.taskNumber! + 1 });
    });

    it('refuses "create a job" together with an existing job, and saves nothing', async () => {
      const job = (await admin.post('/api/v1/tasks', { title: 'Existing job' })).body.id;
      const before = await ctx.prisma.purchaseOrder.count({ where: { companyId } });
      expect((await purchase({ vendorId: ramId, vendorName: 'Ram Traders', taskId: job, createJob: true })).status).toBe(400);
      expect(await ctx.prisma.purchaseOrder.count({ where: { companyId } })).toBe(before);
    });
  });

  describe('books come back to zero', () => {
    it('once every bill is paid, Accounts Payable / Receivable are 0 and the ledger balances', async () => {
      const cid = (await createCompany(ctx.prisma, { name: 'Clean Co', businessType: 'RETAIL', modules: [] })).id;
      const api = (await loginAs(ctx, cid, 'ADMIN')).api;
      const p = (await api.post('/api/v1/purchases', { vendorName: 'V', dateAd: today, items: books(10, 100) })).body.id;
      const s = (await api.post('/api/v1/sales', { clientName: 'C', dateAd: today, items: books(5, 300) })).body.id;
      expect((await api.post(`/api/v1/purchases/${p}/payment`, { amount: 1000, paymentMethod: 'CASH', dateAd: today })).status).toBe(201);
      expect((await api.post(`/api/v1/sales/${s}/payment`, { amount: 1500, paymentMethod: 'BANK_TRANSFER', dateAd: today })).status).toBe(201);
      expect(await balanceOf('Accounts Payable', cid)).toBe(0);
      expect(await balanceOf('Accounts Receivable', cid)).toBe(0);
      expect(await balanceOf('Cash in Hand', cid)).toBe(-1000);
      expect(await balanceOf('Bank Account', cid)).toBe(1500);
      await balanced(api);
    });
  });
});
