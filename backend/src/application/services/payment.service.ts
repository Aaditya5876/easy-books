import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import * as crypto from 'crypto';

const ESEWA_TEST_URL = 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
const ESEWA_LIVE_URL = 'https://epay.esewa.com.np/api/epay/main/v2/form';
const KHALTI_TEST_BASE = 'https://a.khalti.com';
const KHALTI_LIVE_BASE = 'https://khalti.com';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private isEsewaTest() {
    return !process.env.ESEWA_PRODUCT_CODE || process.env.ESEWA_PRODUCT_CODE === 'EPAYTEST';
  }
  private isKhaltiTest() {
    return !process.env.KHALTI_SECRET_KEY || process.env.KHALTI_SECRET_KEY.startsWith('test_');
  }
  private esewaSecret() { return process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q'; }
  private esewaProductCode() { return process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST'; }
  private khaltiSecret() { return process.env.KHALTI_SECRET_KEY || 'test_secret_key_dc74e0fd57cb46cd93832aee0a390234'; }

  private async getInvoice(invoiceId: string, companyId: string) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { student: true, company: true },
    });
    if (!invoice) throw new BadRequestException('Invoice not found');
    if (invoice.status === 'PAID') throw new BadRequestException('Invoice is already paid');
    return invoice;
  }

  // ── eSewa ──────────────────────────────────────────────────────────────────

  async initiateEsewa(invoiceId: string, companyId: string, frontendBaseUrl: string) {
    const invoice = await this.getInvoice(invoiceId, companyId);
    const amount = (Number(invoice.totalAmount) - Number(invoice.paidAmount)).toFixed(2);
    const txnUuid = `EZB-${Date.now()}-${invoiceId.slice(-6)}`;
    const productCode = this.esewaProductCode();

    const signMsg = `total_amount=${amount},transaction_uuid=${txnUuid},product_code=${productCode}`;
    const signature = crypto.createHmac('sha256', this.esewaSecret()).update(signMsg).digest('base64');

    const successUrl = `${frontendBaseUrl}/portal/payment/return?gateway=esewa&invoiceId=${invoiceId}`;
    const failureUrl = `${frontendBaseUrl}/portal/payment/return?gateway=esewa&status=failed&invoiceId=${invoiceId}`;

    return {
      paymentUrl: this.isEsewaTest() ? ESEWA_TEST_URL : ESEWA_LIVE_URL,
      formFields: {
        amount,
        tax_amount: '0',
        total_amount: amount,
        transaction_uuid: txnUuid,
        product_code: productCode,
        product_service_charge: '0',
        product_delivery_charge: '0',
        success_url: successUrl,
        failure_url: failureUrl,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
        signature,
      },
      invoice: {
        id: invoice.id,
        month: invoice.month,
        amount,
        studentName: (invoice.student as any)?.name,
      },
    };
  }

  async verifyEsewa(encodedData: string, invoiceId: string, companyId: string) {
    let decoded: any;
    try {
      decoded = JSON.parse(Buffer.from(encodedData, 'base64').toString('utf-8'));
    } catch {
      throw new BadRequestException('Invalid eSewa response data');
    }

    if (decoded.status !== 'COMPLETE') throw new BadRequestException('eSewa payment was not completed');

    // Verify HMAC signature from eSewa
    const sigFields = (decoded.signed_field_names as string).split(',');
    const sigMsg = sigFields.map((f: string) => `${f}=${decoded[f]}`).join(',');
    const expected = crypto.createHmac('sha256', this.esewaSecret()).update(sigMsg).digest('base64');
    if (expected !== decoded.signature) throw new BadRequestException('eSewa signature verification failed');

    const amount = parseFloat(decoded.total_amount);
    await this.markPaid(invoiceId, companyId, amount, 'ESEWA', decoded.transaction_code);
    return { success: true, ref: decoded.transaction_code };
  }

  // ── Khalti ─────────────────────────────────────────────────────────────────

  async initiateKhalti(invoiceId: string, companyId: string, frontendBaseUrl: string) {
    const invoice = await this.getInvoice(invoiceId, companyId);
    const amountNpr = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    const amountPaisa = Math.round(amountNpr * 100);
    const base = this.isKhaltiTest() ? KHALTI_TEST_BASE : KHALTI_LIVE_BASE;

    const res = await fetch(`${base}/api/v2/epayment/initiate/`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${this.khaltiSecret()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        return_url: `${frontendBaseUrl}/portal/payment/return?gateway=khalti&invoiceId=${invoiceId}`,
        website_url: frontendBaseUrl,
        amount: amountPaisa,
        purchase_order_id: invoiceId,
        purchase_order_name: `Fee-${(invoice.student as any)?.name || 'Student'}-${invoice.month || ''}`,
        customer_info: {
          name: (invoice.student as any)?.guardianName || (invoice.student as any)?.name || 'Parent',
          phone: (invoice.student as any)?.guardianPhone || '9800000000',
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err: any = await res.json().catch(() => ({}));
      throw new BadRequestException(err?.detail || 'Khalti initiation failed');
    }

    const data: any = await res.json();
    return {
      paymentUrl: data.payment_url,
      pidx: data.pidx,
      invoice: {
        id: invoice.id,
        month: invoice.month,
        amount: amountNpr,
        studentName: (invoice.student as any)?.name,
      },
    };
  }

  async verifyKhalti(pidx: string, invoiceId: string, companyId: string) {
    const base = this.isKhaltiTest() ? KHALTI_TEST_BASE : KHALTI_LIVE_BASE;

    const res = await fetch(`${base}/api/v2/epayment/lookup/`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${this.khaltiSecret()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pidx }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err: any = await res.json().catch(() => ({}));
      throw new BadRequestException(err?.detail || 'Khalti lookup failed');
    }

    const data: any = await res.json();
    if (data.status !== 'Completed') throw new BadRequestException(`Khalti payment status: ${data.status}`);

    const amount = data.total_amount / 100;
    await this.markPaid(invoiceId, companyId, amount, 'KHALTI', pidx);
    return { success: true, ref: pidx };
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private async markPaid(invoiceId: string, companyId: string, amount: number, gateway: string, ref: string) {
    const invoice = await this.prisma.feeInvoice.findFirst({ where: { id: invoiceId, companyId } });
    if (!invoice) throw new BadRequestException('Invoice not found');

    const newPaid = Number(invoice.paidAmount) + amount;
    const newStatus = newPaid >= Number(invoice.totalAmount) - 0.01 ? 'PAID' : 'PARTIAL';

    await this.prisma.feeInvoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: newPaid,
        status: newStatus,
        notes: `${gateway} ref: ${ref}`,
      },
    });
    this.logger.log(`Invoice ${invoiceId} marked ${newStatus} via ${gateway} (ref: ${ref})`);
  }
}
