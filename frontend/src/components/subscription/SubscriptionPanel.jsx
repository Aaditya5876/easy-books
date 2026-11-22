import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Users, Receipt, Send, Sparkles, AlertTriangle, Lock } from 'lucide-react';
import { PLAN_TIERS, BILLING_PERIODS, trialDaysGivenUp } from '@easy-books/shared';
import { subscriptionApi, companyApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { apiErrorMessage } from '@/lib/bills';
import { defaultAmount, formatNpr, formatDate, planState } from '@/lib/subscription';
import { PlanBadge, DaysLeft, PriceTable, PaymentHistory, useLabels } from './PlanParts';

const selectClass = 'w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';

// Settings → Subscription (company ADMIN): which plan the company is on, when
// it runs out, how many logins it allows, the prices, what has been paid —
// and a way to ask GeoInfosys for a renewal or a different plan.
export default function SubscriptionPanel({ companyId }) {
  const { t, tier, period, line } = useLabels();
  const { data: sub, isLoading, isError, refetch } = useQuery({
    queryKey: ['subscription', companyId],
    queryFn: () => subscriptionApi.get(companyId).then((r) => r.data),
    enabled: !!companyId,
  });
  const [wish, setWish] = useState({ planTier: 'STANDARD', period: 'YEARLY' });
  const [sending, setSending] = useState(false);
  // Cheaper plan during the free Premium trial: first a warning ('warn'),
  // then the admin's password ('password'). The server checks it again.
  const [confirmStep, setConfirmStep] = useState(null);
  const [password, setPassword] = useState('');

  // Start on the plan they are using now (the trial is Premium) — they change
  // it only if they want a different one.
  useEffect(() => {
    if (sub?.planTier) setWish((w) => ({ ...w, planTier: sub.planTier }));
  }, [sub?.planTier]);

  if (isLoading) return <div className="py-10 text-center text-sm text-muted-foreground">{t('subscription.loading', { defaultValue: 'Loading…' })}</div>;
  if (isError || !sub) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground space-y-2">
        <p>{t('subscription.loadFailed', { defaultValue: 'Could not load your plan.' })}</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>{t('subscription.retry', { defaultValue: 'Try again' })}</Button>
      </div>
    );
  }

  const { status } = planState(sub);
  const bought = sub.planStatus === 'ACTIVE';
  // Before the first purchase the only option is the installation (1 year).
  const mode = bought ? 'RENEW' : 'ACTIVATE';
  const price = defaultAmount(sub.prices, wish.planTier, mode, wish.period);

  const daysGivenUp = trialDaysGivenUp(sub, wish.planTier);

  function closeConfirm() {
    setConfirmStep(null);
    setPassword('');
  }

  async function sendRequest(pwd) {
    setSending(true);
    try {
      const body = bought ? { ...wish } : { planTier: wish.planTier };
      if (pwd) body.password = pwd;
      await companyApi.requestRenewal(companyId, body);
      closeConfirm();
      toast.success(t('subscription.requestSent', { defaultValue: 'Request sent — GeoInfosys will contact you to complete the payment.' }));
      refetch();
    } catch (err) {
      // Wrong password: stay on the password step so they can try again.
      if (pwd) setPassword('');
      toast.error(apiErrorMessage(err, t('subscription.requestFailed', { defaultValue: 'Could not send the request' })));
    } finally {
      setSending(false);
    }
  }

  function onRequestClick() {
    if (daysGivenUp > 0) setConfirmStep('warn');
    else sendRequest();
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Current plan */}
      <div className="bg-card rounded-xl border p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{line(sub.productLine)}</p>
            <h3 className="text-lg font-semibold flex items-center gap-2 mt-0.5">
              {status === 'LEGACY'
                ? t('subscription.yourPlan', { defaultValue: 'Your plan' })
                : t('subscription.tierPlan', { tier: tier(sub.planTier), defaultValue: '{{tier}} plan' })}
              <PlanBadge sub={sub} />
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={CalendarClock} label={t('subscription.started', { defaultValue: 'Started' })} value={formatDate(sub.subscriptionStartedAt)} />
          <Stat icon={CalendarClock} label={sub.planStatus === 'TRIAL' ? t('subscription.trialEnds', { defaultValue: 'Trial ends' }) : t('subscription.expiresOn', { defaultValue: 'Expires on' })} value={formatDate(sub.subscriptionExpiresAt)} />
          <Stat icon={CalendarClock} label={t('subscription.timeLeft', { defaultValue: 'Time left' })} value={<DaysLeft sub={sub} />} />
          <Stat
            icon={Users}
            label={t('subscription.logins', { defaultValue: 'App logins' })}
            value={sub.users.max == null
              ? t('subscription.loginsUnlimited', { n: sub.users.active, defaultValue: '{{n}} (no limit)' })
              : t('subscription.loginsOfMax', { n: sub.users.active, max: sub.users.max, defaultValue: '{{n}} of {{max}}' })}
          />
        </div>

        {status === 'LEGACY' && (
          <p className="text-sm text-muted-foreground">{t('subscription.legacyHint', { defaultValue: 'Your company was set up before plans were introduced, so there is no expiry date. GeoInfosys will move you to a plan.' })}</p>
        )}
        {sub.planStatus === 'TRIAL' && !sub.isExpired && (
          <p className="text-sm rounded-lg bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200 px-3 py-2 flex gap-2">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
            {t('subscription.trialHint', { defaultValue: 'You are on a free one-month trial of Premium — every feature, any number of users. Choose a plan below before it ends; the first purchase includes a full year.' })}
          </p>
        )}
        {sub.planTier === 'BASIC' && bought && (
          <p className="text-sm text-muted-foreground">{t('subscription.basicHint', { defaultValue: 'Basic includes only the admin login. Upgrade to Standard or Premium to add users with roles (accountant, staff…).' })}</p>
        )}
        {sub.isExpired && (
          <p className="text-sm rounded-lg bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200 px-3 py-2">
            {t('subscription.expiredHint', { defaultValue: 'Your plan has run out, so the app is paused. Your data is safe — request a renewal below.' })}
          </p>
        )}
      </div>

      {/* Ask for a renewal / plan */}
      <div className="bg-card rounded-xl border p-5 space-y-3">
        <div>
          <h3 className="font-semibold flex items-center gap-1.5"><Send className="w-4 h-4 text-primary" />
            {bought ? t('subscription.renewHeading', { defaultValue: 'Renew or change plan' }) : t('subscription.buyHeading', { defaultValue: 'Choose a plan' })}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {bought
              ? t('subscription.renewSubtitle', { defaultValue: 'Renewing early adds the time on top of your current expiry — you never lose days.' })
              : t('subscription.buySubtitle', { defaultValue: 'The first purchase is always one year — the installation fee includes it. Buy during your free trial and the year starts when the trial ends, so you lose no trial days. Monthly, quarterly and half-yearly are for renewals after that first year.' })}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 items-end">
          <div className="space-y-1.5">
            <Label>{t('subscription.colPlan', { defaultValue: 'Plan' })}</Label>
            <select className={selectClass} value={wish.planTier} onChange={(e) => setWish((w) => ({ ...w, planTier: e.target.value }))}>
              {PLAN_TIERS.map((k) => <option key={k} value={k}>{tier(k)}</option>)}
            </select>
          </div>
          {bought ? (
            <div className="space-y-1.5">
              <Label>{t('subscription.period', { defaultValue: 'Period' })}</Label>
              <select className={selectClass} value={wish.period} onChange={(e) => setWish((w) => ({ ...w, period: e.target.value }))}>
                {BILLING_PERIODS.map((p) => <option key={p} value={p}>{period(p)}</option>)}
              </select>
            </div>
          ) : (
            // First purchase always covers one year — shown, but not changeable.
            <div className="space-y-1.5">
              <Label>{t('subscription.period', { defaultValue: 'Period' })}</Label>
              <select className={selectClass} value="FIRST_YEAR" disabled>
                <option value="FIRST_YEAR">{t('subscription.firstYearIncluded', { defaultValue: '1 year (included with first purchase)' })}</option>
              </select>
            </div>
          )}
          <div className="pb-2 text-sm">
            {price !== '' && <span className="font-semibold">{formatNpr(price)}</span>}
          </div>
        </div>
        {wish.planTier === 'BASIC' && sub.users.active > 1 && (
          <p className="text-xs text-amber-700">{t('subscription.basicTooMany', { n: sub.users.active, defaultValue: 'You have {{n}} active logins — Basic allows only the admin, so the others would need to be suspended.' })}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onRequestClick} disabled={sending}>
            <Send className="w-4 h-4 mr-1.5" />
            {sending ? t('subscription.sending', { defaultValue: 'Sending…' }) : t('subscription.sendRequest', { defaultValue: 'Request from GeoInfosys' })}
          </Button>
          {sub.lastRenewalRequestedAt && (
            <span className="text-xs text-muted-foreground">{t('subscription.lastRequested', { date: formatDate(sub.lastRenewalRequestedAt), defaultValue: 'Last request sent {{date}}' })}</span>
          )}
        </div>
      </div>

      <Dialog open={!!confirmStep} onOpenChange={(o) => { if (!o) closeConfirm(); }}>
        <DialogContent className="sm:max-w-md">
          {confirmStep === 'warn' ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-600" />{t('subscription.trialNotOverTitle', { defaultValue: 'Your free trial has not ended yet' })}</DialogTitle>
                <DialogDescription>
                  {t('subscription.trialNotOverBody', {
                    days: daysGivenUp, tier: tier(wish.planTier),
                    defaultValue: 'You still have {{days}} day(s) of the free Premium trial. Switching to {{tier}} ends Premium early — features and users beyond {{tier}} stop once GeoInfosys records it. Do you still want to continue?',
                  })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={closeConfirm}>{t('subscription.cancel', { defaultValue: 'Cancel' })}</Button>
                <Button onClick={() => setConfirmStep('password')}>{t('subscription.continue', { defaultValue: 'Continue' })}</Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); if (password) sendRequest(password); }}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary" />{t('subscription.confirmPasswordTitle', { defaultValue: 'Confirm with your password' })}</DialogTitle>
                <DialogDescription>
                  {t('subscription.confirmPasswordBody', { tier: tier(wish.planTier), defaultValue: 'Enter your login password to send the request for {{tier}}.' })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5 py-4">
                <Label htmlFor="sub-confirm-password">{t('subscription.password', { defaultValue: 'Password' })}</Label>
                <Input id="sub-confirm-password" type="password" autoComplete="current-password" autoFocus
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeConfirm}>{t('subscription.cancel', { defaultValue: 'Cancel' })}</Button>
                <Button type="submit" disabled={!password || sending}>
                  {sending ? t('subscription.sending', { defaultValue: 'Sending…' }) : t('subscription.confirmAndSend', { defaultValue: 'Confirm & send' })}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Prices */}
      <div className="bg-card rounded-xl border p-5 space-y-3">
        <h3 className="font-semibold">{t('subscription.pricesHeading', { line: line(sub.productLine), defaultValue: 'Plans & prices — {{line}}' })}</h3>
        <PriceTable prices={sub.prices} currentTier={bought ? sub.planTier : null} />
        <p className="text-xs text-muted-foreground">{t('subscription.pricesNote', { defaultValue: 'Prices in NPR. The first purchase includes one year.' })}</p>
      </div>

      {/* Payments */}
      <div className="bg-card rounded-xl border p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-1.5"><Receipt className="w-4 h-4 text-primary" />{t('subscription.paymentsHeading', { defaultValue: 'Payment history' })}</h3>
        <PaymentHistory payments={sub.payments} />
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Icon className="w-3 h-3" />{label}</p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  );
}
