import { Injectable, BadRequestException, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { frontendBaseUrl } from '../../../core/utils/allowed-origins';
import { SchoolFinanceService } from './school-finance.service';
import * as crypto from 'crypto';

const ESEWA_TEST_URL = 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
const ESEWA_LIVE_URL = 'https://epay.esewa.com.np/api/epay/main/v2/form';
const ESEWA_TEST_STATUS = 'https://rc.esewa.com.np/api/epay/transaction/status/';
const ESEWA_LIVE_STATUS = 'https://esewa.com.np/api/epay/transaction/status/';
const KHALTI_TEST_BASE = 'https://a.khalti.com';
const KHALTI_LIVE_BASE = 'https://khalti.com';
// eSewa's published sandbox credentials — only ever used outside production.
const ESEWA_SANDBOX = { productCode: 'EPAYTEST', secret: '8gBm/:&EnhH.1/q' };

export interface PortalPayer { companyId: string; studentId: string }

// Online fee payments. Every payment starts as a PaymentIntent recorded on our
// side; verification finds the intent by the gateway's reference, re-checks the
// result with the gateway server-to-server, and claims the intent atomically —
// so a forged, replayed or misdirected callback can never record a payment.
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: SchoolFinanceService,
  ) {}

  // ── Configuration ──────────────────────────────────────────────────────────

  private isProduction() { return process.env.NODE_ENV === 'production'; }

  private esewaConfig() {
    const productCode = process.env.ESEWA_PRODUCT_CODE;
    const secret = process.env.ESEWA_SECRET_KEY;
    if (productCode && secret) return { productCode, secret, test: productCode === ESEWA_SANDBOX.productCode };
    if (!this.isProduction()) return { ...ESEWA_SANDBOX, test: true };
    return null;
  }

  private khaltiConfig() {
    const secret = process.env.KHALTI_SECRET_KEY;
    return secret ? { secret, test: secret.startsWith('test_') } : null;
  }

  enabledGateways() {
    return { esewa: !!this.esewaConfig(), khalti: !!this.khaltiConfig() };
  }

  private returnBase(origin?: string) {
    const base = frontendBaseUrl(origin);
    if (!base) throw new BadRequestException('Online payment is not available from this site — FRONTEND_URL is not configured');
    return base;
  }

  private async payableInvoice(invoiceId: string, payer: PortalPayer) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id: invoiceId, companyId: payer.companyId, studentId: payer.studentId },
      include: { student: true },
    });
    if (!invoice || !invoice.releasedAt) throw new NotFoundException('Invoice not found');
    const due = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    if (invoice.status === 'PAID' || due <= 0) throw new BadRequestException('Invoice is already paid');
    return { invoice, due: Number(due.toFixed(2)) };
  }

  // ── eSewa ──────────────────────────────────────────────────────────────────

  async initiateEsewa(invoiceId: string, payer: PortalPayer, origin?: string) {
    const cfg = this.esewaConfig();
    if (!cfg) throw new ServiceUnavailableException('eSewa payments are not set up');
    const base = this.returnBase(origin);
    const { invoice, due } = await this.payableInvoice(invoiceId, payer);
    const amount = due.toFixed(2);
    // The invoice id is part of the signed transaction id, so eSewa's signed
    // callback itself says which invoice was paid.
    const txnUuid = `${invoiceId}-${Date.now()}`;

    await this.prisma.paymentIntent.create({
      data: { companyId: payer.companyId, invoiceId, studentId: payer.studentId, gateway: 'ESEWA', reference: txnUuid, amount: due },
    });

    const signMsg = `total_amount=${amount},transaction_uuid=${txnUuid},product_code=${cfg.productCode}`;
    const signature = crypto.createHmac('sha256', cfg.secret).update(signMsg).digest('base64');
    const returnUrl = `${base}/portal/payment/return?gateway=esewa&invoiceId=${invoiceId}`;

    return {
      paymentUrl: cfg.test ? ESEWA_TEST_URL : ESEWA_LIVE_URL,
      formFields: {
        amount,
        tax_amount: '0',
        total_amount: amount,
        transaction_uuid: txnUuid,
        product_code: cfg.productCode,
        product_service_charge: '0',
        product_delivery_charge: '0',
        success_url: returnUrl,
        failure_url: `${returnUrl}&status=failed`,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
        signature,
      },
      invoice: { id: invoice.id, month: invoice.month, amount, studentName: invoice.student?.name },
    };
  }

  async verifyEsewa(encodedData: string) {
    const cfg = this.esewaConfig();
    if (!cfg) throw new ServiceUnavailableException('eSewa payments are not set up');

    let decoded: any;
    try {
      decoded = JSON.parse(Buffer.from(String(encodedData), 'base64').toString('utf-8'));
    } catch {
      throw new BadRequestException('Invalid eSewa response data');
    }
    if (decoded?.status !== 'COMPLETE') throw new BadRequestException('eSewa payment was not completed');

    const sigFields = String(decoded.signed_field_names || '').split(',').filter(Boolean);
    const sigMsg = sigFields.map((f: string) => `${f}=${decoded[f]}`).join(',');
    const expected = crypto.createHmac('sha256', cfg.secret).update(sigMsg).digest('base64');
    if (!sigFields.includes('transaction_uuid') || expected !== decoded.signature) {
      throw new BadRequestException('eSewa signature verification failed');
    }

    const intent = await this.prisma.paymentIntent.findUnique({ where: { reference: String(decoded.transaction_uuid) } });
    if (!intent || intent.gateway !== 'ESEWA') throw new BadRequestException('Unknown eSewa transaction');
    if (intent.status === 'COMPLETED') return this.alreadyRecorded(intent);
    if (Number(decoded.total_amount) !== Number(intent.amount)) throw new BadRequestException('eSewa amount does not match the invoice');

    // Ask eSewa directly — a valid signature alone isn't proof of payment.
    const statusUrl = `${cfg.test ? ESEWA_TEST_STATUS : ESEWA_LIVE_STATUS}?product_code=${encodeURIComponent(cfg.productCode)}`
      + `&total_amount=${Number(intent.amount).toFixed(2)}&transaction_uuid=${encodeURIComponent(intent.reference)}`;
    const res = await fetch(statusUrl, { signal: AbortSignal.timeout(15000) });
    const status: any = res.ok ? await res.json().catch(() => ({})) : {};
    if (status?.status !== 'COMPLETE') throw new BadRequestException('eSewa has not confirmed this payment');

    return this.complete(intent.id, decoded.transaction_code || status.ref_id || intent.reference);
  }

  // ── Khalti ─────────────────────────────────────────────────────────────────

  async initiateKhalti(invoiceId: string, payer: PortalPayer, origin?: string) {
    const cfg = this.khaltiConfig();
    if (!cfg) throw new ServiceUnavailableException('Khalti payments are not set up');
    const base = this.returnBase(origin);
    const { invoice, due } = await this.payableInvoice(invoiceId, payer);

    const res = await fetch(`${cfg.test ? KHALTI_TEST_BASE : KHALTI_LIVE_BASE}/api/v2/epayment/initiate/`, {
      method: 'POST',
      headers: { Authorization: `Key ${cfg.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        return_url: `${base}/portal/payment/return?gateway=khalti&invoiceId=${invoiceId}`,
        website_url: base,
        amount: Math.round(due * 100),
        purchase_order_id: invoiceId,
        purchase_order_name: `Fee-${invoice.student?.name || 'Student'}-${invoice.month || ''}`,
        customer_info: {
          name: invoice.student?.guardianName || invoice.student?.name || 'Parent',
          phone: invoice.student?.guardianPhone || '9800000000',
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const err: any = await res.json().catch(() => ({}));
      throw new BadRequestException(err?.detail || 'Khalti initiation failed');
    }
    const data: any = await res.json();

    await this.prisma.paymentIntent.create({
      data: { companyId: payer.companyId, invoiceId, studentId: payer.studentId, gateway: 'KHALTI', reference: data.pidx, amount: due },
    });

    return {
      paymentUrl: data.payment_url,
      pidx: data.pidx,
      invoice: { id: invoice.id, month: invoice.month, amount: due, studentName: invoice.student?.name },
    };
  }

  async verifyKhalti(pidx: string) {
    const cfg = this.khaltiConfig();
    if (!cfg) throw new ServiceUnavailableException('Khalti payments are not set up');

    const intent = await this.prisma.paymentIntent.findUnique({ where: { reference: String(pidx) } });
    if (!intent || intent.gateway !== 'KHALTI') throw new BadRequestException('Unknown Khalti payment');
    if (intent.status === 'COMPLETED') return this.alreadyRecorded(intent);

    const res = await fetch(`${cfg.test ? KHALTI_TEST_BASE : KHALTI_LIVE_BASE}/api/v2/epayment/lookup/`, {
      method: 'POST',
      headers: { Authorization: `Key ${cfg.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pidx }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const err: any = await res.json().catch(() => ({}));
      throw new BadRequestException(err?.detail || 'Khalti lookup failed');
    }
    const data: any = await res.json();
    if (data.status !== 'Completed') throw new BadRequestException(`Khalti payment status: ${data.status}`);
    if (Number(data.total_amount) !== Math.round(Number(intent.amount) * 100)) {
      throw new BadRequestException('Khalti amount does not match the invoice');
    }

    return this.complete(intent.id, data.transaction_id || pidx);
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private alreadyRecorded(intent: { reference: string }) {
    return { success: true, ref: intent.reference, alreadyRecorded: true };
  }

  // Claims the intent before recording, so concurrent or replayed callbacks
  // can't both record the payment.
  private async complete(intentId: string, gatewayRef: string) {
    const claimed = await this.prisma.paymentIntent.updateMany({
      where: { id: intentId, status: 'PENDING' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    const intent = await this.prisma.paymentIntent.findUniqueOrThrow({ where: { id: intentId } });
    if (claimed.count === 0) return this.alreadyRecorded(intent);

    try {
      const invoice = await this.prisma.feeInvoice.findUniqueOrThrow({ where: { id: intent.invoiceId } });
      const remaining = Number(invoice.totalAmount) - Number(invoice.paidAmount);
      const payment = await this.finance.recordPayment(intent.companyId, intent.invoiceId, {
        amount: Math.min(Number(intent.amount), remaining),
        method: intent.gateway,
        notes: `${intent.gateway} ref: ${gatewayRef}`,
      });
      await this.prisma.paymentIntent.update({ where: { id: intentId }, data: { paymentId: payment.id } });
      this.logger.log(`Invoice ${intent.invoiceId} paid via ${intent.gateway} — receipt ${payment.receiptNo} (ref: ${gatewayRef})`);
      return { success: true, ref: gatewayRef, receiptNo: payment.receiptNo };
    } catch (err) {
      await this.prisma.paymentIntent.update({ where: { id: intentId }, data: { status: 'FAILED' } });
      this.logger.error(`Gateway payment ${gatewayRef} received but not applied: ${(err as Error).message}`);
      throw new BadRequestException('Payment was received but could not be applied to the invoice — please contact the school');
    }
  }
}
