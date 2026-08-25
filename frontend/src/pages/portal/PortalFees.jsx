import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { portalApi } from '@/api';
import { DollarSign, Loader2, Printer, Receipt, QrCode, FileText } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/api/client';
import { printFeeReceipt } from '@/lib/printFeeReceipt';
import { printFeeInvoice } from '@/lib/printFeeInvoice';
import { pageVariants, containerVariants, cardVariants, itemVariants } from '@/lib/portalAnimations';
import PortalFilterSelect from '@/components/portal/PortalFilterSelect';
import PortalPagination from '@/components/portal/PortalPagination';
import PortalPageHeader from '@/components/portal/PortalPageHeader';
import { useTranslation } from 'react-i18next';

const STATUS_CONFIG = {
  PAID:    { label: 'Paid',    labelKey: 'portal.paid',    color: '#10B981', bg: '#F0FDF4' },
  PARTIAL: { label: 'Partial', labelKey: 'portal.partial', color: '#F59E0B', bg: '#FFFBEB' },
  PENDING: { label: 'Pending', labelKey: 'portal.pending', color: '#F43F5E', bg: '#FFF1F2' },
  WAIVED:  { label: 'Waived',  labelKey: 'portal.waived',  color: '#94A3B8', bg: '#F8FAFC' },
};
const PAGE_SIZE = 8;

function resolveFileUrl(url = '') {
  return url.startsWith('http') ? url : `${apiClient.defaults.baseURL}${url}`;
}

