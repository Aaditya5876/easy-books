import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Users, Receipt, Send, Sparkles } from 'lucide-react';
import { PLAN_TIERS, BILLING_PERIODS } from '@easy-books/shared';
import { subscriptionApi, companyApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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

  useEffect(() => {
    if (sub?.planStatus === 'ACTIVE' && sub.planTier) setWish((w) => ({ ...w, planTier: sub.planTier }));
  }, [sub?.planStatus, sub?.planTier]);

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

  async function sendRequest() {
    setSending(true);
    try {
      await companyApi.requestRenewal(companyId, bought ? wish : { planTier: wish.planTier });
      toast.success(t('subscription.requestSent', { defaultValue: 'Request sent — GeoInfosys will contact you to complete the payment.' }));
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('subscription.requestFailed', { defaultValue: 'Could not send the request' })));
    } finally {
      setSending(false);
    }
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
              : t('subscription.buySubtitle', { defaultValue: 'The first purchase is the installation fee and includes one year. After that you renew monthly, quarterly, half-yearly or yearly.' })}
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
            <div className="text-sm text-muted-foreground pb-2">{t('subscription.firstPurchase', { defaultValue: 'First purchase (1 year)' })}</div>
          )}
          <div className="pb-2 text-sm">
            {price !== '' && <span className="font-semibold">{formatNpr(price)}</span>}
          </div>
        </div>
        {wish.planTier === 'BASIC' && sub.users.active > 1 && (
          <p className="text-xs text-amber-700">{t('subscription.basicTooMany', { n: sub.users.active, defaultValue: 'You have {{n}} active logins — Basic allows only the admin, so the others would need to be suspended.' })}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={sendRequest} disabled={sending}>
            <Send className="w-4 h-4 mr-1.5" />
            {sending ? t('subscription.sending', { defaultValue: 'Sending…' }) : t('subscription.sendRequest', { defaultValue: 'Request from GeoInfosys' })}
          </Button>
          {sub.lastRenewalRequestedAt && (
            <span className="text-xs text-muted-foreground">{t('subscription.lastRequested', { date: formatDate(sub.lastRenewalRequestedAt), defaultValue: 'Last request sent {{date}}' })}</span>
          )}
        </div>
      </div>

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
