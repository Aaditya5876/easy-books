import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { portalApi } from '@/api';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function CheckIcon() {
  return (
    <svg viewBox="0 0 80 80" className="w-20 h-20">
      <motion.circle
        cx="40" cy="40" r="36"
        fill="none" stroke="#10B981" strokeWidth="4"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
      <motion.path
        d="M22 40 L35 53 L58 28"
        fill="none" stroke="#10B981" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.5 }}
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 80 80" className="w-20 h-20">
      <motion.circle
        cx="40" cy="40" r="36"
        fill="none" stroke="#F43F5E" strokeWidth="4"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
      <motion.path
        d="M26 26 L54 54 M54 26 L26 54"
        fill="none" stroke="#F43F5E" strokeWidth="5" strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.5 }}
      />
    </svg>
  );
}

export default function PaymentReturn() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');

  const gateway   = searchParams.get('gateway');
  const invoiceId = searchParams.get('invoiceId');
  const companyId = JSON.parse(localStorage.getItem('portal_student') || '{}').companyId || '';

  useEffect(() => {
    async function verify() {
      try {
        if (gateway === 'esewa') {
          const data   = searchParams.get('data');
          const failed = searchParams.get('status') === 'failed';
          if (failed || !data) { setStatus('failed'); return; }
          await portalApi.verifyEsewa({ data, invoiceId, companyId });
          setStatus('success');
        } else if (gateway === 'khalti') {
          const pidx = searchParams.get('pidx');
          if (!pidx) { setStatus('failed'); return; }
          await portalApi.verifyKhalti({ pidx, invoiceId, companyId });
          setStatus('success');
        } else {
          setStatus('failed');
        }
      } catch {
        setStatus('failed');
      }
    }
    verify();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <motion.div
        className="bg-white rounded-3xl p-10 max-w-sm w-full text-center shadow-2xl"
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1,   y: 0  }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        {status === 'verifying' && (
          <>
            <Loader2 className="w-14 h-14 text-blue-500 mx-auto mb-5 animate-spin" />
            <h1 className="text-xl font-bold text-slate-900">{t('portal.verifyingPayment', { defaultValue: 'Verifying Payment…' })}</h1>
            <p className="text-sm text-slate-500 mt-2">{t('portal.verifyingWait', { defaultValue: 'Please wait, do not close this page.' })}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center mb-5">
              <CheckIcon />
            </div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
              <h1 className="text-xl font-bold text-slate-900">{t('portal.paymentSuccess', { defaultValue: 'Payment Successful!' })}</h1>
              <p className="text-sm text-slate-500 mt-2">{t('portal.paymentRecorded', { defaultValue: 'Your fee payment has been recorded.' })}</p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/portal/fees')}
                className="mt-7 w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-600/25"
              >
                {t('portal.backToFees', { defaultValue: 'Back to Fees' })}
              </motion.button>
            </motion.div>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="flex justify-center mb-5">
              <CrossIcon />
            </div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
              <h1 className="text-xl font-bold text-slate-900">{t('portal.paymentFailed', { defaultValue: 'Payment Failed' })}</h1>
              <p className="text-sm text-slate-500 mt-2">{t('portal.paymentFailedDesc', { defaultValue: 'Your payment could not be completed. Please try again.' })}</p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/portal/fees')}
                className="mt-7 w-full h-12 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
              >
                {t('portal.backToFees', { defaultValue: 'Back to Fees' })}
              </motion.button>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}
