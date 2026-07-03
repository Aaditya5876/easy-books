import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { portalApi } from '@/api';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function PaymentReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying | success | failed

  const gateway = params.get('gateway');
  const invoiceId = params.get('invoiceId');
  const companyId = JSON.parse(localStorage.getItem('portal_student') || '{}').companyId ||
                    new URLSearchParams(window.location.search).get('companyId') || '';

  useEffect(() => {
    async function verify() {
      try {
        if (gateway === 'esewa') {
          const esewaData = params.get('data');
          const esewaStatus = params.get('status');

          if (esewaStatus === 'failed' || !esewaData) {
            setStatus('failed');
            return;
          }

          await portalApi.verifyEsewa({ data: esewaData, invoiceId, companyId });
          setStatus('success');
        } else if (gateway === 'khalti') {
          const pidx = params.get('pidx');
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-sm w-full text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-12 h-12 text-emerald-600 mx-auto mb-4 animate-spin" />
            <h1 className="text-xl font-bold text-gray-900">Verifying Payment…</h1>
            <p className="text-sm text-gray-500 mt-2">Please wait while we confirm your payment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900">Payment Successful!</h1>
            <p className="text-sm text-gray-500 mt-2">Your fee payment has been recorded.</p>
            <button
              onClick={() => navigate('/portal/fees')}
              className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              Back to Fees
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900">Payment Failed</h1>
            <p className="text-sm text-gray-500 mt-2">Your payment was not completed or could not be verified.</p>
            <button
              onClick={() => navigate('/portal/fees')}
              className="mt-6 w-full border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              Back to Fees
            </button>
          </>
        )}
      </div>
    </div>
  );
}
