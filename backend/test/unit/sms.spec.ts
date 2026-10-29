import { SmsService } from '../../src/application/services/sms.service';

// SMS is best-effort: a missing key, a gateway error or a network failure must
// return false, never throw into attendance saving or fee reminders.
describe('SmsService (Sparrow SMS)', () => {
  const realFetch = global.fetch;
  const sms = new SmsService();
  afterEach(() => { global.fetch = realFetch; delete process.env.SMS_API_KEY; });

  it('skips without an API key', async () => {
    delete process.env.SMS_API_KEY;
    expect(await sms.send('9800000000', 'hi')).toBe(false);
  });

  it('sends with token, sender and text, and reports success', async () => {
    process.env.SMS_API_KEY = 'k';
    let called = '';
    global.fetch = (async (url: string) => { called = url; return new Response(JSON.stringify({ response_code: 200 })); }) as any;
    expect(await sms.sendFeeReminder('Aarav', '9800000000', 3000, '2083-07', 'QA School')).toBe(true);
    const u = new URL(called);
    expect(u.searchParams.get('token')).toBe('k');
    expect(u.searchParams.get('to')).toBe('9800000000');
    expect(u.searchParams.get('text')).toContain('3000');
  });

  it('returns false on a gateway error or network failure', async () => {
    process.env.SMS_API_KEY = 'k';
    global.fetch = (async () => new Response(JSON.stringify({ response_code: 1002 }))) as any;
    expect(await sms.send('9800000000', 'hi')).toBe(false);
    global.fetch = (async () => { throw new Error('offline'); }) as any;
    expect(await sms.send('9800000000', 'hi')).toBe(false);
  });
});
