import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { portalApi } from '@/api';
import { DollarSign, Loader2, Printer, Receipt, QrCode, FileText, Upload, X, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/api/client';
import { printFeeReceipt } from '@/lib/printFeeReceipt';
import { printFeeInvoice } from '@/lib/printFeeInvoice';
import { pageVariants, containerVariants, cardVariants, itemVariants } from '@/lib/portalAnimations';
import { formatBsYearMonth } from '@/lib/nepaliDate';
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

// Uploaded files now require an authenticated request; a portal session has
// no cookie (Bearer-only, in localStorage), and a plain <img src> can't send
// an Authorization header, so the token rides along as a query param instead.
function resolveFileUrl(url = '') {
  const full = url.startsWith('http') ? url : `${apiClient.defaults.baseURL}${url}`;
  const token = localStorage.getItem('portal_token');
  if (!token) return full;
  return `${full}${full.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

const PAYMENT_STATUS_BADGE = {
  PENDING_REVIEW: { labelKey: 'portal.awaitingConfirmation', label: 'Awaiting confirmation', color: '#F59E0B', bg: '#FFFBEB', Icon: Clock },
  REJECTED:       { labelKey: 'portal.proofRejected',        label: 'Rejected',              color: '#EF4444', bg: '#FEF2F2', Icon: AlertCircle },
};

function SubmitProofDialog({ invoice, dueAmount, bankAccounts, onClose, onSubmitted }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(String(dueAmount));
  const [method, setMethod] = useState('BANK');
  const filteredAccounts = bankAccounts.filter(b => b.paymentType === method);
  const [bankAccountId, setBankAccountId] = useState(() => bankAccounts.find(b => b.paymentType === 'BANK')?.id || '');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const needsAccount = method === 'BANK' || method === 'ESEWA' || method === 'KHALTI';
  const accountLabel = method === 'ESEWA'
    ? t('portal.esewaNumber', { defaultValue: 'eSewa Number' })
    : method === 'KHALTI'
      ? t('portal.khaltiNumber', { defaultValue: 'Khalti Number' })
      : t('portal.paidToAccount', { defaultValue: 'Paid To' });

  function changeMethod(next) {
    setMethod(next);
    const firstMatch = bankAccounts.find(b => b.paymentType === next);
    setBankAccountId(firstMatch?.id || '');
  }

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit() {
    const amt = Number(amount);
    if (!(amt > 0)) return toast.error(t('portal.enterValidAmount', { defaultValue: 'Enter a valid amount' }));
    if (needsAccount && !bankAccountId) return toast.error(t('portal.selectBankAccount', { defaultValue: 'Select which account you paid to' }));
    if (!file) return toast.error(t('portal.screenshotRequired', { defaultValue: 'Please attach a screenshot of the payment' }));

    setSubmitting(true);
    try {
      const uploadRes = await portalApi.uploadProof(file);
      await portalApi.submitPaymentProof(invoice.id, {
        amount: amt,
        method,
        bankAccountId: needsAccount ? bankAccountId : undefined,
        proofScreenshotUrl: uploadRes.data.url,
        notes: notes || undefined,
      });
      toast.success(t('portal.proofSubmitted', { defaultValue: 'Payment proof submitted — awaiting confirmation' }));
      onSubmitted();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('portal.proofSubmitFailed', { defaultValue: 'Could not submit payment proof' }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            {t('portal.submitPaymentProof', { defaultValue: "I've Paid — Submit Proof" })}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3.5">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">{t('portal.amountPaid', { defaultValue: 'Amount Paid' })}</label>
            <input
              type="number" value={amount} onChange={(e) => setAmount(e.target.value)} max={dueAmount} min={0} step="0.01"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">{t('portal.paymentMethod', { defaultValue: 'Payment Method' })}</label>
            <select
              value={method} onChange={(e) => changeMethod(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="BANK">{t('portal.methodBank', { defaultValue: 'Bank Transfer' })}</option>
              <option value="ESEWA">{t('portal.methodEsewa', { defaultValue: 'eSewa' })}</option>
              <option value="KHALTI">{t('portal.methodKhalti', { defaultValue: 'Khalti' })}</option>
              <option value="CASH">{t('portal.methodCash', { defaultValue: 'Cash' })}</option>
            </select>
          </div>
          {needsAccount && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{accountLabel}</label>
              <select
                value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">{t('portal.chooseAccount', { defaultValue: 'Choose…' })}</option>
                {filteredAccounts.map(b => (
                  <option key={b.id} value={b.id}>{method === 'BANK' ? b.bankName : `${b.bankName} (${b.accountNumber})`}</option>
                ))}
              </select>
              {filteredAccounts.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  {t('portal.noAccountsOfTypeHint', { defaultValue: 'The school hasn\'t set up {{account}} yet.', account: accountLabel })}
                </p>
              )}
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">{t('portal.referenceNotes', { defaultValue: 'Reference / Notes (optional)' })}</label>
            <input
              value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">{t('portal.uploadScreenshot', { defaultValue: 'Payment Screenshot' })}</label>
            {preview ? (
              <div className="relative">
                <img src={preview} alt="Payment screenshot" className="w-full max-h-48 object-contain rounded-lg border border-slate-200" />
                <button onClick={() => { setFile(null); setPreview(''); }} className="absolute top-1.5 right-1.5 p-1 rounded-full bg-white/90 border border-slate-200 text-slate-500 hover:text-slate-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1.5 h-24 rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-500 cursor-pointer transition-colors">
                <Upload className="w-5 h-5" />
                <span className="text-xs">{t('portal.tapToUpload', { defaultValue: 'Tap to upload' })}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              </label>
            )}
          </div>
        </div>
        <div className="px-5 pb-5">
          <button
            onClick={submit} disabled={submitting}
            className="w-full h-10 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('portal.submitProof', { defaultValue: 'Submit Proof' })}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function PortalFees() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [printingId, setPrintingId] = useState(null);
  const [printingPaymentId, setPrintingPaymentId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [proofInvoice, setProofInvoice] = useState(null);

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
      printFeeInvoice(res.data, localStorage.getItem('portal_token'));
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
                          <p className="font-semibold text-slate-900">{formatBsYearMonth(f.month)}</p>
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
                          {f.payments.map(p => {
                            const badge = PAYMENT_STATUS_BADGE[p.status];
                            if (badge) {
                              return (
                                <div key={p.id} className="text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1.5" style={{ color: badge.color }}>
                                      <badge.Icon className="w-3 h-3" />
                                      <span className="font-medium">{t(badge.labelKey, { defaultValue: badge.label })}</span>
                                      <span className="text-slate-400">· {p.method} · {new Date(p.createdAt).toLocaleDateString('en-NP', { day: 'numeric', month: 'short' })}</span>
                                    </span>
                                    <span className="tabular-nums font-medium" style={{ color: badge.color }}>{fmtAmt(p.amount)}</span>
                                  </div>
                                  {p.status === 'REJECTED' && p.rejectionReason && (
                                    <p className="text-slate-400 mt-0.5 pl-5">{p.rejectionReason}</p>
                                  )}
                                </div>
                              );
                            }
                            return (
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
                            );
                          })}
                        </div>
                      )}

                      {due > 0 && (
                        <>
                          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                            {t('portal.payViaQrHint', { defaultValue: 'Scan a QR above with your bank/wallet app to pay. The school will confirm your payment once received.' })}
                          </p>
                          <button
                            onClick={() => setProofInvoice(f)}
                            className="w-full h-9 mt-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Upload className="w-3 h-3" />
                            {t('portal.submitPaymentProofShort', { defaultValue: "I've Paid — Submit Proof" })}
                          </button>
                        </>
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

      <AnimatePresence>
        {proofInvoice && (
          <SubmitProofDialog
            invoice={proofInvoice}
            dueAmount={Number(proofInvoice.totalAmount) - Number(proofInvoice.paidAmount)}
            bankAccounts={qrCodes}
            onClose={() => setProofInvoice(null)}
            onSubmitted={() => { setProofInvoice(null); queryClient.invalidateQueries({ queryKey: ['portal-fees'] }); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
