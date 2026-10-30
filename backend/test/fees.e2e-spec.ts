import { createTestApp, resetDb, loginAs, Api, TestContext, sent } from './helpers/app';
import { createSchool, portalLogin, ledgerTotals, School } from './helpers/school';

const S = '/api/v1/school';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

describe('School fees, end to end', () => {
  let ctx: TestContext;
  let school: School;
  let admin: Api;
  const st = () => school.students;
  const heads: Record<string, string> = {};
  const inv: Record<string, any> = {};

  const invoices = async () => {
    const body = (await admin.get(`${S}/fee-invoices`, { pageSize: 100 })).body;
    return (Array.isArray(body) ? body : body.data) as any[];
  };
  const invoiceOf = async (studentId: string) => (await invoices()).find((i) => i.studentId === studentId);
  const invoiceById = async (id: string) => (await invoices()).find((i) => i.id === id);
  const profile = async (studentId: string) => (await admin.get(`${S}/students/${studentId}/fee-profile`)).body;
  const profileTotal = (p: any) => p.lines.reduce((s: number, l: any) => s + Number(l.amount), 0);

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    school = await createSchool(ctx, 4);
    admin = school.admin;
  });
  afterAll(async () => { await ctx.app.close(); });

  describe('setup', () => {
    it('creates the default fee heads and custom ones', async () => {
      expect((await admin.post(`${S}/fee-heads/defaults`)).status).toBe(201);
      for (const h of (await admin.get(`${S}/fee-heads`)).body) heads[h.code] = h.id;
      expect(Object.keys(heads)).toEqual(expect.arrayContaining(['TUI', 'ADM', 'EXM', 'TRN', 'HST', 'LIB', 'CMP', 'SPT']));
      const lab = await admin.post(`${S}/fee-heads`, { name: 'Lab Fee', code: 'LAB', type: 'GENERAL' });
      expect(lab.status).toBe(201);
      expect((await admin.put(`${S}/fee-heads/${lab.body.id}`, { name: 'Science Lab Fee' })).body.name).toBe('Science Lab Fee');
    });

    it('sets class fee structures', async () => {
      expect((await admin.post(`${S}/fee-structures`, { classId: school.classId, feeHeadId: heads.TUI, name: 'Tuition', amount: 3000, frequency: 'MONTHLY' })).status).toBe(201);
      expect((await admin.post(`${S}/fee-structures`, { classId: school.classId, feeHeadId: heads.CMP, name: 'Computer', amount: 500, frequency: 'MONTHLY' })).status).toBe(201);
    });

    it('package, scholarship, bus and hostel all land in the right fee profiles', async () => {
      const [s1, s2, s3, s4] = st();
      const pkg = await admin.post(`${S}/fee-packages`, { name: 'Sports + Library', feeHeadIds: [heads.SPT, heads.LIB], price: 400 });
      expect((await admin.patch(`${S}/students/${s2.id}/package`, { packageId: pkg.body.id })).status).toBe(200);
      expect((await admin.post(`${S}/students/${s3.id}/scholarships`, { name: 'Merit', type: 'PERCENT', value: 150 })).status).toBe(400);
      expect((await admin.post(`${S}/students/${s3.id}/scholarships`, { name: 'Merit', type: 'PERCENT', value: 50 })).status).toBe(201);
      const route = await admin.post(`${S}/transport/routes`, { routeName: 'Route A', monthlyFee: 1200 });
      expect((await admin.post(`${S}/transport/assignments`, { routeId: route.body.id, studentId: s1.id, pickupStop: 'Chowk' })).status).toBe(201);
      expect((await admin.post(`${S}/transport/assignments`, { routeId: route.body.id, studentId: s1.id })).status).toBeGreaterThanOrEqual(400);
      const room = await admin.post(`${S}/hostel/rooms`, { roomNumber: '101', floor: '1st', capacity: 1, monthlyFee: 5000 });
      expect((await admin.post(`${S}/hostel/allocations`, { roomId: room.body.id, studentId: s4.id, startDate: '2026-04-14' })).status).toBe(201);
      expect((await admin.post(`${S}/hostel/allocations`, { roomId: room.body.id, studentId: s3.id, startDate: '2026-04-14' })).status).toBeGreaterThanOrEqual(400);

      expect(profileTotal(await profile(s1.id))).toBe(3500 + 1200);
      expect(JSON.stringify(await profile(s2.id))).toContain('Sports + Library');
      expect(profileTotal(await profile(s4.id))).toBe(3500 + 5000);
    });
  });

  describe('billing', () => {
    it('Run Billing invoices every active student once', async () => {
      const first = await admin.post(`${S}/billing-run`);
      expect(first.body.created).toBe(4);
      expect((await admin.post(`${S}/billing-run`)).body.created).toBe(0);
      for (const s of st()) inv[s.id] = await invoiceOf(s.id);
      expect(Number(inv[st()[2].id].totalAmount)).toBeLessThan(3500); // 50% scholarship applied
    });

    it('manual invoice requires a student and a BS YYYY-MM month', async () => {
      expect((await admin.post(`${S}/fee-invoices`, { month: '2083-07', items: [{ name: 'Exam', amount: 800 }] })).status).toBe(400);
      expect((await admin.post(`${S}/fee-invoices`, { studentId: st()[0].id, month: 'Kartik', items: [{ name: 'X', amount: 1 }] })).status).toBe(400);
      expect((await admin.post(`${S}/fee-invoices`, { studentId: st()[0].id, month: '2083-06', items: [{ feeHeadId: heads.EXM, name: 'Exam Fee', amount: 800 }] })).status).toBe(201);
    });

    it('releases one invoice, refuses a second release, then releases the rest', async () => {
      const id = inv[st()[0].id].id;
      expect((await admin.patch(`${S}/fee-invoices/${id}/release`)).status).toBe(200);
      expect((await admin.patch(`${S}/fee-invoices/${id}/release`)).status).toBe(400);
      expect((await admin.post(`${S}/fee-invoices/release-bulk`)).status).toBe(201);
      expect((await invoices()).every((i) => i.releasedAt)).toBe(true);
    });
  });

  describe('desk payments', () => {
    it('partial then full cash payment, receipts, QR verification and ledger', async () => {
      const id = inv[st()[0].id].id;
      const total = Number(inv[st()[0].id].totalAmount);
      const before = await ledgerTotals(admin);

      expect((await admin.patch(`${S}/fee-invoices/${id}/payment`, { amount: 0, method: 'CASH' })).status).toBe(400);
      expect((await admin.patch(`${S}/fee-invoices/${id}/payment`, { amount: total + 1, method: 'CASH' })).status).toBe(400);
      expect((await admin.patch(`${S}/fee-invoices/${id}/payment`, { amount: 1000, method: 'CASH' })).status).toBe(200);
      expect((await invoiceById(id)).status).toBe('PARTIAL');
      expect((await admin.patch(`${S}/fee-invoices/${id}/payment`, { amount: total - 1000, method: 'CASH' })).status).toBe(200);
      expect((await invoiceById(id)).status).toBe('PAID');

      const payments = (await admin.get(`${S}/fee-invoices/${id}/payments`)).body as any[];
      expect(payments).toHaveLength(2);
      for (const p of payments) expect(p.receiptNo).toMatch(/^R-\d{4}-\d{4}$/);
      expect((await admin.get(`${S}/fee-invoices/${id}/receipt`)).status).toBe(200);
      const scanned = await admin.get(`${S}/fee-payments/verify/${payments[0].verificationCode}`);
      expect(scanned.body.receiptNo).toBe(payments[0].receiptNo);
      // unknown code → empty response; the Verify dialog shows "No confirmed payment matches this code"
      expect((await admin.get(`${S}/fee-payments/verify/NOPE0000`)).body.receiptNo).toBeUndefined();

      const after = await ledgerTotals(admin);
      expect(after.count).toBe(before.count + 4);
      expect(after.debit).toBeCloseTo(after.credit, 2);
    });

    it('bank payment needs the receiving bank account', async () => {
      const id = inv[st()[1].id].id;
      expect((await admin.patch(`${S}/fee-invoices/${id}/payment`, { amount: 100, method: 'BANK' })).status).toBe(400);
    });

    it('fee reminder SMS goes to the guardian', async () => {
      sent.sms.length = 0;
      expect((await admin.post(`${S}/sms/fee-reminder/${inv[st()[2].id].id}`)).status).toBe(201);
      expect(sent.sms.length).toBe(1);
    });
  });

  describe('parent portal payment proofs', () => {
    let parent: Api;
    let proofUrl: string;
    const s3 = () => st()[2];

    beforeAll(async () => { parent = await portalLogin(ctx, school, s3()); });

    it('parent sees only their own invoices and receipts', async () => {
      const fees = (await parent.get('/api/v1/portal/fees')).body as any[];
      expect(fees.map((f) => f.studentId)).toEqual(expect.arrayContaining([s3().id]));
      expect(fees.every((f) => f.studentId === s3().id)).toBe(true);
      expect((await parent.get(`/api/v1/portal/fees/${inv[st()[0].id].id}/receipt`)).status).toBeGreaterThanOrEqual(400);
    });

    it('uploads an image (not other files) as proof', async () => {
      const ok = await parent.agent.post('/api/v1/portal/upload').set('Authorization', `Bearer ${parent.bearer}`).attach('file', PNG, 'proof.png');
      expect(ok.status).toBe(201);
      proofUrl = ok.body.url;
      const bad = await parent.agent.post('/api/v1/portal/upload').set('Authorization', `Bearer ${parent.bearer}`).attach('file', Buffer.from('MZ'), 'virus.exe');
      expect(bad.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects proofs with no screenshot, zero amount, too much, or for someone else', async () => {
      const id = inv[s3().id].id;
      expect((await parent.post(`/api/v1/portal/fees/${id}/payment-proof`, { amount: 500, method: 'ESEWA' })).status).toBe(400);
      expect((await parent.post(`/api/v1/portal/fees/${id}/payment-proof`, { amount: 0, method: 'ESEWA', proofScreenshotUrl: proofUrl })).status).toBe(400);
      expect((await parent.post(`/api/v1/portal/fees/${id}/payment-proof`, { amount: 999999, method: 'ESEWA', proofScreenshotUrl: proofUrl })).status).toBe(400);
      expect((await parent.post(`/api/v1/portal/fees/${inv[st()[0].id].id}/payment-proof`, { amount: 10, method: 'ESEWA', proofScreenshotUrl: proofUrl })).status).toBeGreaterThanOrEqual(400);
    });

    it('admin confirms one proof (posted to ledger) and rejects another (not posted)', async () => {
      const id = inv[s3().id].id;
      const p1 = await parent.post(`/api/v1/portal/fees/${id}/payment-proof`, { amount: 500, method: 'ESEWA', proofScreenshotUrl: proofUrl });
      const p2 = await parent.post(`/api/v1/portal/fees/${id}/payment-proof`, { amount: 200, method: 'ESEWA', proofScreenshotUrl: proofUrl });
      expect((await admin.get(`${S}/fee-payments/pending`)).body).toHaveLength(2);

      const staff = (await loginAs(ctx, school.companyId, 'STAFF')).api;
      expect((await staff.patch(`${S}/fee-payments/${p1.body.id}/confirm`)).status).toBe(403);

      const before = await ledgerTotals(admin);
      expect((await admin.patch(`${S}/fee-payments/${p1.body.id}/confirm`)).status).toBe(200);
      expect((await admin.patch(`${S}/fee-payments/${p1.body.id}/confirm`)).status).toBeGreaterThanOrEqual(400);
      expect((await admin.patch(`${S}/fee-payments/${p2.body.id}/reject`)).status).toBe(400);
      expect((await admin.patch(`${S}/fee-payments/${p2.body.id}/reject`, { reason: 'Unreadable' })).status).toBe(200);
      const after = await ledgerTotals(admin);
      expect(after.count).toBe(before.count + 2);
      expect(after.debit).toBeCloseTo(after.credit, 2);

      const mine = ((await parent.get('/api/v1/portal/fees')).body as any[]).find((f) => f.id === id);
      expect(Number(mine.paidAmount)).toBe(500);
      expect(((await parent.get('/api/v1/portal/notifications')).body as any[]).length).toBeGreaterThanOrEqual(2);
    });
  });
});
