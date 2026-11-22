import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PLAN_TIERS, BILLING_PERIODS, SUBSCRIPTION_PAYMENT_METHODS, trialDaysGivenUp } from '@easy-books/shared';
import { subscriptionApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { apiErrorMessage } from '@/lib/bills';
import { defaultAmount, projectedExpiry, formatNpr, formatDate } from '@/lib/subscription';
import { PlanBadge, DaysLeft, PaymentHistory, useLabels } from './PlanParts';

const selectClass = 'w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(new Date());

// SUPER_ADMIN, from a client's card: record the first purchase (installation
// fee → one year) or a renewal (monthly … yearly, optionally a new plan).
// The amount is filled from the price list and can be changed (discounts).
export default function ClientPlanDialog({ company, open, onOpenChange, onSaved }) {
  const { t, tier, period, method, line } = useLabels();
  const [sub, setSub] = useState(null);
  const [form, setForm] = useState(null);
  const [amountTouched, setAmountTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = () => subscriptionApi.get(company.id)
    .then((res) => {
      const s = res.data;
      setSub(s);
      setForm({
        planTier: s.planTier || 'PREMIUM', period: 'YEARLY', amount: '', paymentMethod: 'CASH',
        paidAt: today(), reference: '', note: '',
      });
      setAmountTouched(false);
    })
    // Shown in the dialog with Try again — before, a failed load (e.g. the
    // server restarting) left the dialog on "Loading…" for good.
    .catch((err) => setLoadError(apiErrorMessage(err, t('subscription.loadFailed', { defaultValue: 'Could not load the plan.' }))));

  useEffect(() => {
    if (!open || !company?.id) return;
    setSub(null);
    setLoadError('');
    load();
  }, [open, company?.id]);

  const mode = sub?.planStatus === 'ACTIVE' ? 'RENEW' : 'ACTIVATE';
  const listPrice = sub && form ? defaultAmount(sub.prices, form.planTier, mode, form.period) : '';

  // Follow the price list until the amount is typed by hand.
  useEffect(() => {
    if (form && !amountTouched) setForm((f) => ({ ...f, amount: listPrice === '' ? '' : String(listPrice) }));
  }, [listPrice, amountTouched]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    if (form.amount === '' || Number(form.amount) < 0) {
      toast.error(t('subscription.amountRequired', { defaultValue: 'Enter the amount received (0 or more).' }));
      return;
    }
    setSaving(true);
    const body = {
      planTier: form.planTier,
      amount: Number(form.amount),
      paymentMethod: form.paymentMethod,
      paidAt: form.paidAt || undefined,
      reference: form.reference.trim() || undefined,
      note: form.note.trim() || undefined,
      ...(mode === 'RENEW' ? { period: form.period } : {}),
    };
    try {
      const res = mode === 'RENEW' ? await subscriptionApi.renew(company.id, body) : await subscriptionApi.activate(company.id, body);
      toast.success(t('subscription.saved', {
        receipt: res.data.payment.receiptNumber, date: formatDate(res.data.company.subscriptionExpiresAt),
        defaultValue: 'Saved — receipt {{receipt}}. Plan runs until {{date}}.',
      }));
      onSaved?.(res.data.company);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('subscription.saveFailed', { defaultValue: 'Could not save the payment' })));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('subscription.manageTitle', { name: company?.name, defaultValue: '{{name}} — Plan' })}</DialogTitle>
          {sub && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground pt-1">
              <span>{line(sub.productLine)}</span>
              <PlanBadge sub={sub} />
              {sub.subscriptionExpiresAt && <span>{t('subscription.until', { date: formatDate(sub.subscriptionExpiresAt), defaultValue: 'until {{date}}' })}</span>}
              <DaysLeft sub={sub} />
              <span>· {sub.users.max == null
                ? t('subscription.loginsCount', { n: sub.users.active, defaultValue: '{{n}} login(s)' })
                : t('subscription.loginsOfMax', { n: sub.users.active, max: sub.users.max, defaultValue: '{{n}} of {{max}}' })}</span>
            </div>
          )}
        </DialogHeader>

        {loadError ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => { setLoadError(''); load(); }}>
              {t('subscription.tryAgain', { defaultValue: 'Try again' })}
            </Button>
          </div>
        ) : !sub || !form ? (
          <div className="py-10 text-center text-sm text-muted-foreground">{t('subscription.loading', { defaultValue: 'Loading…' })}</div>
        ) : (
          <form id="client-plan-form" onSubmit={save} className="space-y-4">
            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              {mode === 'ACTIVATE'
                ? t('subscription.activateHint', { defaultValue: 'First purchase: the installation fee, covering one year. Bought during the free trial, the year starts when the trial ends, so no trial days are lost; the plan chosen applies right away.' })
                : t('subscription.renewHint', { defaultValue: 'Renewal: added on top of the current expiry (or from today if it already ran out).' })}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('subscription.colPlan', { defaultValue: 'Plan' })}</Label>
                <select className={selectClass} value={form.planTier} onChange={set('planTier')}>
                  {PLAN_TIERS.map((k) => <option key={k} value={k}>{tier(k)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('subscription.period', { defaultValue: 'Period' })}</Label>
                {mode === 'RENEW' ? (
                  <select className={selectClass} value={form.period} onChange={set('period')}>
                    {BILLING_PERIODS.map((p) => <option key={p} value={p}>{period(p)}</option>)}
                  </select>
                ) : (
                  // First purchase always covers one year — shown, but not changeable.
                  <select className={selectClass} value="FIRST_YEAR" disabled>
                    <option value="FIRST_YEAR">{t('subscription.firstYearIncluded', { defaultValue: '1 year (included with first purchase)' })}</option>
                  </select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{t('subscription.amountReceived', { defaultValue: 'Amount received (Rs)' })}</Label>
                <Input type="number" min="0" step="0.01" required value={form.amount}
                  onChange={(e) => { setAmountTouched(true); set('amount')(e); }} />
                {listPrice !== '' && (
                  <p className="text-xs text-muted-foreground">
                    {t('subscription.listPrice', { price: formatNpr(listPrice), defaultValue: 'Price list: {{price}}' })}
                    {amountTouched && Number(form.amount) !== Number(listPrice) && (
                      <button type="button" className="ml-2 underline" onClick={() => setAmountTouched(false)}>{t('subscription.useListPrice', { defaultValue: 'use it' })}</button>
                    )}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{t('subscription.paymentMethod', { defaultValue: 'Paid by' })}</Label>
                <select className={selectClass} value={form.paymentMethod} onChange={set('paymentMethod')}>
                  {SUBSCRIPTION_PAYMENT_METHODS.map((m) => <option key={m} value={m}>{method(m)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('subscription.paidOn', { defaultValue: 'Paid on' })}</Label>
                <Input type="date" value={form.paidAt} max={today()} onChange={set('paidAt')} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('subscription.reference', { defaultValue: 'Reference (optional)' })}</Label>
                <Input value={form.reference} maxLength={100} placeholder={t('subscription.referencePlaceholder', { defaultValue: 'Transaction / cheque no.' })} onChange={set('reference')} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t('subscription.note', { defaultValue: 'Note (optional)' })}</Label>
                <Input value={form.note} maxLength={500} placeholder={t('subscription.notePlaceholder', { defaultValue: 'e.g. Dashain discount' })} onChange={set('note')} />
              </div>
            </div>

            <p className="text-sm">
              {t('subscription.willRunUntil', {
                date: formatDate(projectedExpiry({
                  mode, period: form.period, currentExpiry: sub.subscriptionExpiresAt,
                  trialEndsAt: sub.planStatus === 'TRIAL' ? sub.trialEndsAt : null,
                })),
                defaultValue: 'After saving, the plan runs until {{date}}.',
              })}
            </p>
            {form.planTier === 'BASIC' && sub.users.active > 1 && (
              <p className="text-xs text-amber-700">{t('subscription.basicTooManyAdmin', { n: sub.users.active, defaultValue: 'This company has {{n}} active logins — Basic allows only the admin. Ask them to suspend the others first.' })}</p>
            )}
            {/* Warning only — the client already confirmed with their password when asking. */}
            {trialDaysGivenUp(sub, form.planTier) > 0 && (
              <p className="text-xs text-amber-700">{t('subscription.trialEndsEarlyAdmin', {
                days: trialDaysGivenUp(sub, form.planTier), tier: tier(form.planTier),
                defaultValue: 'This company still has {{days}} day(s) of the free Premium trial — recording {{tier}} ends Premium now. Their paid year still starts when the trial would have ended.',
              })}</p>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">{t('subscription.paymentsHeading', { defaultValue: 'Payment history' })}</h4>
              <PaymentHistory payments={sub.payments} />
            </div>
          </form>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('subscription.close', { defaultValue: 'Close' })}</Button>
          <Button type="submit" form="client-plan-form" disabled={saving || !form}>
            {saving
              ? t('subscription.saving', { defaultValue: 'Saving…' })
              : mode === 'ACTIVATE'
                ? t('subscription.recordFirstPurchase', { defaultValue: 'Record first purchase' })
                : t('subscription.recordRenewal', { defaultValue: 'Record renewal' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
