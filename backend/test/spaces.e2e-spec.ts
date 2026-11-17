import { createTestApp, resetDb, createCompany, loginAs, Api, TestContext } from './helpers/app';
import { ledgerTotals } from './helpers/school';
import { LedgerPostingService } from '../src/application/services/ledger-posting.service';

// Spaces: rooms (hotel), tables (restaurant), beds (clinic), chairs (salon)…
// one feature for all. Occupy / reserve a space, add charges while it's in
// use, close it → a normal sales bill (stock, VAT, ledger, payment).
describe('Spaces', () => {
  let ctx: TestContext;
  let admin: Api;
  let staff: Api;
  let companyId: string;

  const space = (name: string, extra: object = {}) => admin.post('/api/v1/spaces', { name, type: 'Room', ...extra });
  const balanced = async () => { const t = await ledgerTotals(admin); expect(t.debit).toBeCloseTo(t.credit, 2); };

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    companyId = (await createCompany(ctx.prisma, { name: 'Hotel Annapurna', businessType: 'OTHER', modules: [] })).id;
    admin = (await loginAs(ctx, companyId, 'ADMIN')).api;
    staff = (await loginAs(ctx, companyId, 'STAFF')).api;
  });
  afterAll(async () => { await ctx.app.close(); });
  afterEach(() => jest.restoreAllMocks());

  describe('setting up spaces', () => {
    it('creates spaces one by one or many at once; names are unique per company', async () => {
      const r = await space('101', { capacity: 2, rate: 2500, rateUnit: 'NIGHT' });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ name: '101', type: 'Room', status: 'FREE', capacity: 2, rateUnit: 'NIGHT' });
      expect((await space('101')).status).toBe(409);
      const bulk = await admin.post('/api/v1/spaces/bulk', { type: 'Table', names: ['T1', 'T2', 'T3', 'T1'] });
      expect(bulk.status).toBe(201);
      expect(bulk.body.created).toBe(3);
      expect((await admin.get('/api/v1/spaces')).body.filter((s: any) => s.type === 'Table')).toHaveLength(3);
      expect((await staff.post('/api/v1/spaces', { name: 'X', type: 'Room' })).status).toBe(403);
    });

    it("other companies can't see or touch them", async () => {
      const other = (await createCompany(ctx.prisma, { name: 'Other Hotel', businessType: 'OTHER', modules: [] })).id;
      const otherAdmin = (await loginAs(ctx, other, 'ADMIN')).api;
      const mine = (await admin.get('/api/v1/spaces')).body[0];
      expect((await otherAdmin.get('/api/v1/spaces')).body).toHaveLength(0);
      expect((await otherAdmin.post(`/api/v1/spaces/${mine.id}/sessions`, { mode: 'OCCUPY', guestName: 'X' })).status).toBe(404);
      expect((await otherAdmin.put(`/api/v1/spaces/${mine.id}`, { name: 'Hacked' })).status).toBe(404);
    });
  });

  describe('occupy, reserve, charges', () => {
    it('a free space can be occupied once; racing occupations — one wins', async () => {
      const s = (await space('201')).body;
      const results = await Promise.all([1, 2, 3].map((i) => staff.post(`/api/v1/spaces/${s.id}/sessions`, { mode: 'OCCUPY', guestName: `Guest ${i}` })));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(2);
      expect((await ctx.prisma.space.findUnique({ where: { id: s.id } }))!.status).toBe('OCCUPIED');
      expect(await ctx.prisma.spaceSession.count({ where: { spaceId: s.id, status: 'OPEN' } })).toBe(1);
    });

    it('a reservation holds the space; check-in opens it; cancelling frees it', async () => {
      const s = (await space('202')).body;
      const resv = await staff.post(`/api/v1/spaces/${s.id}/sessions`, { mode: 'RESERVE', guestName: 'Sita', guestContact: '9800000000', reservedFor: '2030-01-10' });
      expect(resv.status).toBe(201);
      expect(resv.body.status).toBe('RESERVED');
      expect((await ctx.prisma.space.findUnique({ where: { id: s.id } }))!.status).toBe('RESERVED');
      expect((await staff.post(`/api/v1/spaces/${s.id}/sessions`, { mode: 'OCCUPY', guestName: 'Walk-in' })).status).toBe(409);
      expect((await staff.post(`/api/v1/space-sessions/${resv.body.id}/check-in`)).status).toBe(201);
      expect((await ctx.prisma.space.findUnique({ where: { id: s.id } }))!.status).toBe('OCCUPIED');

      const s2 = (await space('203')).body;
      const r2 = (await staff.post(`/api/v1/spaces/${s2.id}/sessions`, { mode: 'RESERVE', guestName: 'Ram' })).body;
      expect((await staff.post(`/api/v1/space-sessions/${r2.id}/cancel`)).status).toBe(201);
      expect((await ctx.prisma.space.findUnique({ where: { id: s2.id } }))!.status).toBe('FREE');
    });

    it('charges are added while open (stock items take their price); removed; refused once closed', async () => {
      const item = (await admin.post('/api/v1/inventory', { itemName: 'Coke', quantity: 10, unit: 'Bottle', unitSellingPrice: 120 })).body;
      const s = (await space('204')).body;
      const sess = (await staff.post(`/api/v1/spaces/${s.id}/sessions`, { mode: 'OCCUPY', guestName: 'Hari' })).body;
      const a = await staff.post(`/api/v1/space-sessions/${sess.id}/charges`, { inventoryItemId: item.id, quantity: 2 });
      expect(a.status).toBe(201);
      expect(a.body).toMatchObject({ description: 'Coke' });
      expect(Number(a.body.unitPrice)).toBe(120);
      const b = (await staff.post(`/api/v1/space-sessions/${sess.id}/charges`, { description: 'Laundry', quantity: 1, unitPrice: 300 })).body;
      expect((await staff.del(`/api/v1/space-sessions/${sess.id}/charges/${b.id}`)).status).toBe(200);
      const detail = (await staff.get(`/api/v1/space-sessions/${sess.id}`)).body;
      expect(detail.charges).toHaveLength(1);
      expect(detail.chargesTotal).toBe(240);
      expect((await staff.post(`/api/v1/space-sessions/${sess.id}/charges`, { description: 'x', quantity: 0, unitPrice: 1 })).status).toBe(400);
    });
  });

  describe('close and bill', () => {
    it('room nights + charges become one sales bill: stock out, VAT, ledger balanced, paid, room to cleaning', async () => {
      const item = (await admin.post('/api/v1/inventory', { itemName: 'Water', quantity: 20, unit: 'Bottle', unitSellingPrice: 50 })).body;
      const s = (await space('301', { rate: 2000, rateUnit: 'NIGHT' })).body;
      const sess = (await staff.post(`/api/v1/spaces/${s.id}/sessions`, { mode: 'OCCUPY', guestName: 'Gita', guestContact: '9811111111' })).body;
      // Checked in two days ago.
      await ctx.prisma.spaceSession.update({ where: { id: sess.id }, data: { startedAt: new Date(Date.now() - 2 * 86_400_000 - 3_600_000) } });
      await staff.post(`/api/v1/space-sessions/${sess.id}/charges`, { inventoryItemId: item.id, quantity: 4 });

      const preview = (await staff.get(`/api/v1/space-sessions/${sess.id}`)).body;
      expect(preview.timeCharge).toMatchObject({ quantity: 3, unitPrice: 2000 }); // 2 days 1 hour → 3 nights
      expect((await staff.post(`/api/v1/space-sessions/${sess.id}/close`, {})).status).toBe(403); // billing = accountant/admin

      const closed = await admin.post(`/api/v1/space-sessions/${sess.id}/close`, { paymentMethod: 'CASH', isVat: true, timeQuantity: 2, nextStatus: 'CLEANING' });
      expect(closed.status).toBe(201);
      const bill = await ctx.prisma.salesOrder.findUnique({ where: { id: closed.body.salesOrderId }, include: { items: true } });
      expect(bill).toMatchObject({ clientName: 'Gita', clientContact: '9811111111', status: 'COMPLETED' });
      expect(bill!.items.map((i) => [i.description, Number(i.quantity), Number(i.unitPrice)]).sort())
        .toEqual([['Room 301 — 2 night(s)', 2, 2000], ['Water', 4, 50]].sort());
      expect(Number(bill!.totalAmount)).toBeCloseTo((4000 + 200) * 1.13, 2);
      expect(Number((await ctx.prisma.inventoryItem.findUnique({ where: { id: item.id } }))!.quantity)).toBe(16);
      expect((await ctx.prisma.space.findUnique({ where: { id: s.id } }))!.status).toBe('CLEANING');
      expect((await ctx.prisma.spaceSession.findUnique({ where: { id: sess.id } }))!.status).toBe('CLOSED');
      await balanced();

      expect((await staff.patch(`/api/v1/spaces/${s.id}/status`, { status: 'FREE' })).status).toBe(200);
    });

    it('closing twice at once makes one bill', async () => {
      const s = (await space('302')).body;
      const sess = (await staff.post(`/api/v1/spaces/${s.id}/sessions`, { mode: 'OCCUPY', guestName: 'Twice' })).body;
      await staff.post(`/api/v1/space-sessions/${sess.id}/charges`, { description: 'Dinner', quantity: 1, unitPrice: 900 });
      const results = await Promise.all([1, 2, 3].map(() => admin.post(`/api/v1/space-sessions/${sess.id}/close`, { paymentMethod: 'CREDIT' })));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(await ctx.prisma.salesOrder.count({ where: { companyId, clientName: 'Twice' } })).toBe(1);
    });

    it('if billing fails, the table stays open and nothing is billed', async () => {
      const s = (await admin.post('/api/v1/spaces', { name: 'T9', type: 'Table' })).body;
      const sess = (await staff.post(`/api/v1/spaces/${s.id}/sessions`, { mode: 'OCCUPY', guestName: 'Table guest' })).body;
      await staff.post(`/api/v1/space-sessions/${sess.id}/charges`, { description: 'Momo', quantity: 2, unitPrice: 200 });
      jest.spyOn(LedgerPostingService.prototype, 'postSalesOrder').mockRejectedValueOnce(new Error('ledger down'));
      expect((await admin.post(`/api/v1/space-sessions/${sess.id}/close`, { paymentMethod: 'CASH' })).status).toBe(500);
      expect((await ctx.prisma.spaceSession.findUnique({ where: { id: sess.id } }))!.status).toBe('OPEN');
      expect((await ctx.prisma.space.findUnique({ where: { id: s.id } }))!.status).toBe('OCCUPIED');
      expect(await ctx.prisma.salesOrder.count({ where: { companyId, clientName: 'Table guest' } })).toBe(0);
    });

    it('nothing to bill → closes without a bill', async () => {
      const s = (await space('303')).body;
      const sess = (await staff.post(`/api/v1/spaces/${s.id}/sessions`, { mode: 'OCCUPY', guestName: 'Free stay' })).body;
      const res = await admin.post(`/api/v1/space-sessions/${sess.id}/close`, { nextStatus: 'FREE' });
      expect(res.status).toBe(201);
      expect(res.body.salesOrderId).toBeNull();
      expect((await ctx.prisma.space.findUnique({ where: { id: s.id } }))!.status).toBe('FREE');
    });

    it("a space in use can't be deleted or have its status forced", async () => {
      const s = (await space('304')).body;
      await staff.post(`/api/v1/spaces/${s.id}/sessions`, { mode: 'OCCUPY', guestName: 'Busy' });
      expect((await admin.del(`/api/v1/spaces/${s.id}`)).status).toBe(400);
      expect((await staff.patch(`/api/v1/spaces/${s.id}/status`, { status: 'FREE' })).status).toBe(400);
      expect((await staff.patch(`/api/v1/spaces/${s.id}/status`, { status: 'OCCUPIED' })).status).toBe(400);
    });
  });
});
