import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { portalApi } from '@/api';
import { DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { pageVariants, containerVariants, cardVariants, itemVariants } from '@/lib/portalAnimations';

const STATUS_CONFIG = {
  PAID:    { label: 'Paid',    color: '#10B981', bg: '#F0FDF4' },
  PARTIAL: { label: 'Partial', color: '#F59E0B', bg: '#FFFBEB' },
  PENDING: { label: 'Pending', color: '#F43F5E', bg: '#FFF1F2' },
  WAIVED:  { label: 'Waived',  color: '#94A3B8', bg: '#F8FAFC' },
};

function submitEsewaForm(paymentUrl, formFields) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = paymentUrl;
  Object.entries(formFields).forEach(([k, v]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = k;
    input.value = v;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

export default function PortalFees() {
  const [payingId, setPayingId] = useState(null);

  const { data: fees = [], isLoading } = useQuery({
    queryKey: ['portal-fees'],
    queryFn: () => portalApi.fees().then(r => r.data),
  });

  const totalDue = fees.reduce((s, f) => s + Math.max(0, Number(f.totalAmount) - Number(f.paidAmount)), 0);
  const fmtAmt = (n) => `Rs. ${Number(n).toLocaleString('en-NP', { minimumFractionDigits: 2 })}`;

  async function payWithEsewa(invoiceId) {
    setPayingId(`${invoiceId}-esewa`);
    try {
      const res = await portalApi.initiateEsewa(invoiceId);
      submitEsewaForm(res.data.paymentUrl, res.data.formFields);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not initiate eSewa payment');
      setPayingId(null);
    }
  }

  async function payWithKhalti(invoiceId) {
    setPayingId(`${invoiceId}-khalti`);
    try {
      const res = await portalApi.initiateKhalti(invoiceId);
      window.location.href = res.data.paymentUrl;
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not initiate Khalti payment');
      setPayingId(null);
    }
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="p-5 md:p-7 space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Fee Invoices</h1>

      {fees.length > 0 && (
        <motion.div variants={containerVariants} initial="initial" animate="animate" className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Invoices', value: fees.length,                                           color: '#64748B', bg: '#F8FAFC' },
            { label: 'Paid',           value: fees.filter(f => f.status === 'PAID').length,          color: '#10B981', bg: '#F0FDF4' },
            { label: 'Due',            value: fmtAmt(totalDue),                                      color: '#F59E0B', bg: '#FFFBEB' },
          ].map(s => (
            <motion.div key={s.label} variants={cardVariants} className="rounded-2xl p-4 border" style={{ background: s.bg, borderColor: s.color + '30' }}>
              <p className="text-xl font-bold truncate" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">Loading…</div>
        ) : fees.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <DollarSign className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No fee invoices yet</p>
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="initial" animate="animate" className="space-y-3">
            {fees.map(f => {
              const due     = Number(f.totalAmount) - Number(f.paidAmount);
              const payable = f.status === 'PENDING' || f.status === 'PARTIAL';
              const cfg     = STATUS_CONFIG[f.status] || { label: f.status, color: '#64748B', bg: '#F8FAFC' };

              return (
                <motion.div key={f.id} variants={itemVariants}>
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-semibold text-slate-900">{f.month}</p>
                        {f.description && <p className="text-xs text-slate-400 mt-0.5">{f.description}</p>}
                      </div>
                      <span className="shrink-0 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm mb-3">
                      <div>
                        <p className="text-xs text-slate-400">Total</p>
                        <p className="font-semibold text-slate-800 tabular-nums">{fmtAmt(f.totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Paid</p>
                        <p className="font-semibold text-emerald-600 tabular-nums">{fmtAmt(f.paidAmount)}</p>
                      </div>
                      {due > 0 && (
                        <div>
                          <p className="text-xs text-slate-400">Due</p>
                          <p className="font-bold text-amber-600 tabular-nums">{fmtAmt(due)}</p>
                        </div>
                      )}
                    </div>

                    {payable && (
                      <div className="flex gap-2 pt-3 border-t border-slate-100">
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={() => payWithEsewa(f.id)}
                          disabled={!!payingId}
                          className="flex-1 h-10 rounded-xl text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                          style={{ background: '#60BB46' }}
                        >
                          {payingId === `${f.id}-esewa` && <Loader2 className="w-3 h-3 animate-spin" />}
                          Pay with eSewa
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={() => payWithKhalti(f.id)}
                          disabled={!!payingId}
                          className="flex-1 h-10 rounded-xl text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                          style={{ background: '#5C2D91' }}
                        >
                          {payingId === `${f.id}-khalti` && <Loader2 className="w-3 h-3 animate-spin" />}
                          Pay with Khalti
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
