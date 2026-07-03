import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { portalApi } from '@/api';
import { DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_STYLE = {
  PAID:    'bg-emerald-100 text-emerald-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-red-100 text-red-700',
  WAIVED:  'bg-gray-100 text-gray-500',
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

  const totalDue = fees.reduce((s, f) => s + (Number(f.totalAmount) - Number(f.paidAmount)), 0);
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
    <div className="p-6 space-y-5 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Fee Invoices</h1>

      {fees.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-900">{fees.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Invoices</p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
            <p className="text-2xl font-bold text-emerald-700">
              {fees.filter(f => f.status === 'PAID').length}
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">Paid</p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
            <p className="text-2xl font-bold text-amber-700">{fmtAmt(totalDue)}</p>
            <p className="text-xs text-amber-600 mt-0.5">Total Due</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading…</div>
        ) : fees.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No fee invoices yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Month</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Total</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Paid</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Due</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fees.map(f => {
                const due = Number(f.totalAmount) - Number(f.paidAmount);
                const payable = f.status === 'PENDING' || f.status === 'PARTIAL';
                return (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{f.month}</p>
                      {f.description && <p className="text-xs text-gray-400 mt-0.5">{f.description}</p>}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">{fmtAmt(f.totalAmount)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-emerald-700">{fmtAmt(f.paidAmount)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-amber-700 font-medium">{fmtAmt(due)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[f.status] || 'bg-gray-100 text-gray-600'}`}>
                        {f.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {payable && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => payWithEsewa(f.id)}
                            disabled={!!payingId}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                          >
                            {payingId === `${f.id}-esewa` ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            eSewa
                          </button>
                          <button
                            onClick={() => payWithKhalti(f.id)}
                            disabled={!!payingId}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50"
                          >
                            {payingId === `${f.id}-khalti` ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            Khalti
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
