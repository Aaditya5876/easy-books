import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { purchaseApi, salesApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SmartNumberInput } from '@/components/ui/smart-number-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import { useIdempotencyKey } from '@/lib/useIdempotencyKey';
import { PAYMENT_METHODS, apiErrorMessage, billDue, round2, validatePayment } from '@/lib/bills';
import BillStatusBadge from './BillStatusBadge';
import { paymentMethodLabel, payErrorText } from './PayNowSection';

const localToday = () => new Date().toLocaleDateString('en-CA');
const asRow = (b) => ({ total_amount: b?.totalAmount, paid_amount: b?.paidAmount, status: b?.status });

// Opened from a Purchase / Sales row: the bill's Total / Paid / Due, every
// payment made so far, and (while something is due) a form to record the next
// one. kind: 'purchase' (Record Payment — we pay) | 'sales' (Receive Payment).
export default function BillPaymentDialog({ kind, billId, open, onOpenChange, onSaved, canPay }) {
  const { t } = useTranslation();
  const isSale = kind === 'sales';
  const api = isSale ? salesApi : purchaseApi;
  const saveKey = useIdempotencyKey();
  const [bill, setBill] = useState(null);
  const [form, setForm] = useState({ amount: '', method: 'CASH', date: localToday(), reference: '' });
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  async function load() {
    const res = await api.get(billId);
    setBill(res.data);
    return res.data;
  }

  useEffect(() => {
    if (!open || !billId) return;
    setBill(null);
    setTouched(false);
    load()
      .then((b) => setForm({ amount: String(billDue(asRow(b)) || ''), method: 'CASH', date: localToday(), reference: '' }))
      .catch((err) => toast.error(apiErrorMessage(err, t('bills.loadFailed', { defaultValue: 'Could not load this bill' }))));
  }, [open, billId]);

  const due = bill ? billDue(asRow(bill)) : 0;
  const error = validatePayment(form, due);
  const payments = [...(bill?.payments || [])].sort((a, b) => String(a.dateAd).localeCompare(String(b.dateAd)) || String(a.createdAt).localeCompare(String(b.createdAt)));

  async function save() {
    setTouched(true);
    if (error) return;
    setSaving(true);
    try {
      await api.recordPayment(billId, {
        amount: round2(form.amount),
        paymentMethod: form.method,
        dateAd: form.date,
        ...(form.reference.trim() ? { referenceNumber: form.reference.trim() } : {}),
      }, { idempotencyKey: saveKey.key });
      saveKey.renew();
      toast.success(isSale ? t('bills.receivedToast', { defaultValue: 'Payment received' }) : t('bills.paidToast', { defaultValue: 'Payment recorded' }));
      const fresh = await load();
      setTouched(false);
      setForm((f) => ({ ...f, amount: String(billDue(asRow(fresh)) || ''), reference: '' }));
      onSaved?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('bills.saveFailed', { defaultValue: 'Could not save the payment' })));
    } finally {
      setSaving(false);
    }
  }

  const number = bill ? (isSale ? bill.invoiceNumber : bill.orderNumber) : '';
  const party = bill ? (isSale ? bill.clientName : bill.vendorName) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isSale ? t('bills.receivePayment', { defaultValue: 'Receive Payment' }) : t('bills.recordPayment', { defaultValue: 'Record Payment' })}
          </DialogTitle>
          {bill && <p className="text-sm text-muted-foreground">{number} · {party}</p>}
        </DialogHeader>

        {!bill ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{t('bills.loading', { defaultValue: 'Loading…' })}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                [t('bills.total', { defaultValue: 'Total' }), Number(bill.totalAmount)],
                [t('bills.colPaid', { defaultValue: 'Paid' }), Number(bill.paidAmount)],
                [t('bills.colDue', { defaultValue: 'Due' }), due],
              ].map(([label, amount], i) => (
                <div key={label} className="rounded-md border p-2">
                  <div className="text-[11px] text-muted-foreground">{label}</div>
                  <div className={`font-mono text-sm font-semibold ${i === 2 && amount > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>NPR {round2(amount).toLocaleString()}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-end"><BillStatusBadge bill={asRow(bill)} /></div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{t('bills.paymentHistory', { defaultValue: 'Payment history' })}</p>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('bills.noPayments', { defaultValue: 'No payments yet.' })}</p>
              ) : (
                <div className="rounded-md border divide-y text-sm">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span className="text-xs">
                        {formatDate(p.dateAd)}{p.dateBs ? <span className="text-muted-foreground"> · {p.dateBs}</span> : null}
                      </span>
                      <span className="text-xs text-muted-foreground flex-1 truncate">
                        {paymentMethodLabel(t, p.paymentMethod)}{p.referenceNumber ? ` · ${p.referenceNumber}` : ''}
                      </span>
                      <span className="font-mono">NPR {Number(p.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {due > 0 && canPay ? (
              <div className="rounded-lg border bg-secondary/40 p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">{t('bills.amount', { defaultValue: 'Amount' })}</Label>
                    <SmartNumberInput className="h-8 text-sm" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">{t('bills.date', { defaultValue: 'Date' })}</Label>
                    <Input type="date" className="h-8 text-sm" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">{isSale ? t('bills.receivedBy', { defaultValue: 'Received by' }) : t('bills.paidBy', { defaultValue: 'Paid by' })}</Label>
                    <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{paymentMethodLabel(t, m)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{t('bills.reference', { defaultValue: 'Reference no.' })}</Label>
                    <Input className="h-8 text-sm" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder={t('bills.referencePlaceholder', { defaultValue: 'Cheque / transaction no.' })} />
                  </div>
                </div>
                {touched && error && <p className="text-xs text-destructive">{payErrorText(t, error, { forDue: true })}</p>}
              </div>
            ) : due <= 0 ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{t('bills.fullyPaid', { defaultValue: 'This bill is fully paid.' })}</p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('bills.close', { defaultValue: 'Close' })}</Button>
          {bill && due > 0 && canPay && (
            <Button onClick={save} disabled={saving}>
              {saving ? t('bills.saving', { defaultValue: 'Saving…' }) : t('bills.savePayment', { defaultValue: 'Save Payment' })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
