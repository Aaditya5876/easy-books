import * as crypto from 'crypto';
import { createTestApp, resetDb, Api, TestContext } from './helpers/app';
import { createSchool, billAndRelease, portalLogin, ledgerTotals, School } from './helpers/school';

const SANDBOX_SECRET = '8gBm/:&EnhH.1/q';
const ORIGIN = 'http://localhost:5173';

// Builds the base64 callback eSewa appends to success_url, signed with `secret`.
function esewaCallback(fields: Record<string, string>, secret = SANDBOX_SECRET) {
  const payload: Record<string, string> = { status: 'COMPLETE', transaction_code: 'ESW123', signed_field_names: 'transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names', product_code: 'EPAYTEST', ...fields };
  const msg = payload.signed_field_names.split(',').map((f) => `${f}=${payload[f]}`).join(',');
  payload.signature = crypto.createHmac('sha256', secret).update(msg).digest('base64');
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

// Stands in for eSewa's status API / Khalti's API (no network in tests).
const realFetch = global.fetch;
let gateway: { esewaStatus: string; khaltiStatus: string; khaltiAmount?: number } = { esewaStatus: 'COMPLETE', khaltiStatus: 'Completed' };
function mockGateways() {
  global.fetch = (async (url: any, init?: any) => {
    const u = String(url);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (u.includes('/api/epay/transaction/status/')) return json({ status: gateway.esewaStatus, ref_id: 'REF1' });
    if (u.endsWith('/epayment/initiate/')) {
      const body = JSON.parse(init.body);
      return json({ pidx: `pidx-${body.purchase_order_id}-${Date.now()}`, payment_url: 'https://test-pay.khalti.com/?pidx=x' });
    }
    if (u.endsWith('/epayment/lookup/')) return json({ status: gateway.khaltiStatus, total_amount: gateway.khaltiAmount, transaction_id: 'KHT1' });
    return realFetch(url, init);
  }) as typeof fetch;
}

describe('Portal online payments (eSewa / Khalti)', () => {
  let ctx: TestContext;
  let school: School;
  let invoices: Record<string, any>;
  let parent: Api;
  let s1: School['students'][number];
  let s2: School['students'][number];

  const payments = async (invoiceId: string) => (await school.admin.get(`/api/v1/school/fee-invoices/${invoiceId}/payments`)).body as any[];
  const startEsewa = (invoiceId: string, origin = ORIGIN) => parent.post(`/api/v1/portal/pay/esewa/${invoiceId}`).set('Origin', origin);

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    mockGateways();
    school = await createSchool(ctx, 2);
    [s1, s2] = school.students;
    invoices = await billAndRelease(school, 3000);
    parent = await portalLogin(ctx, school, s1);
  });
  afterAll(async () => { global.fetch = realFetch; await ctx.app.close(); });
  beforeEach(() => { gateway = { esewaStatus: 'COMPLETE', khaltiStatus: 'Completed' }; delete process.env.KHALTI_SECRET_KEY; delete process.env.FRONTEND_URL; });

  it('tells the portal which gateways are available', async () => {
    const res = await parent.get('/api/v1/portal/payment-gateways');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ esewa: true, khalti: false });
  });

  describe('eSewa', () => {
    it('returns a signed form whose return address is the trusted site, never "undefined"', async () => {
      const res = await startEsewa(invoices[s1.id].id);
      expect(res.status).toBe(201);
      expect(res.body.formFields.success_url).toBe(`${ORIGIN}/portal/payment/return?gateway=esewa&invoiceId=${invoices[s1.id].id}`);
      expect(res.body.formFields.total_amount).toBe('3000.00');
    });

    it('prefers FRONTEND_URL and refuses an untrusted origin when it is not set', async () => {
      expect((await startEsewa(invoices[s1.id].id, 'https://evil.example')).status).toBe(400);
      process.env.FRONTEND_URL = 'https://onebooknp.com/';
      const res = await startEsewa(invoices[s1.id].id, 'https://evil.example');
      expect(res.body.formFields.success_url.startsWith('https://onebooknp.com/portal/payment/return')).toBe(true);
    });

    it("cannot start a payment for another student's invoice", async () => {
      expect((await startEsewa(invoices[s2.id].id)).status).toBe(404);
    });

    it('verify is reachable without a portal token (route order)', async () => {
      const res = await new Api(ctx.app).agent.post('/api/v1/portal/pay/esewa/verify').send({ data: 'x' });
      expect(res.status).toBe(400);
    });

    it('rejects a callback signed with the wrong secret', async () => {
      const { formFields } = (await startEsewa(invoices[s1.id].id)).body;
      const data = esewaCallback({ total_amount: '3000.00', transaction_uuid: formFields.transaction_uuid }, 'not-the-secret');
      expect((await parent.post('/api/v1/portal/pay/esewa/verify', { data })).status).toBe(400);
    });

    it('rejects a validly signed callback for a transaction we never started', async () => {
      const data = esewaCallback({ total_amount: '3000.00', transaction_uuid: `${invoices[s1.id].id}-1` });
      expect((await parent.post('/api/v1/portal/pay/esewa/verify', { data })).status).toBe(400);
      expect(await payments(invoices[s1.id].id)).toHaveLength(0);
    });

    it('rejects a callback whose amount differs from what was started', async () => {
      const { formFields } = (await startEsewa(invoices[s1.id].id)).body;
      const data = esewaCallback({ total_amount: '1.00', transaction_uuid: formFields.transaction_uuid });
      expect((await parent.post('/api/v1/portal/pay/esewa/verify', { data })).status).toBe(400);
    });

    it('records nothing when eSewa itself has not confirmed the payment', async () => {
      gateway.esewaStatus = 'PENDING';
      const { formFields } = (await startEsewa(invoices[s1.id].id)).body;
      const data = esewaCallback({ total_amount: formFields.total_amount, transaction_uuid: formFields.transaction_uuid });
      expect((await parent.post('/api/v1/portal/pay/esewa/verify', { data })).status).toBe(400);
      expect(await payments(invoices[s1.id].id)).toHaveLength(0);
    });

    it('records a confirmed payment once, with a receipt and ledger posting; replays do nothing', async () => {
      const before = await ledgerTotals(school.admin);
      const { formFields } = (await startEsewa(invoices[s1.id].id)).body;
      const data = esewaCallback({ total_amount: formFields.total_amount, transaction_uuid: formFields.transaction_uuid });

      const first = await new Api(ctx.app).agent.post('/api/v1/portal/pay/esewa/verify').send({ data });
      expect(first.status).toBe(201);
      expect(first.body.receiptNo).toMatch(/^R-\d{4}-\d{4}$/);
      const replay = await new Api(ctx.app).agent.post('/api/v1/portal/pay/esewa/verify').send({ data });
      expect(replay.body.alreadyRecorded).toBe(true);

      const recorded = await payments(invoices[s1.id].id);
      expect(recorded).toHaveLength(1);
      expect(recorded[0].method).toBe('ESEWA');
      const after = await ledgerTotals(school.admin);
      expect(after.count).toBe(before.count + 2);
      expect(after.debit).toBeCloseTo(after.credit, 2);
      expect((await startEsewa(invoices[s1.id].id)).status).toBe(400); // already paid
    });

    it('is switched off in production unless eSewa keys are configured', async () => {
      process.env.NODE_ENV = 'production';
      try {
        const res = await parent.get('/api/v1/portal/payment-gateways');
        expect(res.body.esewa).toBe(false);
        expect((await startEsewa(invoices[s1.id].id)).status).toBe(503);
      } finally {
        process.env.NODE_ENV = 'test';
      }
    });
  });

  describe('Khalti', () => {
    let parent2: Api;
    beforeAll(async () => { parent2 = await portalLogin(ctx, school, s2); });
    const start = (invoiceId: string) => parent2.post(`/api/v1/portal/pay/khalti/${invoiceId}`).set('Origin', ORIGIN);

    it('is unavailable without a Khalti key', async () => {
      expect((await start(invoices[s2.id].id)).status).toBe(503);
    });

    it('records a completed payment once; replay and wrong amount are rejected', async () => {
      process.env.KHALTI_SECRET_KEY = 'test_secret_key_x';
      const { pidx } = (await start(invoices[s2.id].id)).body;
      expect(pidx).toBeTruthy();

      gateway.khaltiAmount = 100; // Rs 1 instead of Rs 3000
      expect((await parent2.post('/api/v1/portal/pay/khalti/verify', { pidx })).status).toBe(400);

      gateway.khaltiAmount = 300000;
      expect((await parent2.post('/api/v1/portal/pay/khalti/verify', { pidx })).status).toBe(201);
      expect((await parent2.post('/api/v1/portal/pay/khalti/verify', { pidx })).body.alreadyRecorded).toBe(true);
      expect(await payments(invoices[s2.id].id)).toHaveLength(1);
    });

    it('rejects an unknown pidx', async () => {
      process.env.KHALTI_SECRET_KEY = 'test_secret_key_x';
      expect((await parent2.post('/api/v1/portal/pay/khalti/verify', { pidx: 'made-up' })).status).toBe(400);
    });
  });
});
