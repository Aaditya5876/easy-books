import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { feesApi } from '@/api';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle, XCircle, ImageOff, Clock } from 'lucide-react';
import { toast } from 'sonner';

function resolveFileUrl(url = '') {
  return url.startsWith('http') ? url : `${apiClient.defaults.baseURL}${url}`;
}

function RejectDialog({ proof, onClose }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const reject = useMutation({
    mutationFn: () => feesApi.rejectProof(proof.id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-payments-pending'] });
      toast.success(t('fees.proofRejected', { defaultValue: 'Payment proof rejected' }));
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('fees.failedToReject', { defaultValue: 'Failed to reject' })),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('fees.rejectProof', { defaultValue: 'Reject Payment Proof' })}</DialogTitle></DialogHeader>
        <textarea
          className="w-full min-h-24 border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={t('fees.rejectionReasonPlaceholder', { defaultValue: 'Why is this being rejected? (shown to the student)' })}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('fees.cancel', { defaultValue: 'Cancel' })}</Button>
          <Button variant="destructive" disabled={!reason.trim() || reject.isPending} onClick={() => reject.mutate()}>
            {reject.isPending ? t('fees.rejecting', { defaultValue: 'Rejecting…' }) : t('fees.rejectProof', { defaultValue: 'Reject Payment Proof' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PendingProofsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState(null);
  const [lightbox, setLightbox] = useState('');

  const { data: proofs = [], isLoading } = useQuery({
    queryKey: ['fee-payments-pending'],
    queryFn: () => feesApi.listPendingProofs().then(r => r.data),
  });

  const confirm = useMutation({
    mutationFn: (id) => feesApi.confirmProof(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['fee-payments-pending'] });
      qc.invalidateQueries({ queryKey: ['fee-invoices'] });
      qc.invalidateQueries({ queryKey: ['school-dashboard'] });
      const receiptNo = res?.data?.receiptNo;
      toast.success(receiptNo
        ? t('fees.paymentRecordedReceipt', { defaultValue: 'Payment recorded — Receipt {{receiptNo}}', receiptNo })
        : t('fees.paymentRecorded', { defaultValue: 'Payment recorded' }));
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('fees.failedToConfirm', { defaultValue: 'Failed to confirm payment' })),
  });

  const fmtAmt = (n) => `Rs. ${Number(n).toLocaleString('en-NP', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="text-center text-muted-foreground text-sm py-12">{t('fees.loading', { defaultValue: 'Loading…' })}</div>
      ) : proofs.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t('fees.noPendingProofs', { defaultValue: 'No payment proofs awaiting review' })}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {proofs.map((p) => (
            <div key={p.id} className="border rounded-lg p-4 bg-background space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{p.invoice?.student?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.invoice?.month} · {t('fees.rollNo', { defaultValue: 'Roll' })} {p.invoice?.student?.rollNumber ?? '—'}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(p.createdAt).toLocaleDateString('en-NP', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t('fees.claimedAmount', { defaultValue: 'Claimed' })}</p>
                  <p className="font-semibold tabular-nums">{fmtAmt(p.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('fees.paymentMethod', { defaultValue: 'Method' })}</p>
                  <p className="font-medium">{p.method}{p.bankAccount?.bankName ? ` · ${p.bankAccount.bankName}` : ''}</p>
                </div>
              </div>

              {p.notes && <p className="text-xs text-muted-foreground italic">"{p.notes}"</p>}

              {p.proofScreenshotUrl ? (
                <img
                  src={resolveFileUrl(p.proofScreenshotUrl)}
                  alt="Payment screenshot"
                  onClick={() => setLightbox(resolveFileUrl(p.proofScreenshotUrl))}
                  className="w-full h-40 object-cover rounded-md border cursor-zoom-in hover:opacity-90 transition-opacity"
                />
              ) : (
                <div className="w-full h-40 rounded-md border flex items-center justify-center text-muted-foreground/50">
                  <ImageOff className="w-6 h-6" />
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button size="sm" className="flex-1" disabled={confirm.isPending} onClick={() => confirm.mutate(p.id)}>
                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> {t('fees.approve', { defaultValue: 'Approve' })}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-red-600 hover:text-red-700" onClick={() => setRejectTarget(p)}>
                  <XCircle className="w-3.5 h-3.5 mr-1.5" /> {t('fees.reject', { defaultValue: 'Reject' })}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectTarget && <RejectDialog proof={rejectTarget} onClose={() => setRejectTarget(null)} />}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={() => setLightbox('')}>
          <img src={lightbox} alt="Payment screenshot" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
