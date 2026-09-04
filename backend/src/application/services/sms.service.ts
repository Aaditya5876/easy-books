import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async send(to: string, message: string): Promise<boolean> {
    const token = process.env.SMS_API_KEY;
    const from = process.env.SMS_SENDER_ID || 'EasyBks';

    if (!token) {
      this.logger.warn('SMS_API_KEY not set — skipping SMS to ' + to);
      return false;
    }

    try {
      const url = new URL('https://api.sparrowsms.com/v2/sms/');
      url.searchParams.set('token', token);
      url.searchParams.set('from', from);
      url.searchParams.set('to', to);
      url.searchParams.set('text', message);

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
      const body: any = await res.json().catch(() => ({}));
      const ok = body?.response_code === 200;
      if (!ok) this.logger.warn(`SMS failed to ${to}: ${JSON.stringify(body)}`);
      return ok;
    } catch (err) {
      this.logger.error(`SMS error to ${to}: ${err?.message}`);
      return false;
    }
  }

  async sendAbsentAlert(studentName: string, guardianPhone: string, date: string, schoolName = 'School'): Promise<boolean> {
    const msg = `${schoolName}: ${studentName} was marked ABSENT on ${date}. Contact school if this is an error.`;
    return this.send(guardianPhone, msg);
  }

  async sendFeeReminder(studentName: string, guardianPhone: string, amount: number, month: string, schoolName = 'School'): Promise<boolean> {
    const msg = `${schoolName}: Fee of Rs.${amount} for ${studentName} (${month}) is pending. Visit portal to pay online or contact school.`;
    return this.send(guardianPhone, msg);
  }

  async sendPortalCredentials(phone: string, studentName: string, password: string, schoolName = 'School'): Promise<boolean> {
    const msg = `${schoolName}: Portal access created for ${studentName}. Phone: ${phone}, Password: ${password}. Please log in and change your password immediately.`;
    return this.send(phone, msg);
  }

  async sendNotice(phones: string[], noticeTitle: string, schoolName = 'School'): Promise<{ sent: number; failed: number }> {
    const msg = `${schoolName} Notice: "${noticeTitle}". Check portal for full details.`;
    let sent = 0;
    let failed = 0;
    for (const phone of phones) {
      const ok = await this.send(phone, msg);
      ok ? sent++ : failed++;
    }
    return { sent, failed };
  }
}