export default function PortalFees() {
  const { t } = useTranslation();
  const [printingId, setPrintingId] = useState(null);
  const [printingPaymentId, setPrintingPaymentId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const { data: qrCodes = [] } = useQuery({
    queryKey: ['portal-payment-qr-codes'],
    queryFn: () => portalApi.paymentQrCodes().then(r => r.data),
  });

  const { data: fees = [], isLoading } = useQuery({
    queryKey: ['portal-fees'],
    queryFn: () => portalApi.fees().then(r => r.data),
  });

  const totalDue = fees.reduce((s, f) => s + Math.max(0, Number(f.totalAmount) - Number(f.paidAmount)), 0);
  const fmtAmt = (n) => `Rs. ${Number(n).toLocaleString('en-NP', { minimumFractionDigits: 2 })}`;

  const filtered = useMemo(
    () => status === 'all' ? fees : fees.filter(f => f.status === status),
    [fees, status],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const setStatusFiltered = (v) => { setStatus(v); setPage(1); };

  async function viewInvoice(invoiceId) {
    setViewingId(invoiceId);
    try {
      const res = await portalApi.feeReceipt(invoiceId);
      printFeeInvoice(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.message || t('portal.couldNotLoadInvoice', { defaultValue: 'Could not load invoice' }));
    } finally {
      setViewingId(null);
    }
  }

  async function printReceipt(invoiceId) {
    setPrintingId(invoiceId);
    try {
      const res = await portalApi.feeReceipt(invoiceId);
      printFeeReceipt(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.message || t('portal.couldNotLoadReceipt', { defaultValue: 'Could not load receipt' }));
    } finally {
      setPrintingId(null);
    }
  }

  async function printOnePaymentReceipt(invoiceId, paymentId) {
    setPrintingPaymentId(paymentId);
    try {
      const res = await portalApi.feeReceipt(invoiceId);
      const payment = res.data.payments.find(p => p.id === paymentId);
      printFeeReceipt(res.data, payment);
    } catch (e) {
      toast.error(e?.response?.data?.message || t('portal.couldNotLoadReceipt', { defaultValue: 'Could not load receipt' }));
    } finally {
      setPrintingPaymentId(null);
    }
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="p-5 md:p-7 space-y-5 max-w-7xl mx-auto">
      <PortalPageHeader
        icon={DollarSign}
        title={t('portal.feeInvoices', { defaultValue: 'Fee Invoices' })}
        action={fees.length > 0 && (
          <PortalFilterSelect value={status} onChange={setStatusFiltered} options={[
            { value: 'all', label: t('portal.allStatuses', { defaultValue: 'All' }) },
            { value: 'PENDING', label: t('portal.pending', { defaultValue: 'Pending' }) },
            { value: 'PARTIAL', label: t('portal.partial', { defaultValue: 'Partial' }) },
            { value: 'PAID', label: t('portal.paid', { defaultValue: 'Paid' }) },
          ]} />
        )}
      />

      {fees.length > 0 && (
        <motion.div variants={containerVariants} initial="initial" animate="animate" className="grid grid-cols-3 md:max-w-xl gap-3">
          {[
            { label: t('portal.totalInvoices', { defaultValue: 'Total Invoices' }), value: fees.length,                                  color: '#64748B', bg: '#F8FAFC' },
            { label: t('portal.paid', { defaultValue: 'Paid' }),                    value: fees.filter(f => f.status === 'PAID').length, color: '#10B981', bg: '#F0FDF4' },
            { label: t('portal.due', { defaultValue: 'Due' }),                      value: fmtAmt(totalDue),                             color: '#F59E0B', bg: '#FFFBEB' },
          ].map(s => (
            <motion.div key={s.label} variants={cardVariants} className="rounded-2xl p-4 border" style={{ background: s.bg, borderColor: s.color + '30' }}>
              <p className="text-xl font-bold truncate" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {qrCodes.length > 0 && totalDue > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-blue-500" />
              {t('portal.scanToPay', { defaultValue: 'Scan to Pay' })}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {t('portal.scanToPayHint', { defaultValue: 'Open your bank or wallet app, scan a code below, and pay directly to the school.' })}
            </p>
          </div>
          <div className="p-5 flex flex-wrap gap-5">
            {qrCodes.map(q => (
              <div key={q.id} className="flex flex-col items-center gap-2">
                <img
                  src={resolveFileUrl(q.qrCodeUrl)}
                  alt={`${q.bankName} QR`}
                  className="w-32 h-32 rounded-xl border border-slate-200 object-cover"
                />
                <p className="text-xs font-medium text-slate-600">{q.bankName}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">{t('portal.loading', { defaultValue: 'Loading…' })}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <DollarSign className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">
              {fees.length === 0
                ? t('portal.noFeeInvoices', { defaultValue: 'No fee invoices yet' })
                : t('portal.noFeeInvoicesMatch', { defaultValue: 'No invoices match this filter' })}
            </p>
          </div>
        ) : (
          <>
            <motion.div key={page} variants={containerVariants} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {paged.map(f => {
                const due     = Number(f.totalAmount) - Number(f.paidAmount);
                const cfg     = STATUS_CONFIG[f.status] || { label: f.status, color: '#64748B', bg: '#F8FAFC' };

                return (
                  <motion.div key={f.id} variants={itemVariants}>
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-semibold text-slate-900">{f.month}</p>
                          {f.description && <p className="text-xs text-slate-400 mt-0.5">{f.description}</p>}
                        </div>
                        <span className="shrink-0 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
                          {cfg.labelKey ? t(cfg.labelKey, { defaultValue: cfg.label }) : cfg.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm mb-3">
                        <div>
                          <p className="text-xs text-slate-400">{t('portal.total', { defaultValue: 'Total' })}</p>
                          <p className="font-semibold text-slate-800 tabular-nums">{fmtAmt(f.totalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">{t('portal.paid', { defaultValue: 'Paid' })}</p>
                          <p className="font-semibold text-emerald-600 tabular-nums">{fmtAmt(f.paidAmount)}</p>
                        </div>
                        {due > 0 && (
                          <div>
                            <p className="text-xs text-slate-400">{t('portal.due', { defaultValue: 'Due' })}</p>
                            <p className="font-bold text-amber-600 tabular-nums">{fmtAmt(due)}</p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => viewInvoice(f.id)}
                        disabled={viewingId === f.id}
                        className="w-full h-9 mb-3 rounded-xl text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {viewingId === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                        {t('portal.viewInvoice', { defaultValue: 'View Invoice' })}
                      </button>

                      {f.payments?.length > 0 && (
                        <div className="border-t border-slate-100 pt-3 mb-3 space-y-1.5">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            {t('portal.paymentHistory', { defaultValue: 'Payment history' })}
                          </p>
                          {f.payments.map(p => (
                            <div key={p.id} className="flex items-center justify-between text-xs">
                              <span className="inline-flex items-center gap-1.5 text-slate-500">
                                <Receipt className="w-3 h-3 text-emerald-600" />
                                <span className="font-mono">{p.receiptNo}</span>
                                <span>· {p.method} · {new Date(p.paidAt).toLocaleDateString('en-NP', { day: 'numeric', month: 'short' })}</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="tabular-nums text-emerald-700 font-medium">{fmtAmt(p.amount)}</span>
                                <button
                                  onClick={() => printOnePaymentReceipt(f.id, p.id)}
                                  disabled={printingPaymentId === p.id}
                                  title={t('portal.printThisReceipt', { defaultValue: 'Print this receipt' })}
                                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                                >
                                  {printingPaymentId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
                                </button>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {due > 0 && (
                        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                          {t('portal.payViaQrHint', { defaultValue: 'Scan a QR above with your bank/wallet app to pay. The school will confirm your payment once received.' })}
                        </p>
                      )}

                      {f.paidAmount > 0 && (
                        <div className="pt-3 border-t border-slate-100 mt-3">
                          <button
                            onClick={() => printReceipt(f.id)}
                            disabled={printingId === f.id}
                            className="w-full h-9 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            {printingId === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
                            {t('portal.printReceipt', { defaultValue: 'Print Receipt' })}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
            <PortalPagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>
    </motion.div>
  );
}
