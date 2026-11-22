import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { PRODUCT_LINES, BILLING_PERIODS } from '@easy-books/shared';
import { subscriptionApi } from '@/api';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/lib/bills';
import { useLabels } from './PlanParts';

const FIELDS = ['installationFee', 'monthly', 'quarterly', 'halfYearly', 'yearly'];
const PERIOD_FIELD = { MONTHLY: 'monthly', QUARTERLY: 'quarterly', HALF_YEARLY: 'halfYearly', YEARLY: 'yearly' };

// Settings → Pricing (SUPER_ADMIN): the price sheet, editable. New purchases
// and renewals use these amounts; receipts already issued keep theirs.
export default function PriceListEditor() {
  const { t, tier, period, line } = useLabels();
  const [rows, setRows] = useState(null);
  const [edits, setEdits] = useState({}); // { [id]: { field: string } }
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    subscriptionApi.prices()
      .then((res) => setRows(res.data))
      .catch((err) => toast.error(apiErrorMessage(err, t('subscription.pricesLoadFailed', { defaultValue: 'Could not load the price list' }))));
  }, []);

  const value = (r, f) => edits[r.id]?.[f] ?? String(r[f]);
  const dirty = (r) => !!edits[r.id] && FIELDS.some((f) => edits[r.id][f] !== undefined && Number(edits[r.id][f]) !== Number(r[f]));

  async function save(r) {
    const body = Object.fromEntries(FIELDS.map((f) => [f, Number(value(r, f))]));
    if (FIELDS.some((f) => value(r, f) === '' || !(body[f] >= 0))) {
      toast.error(t('subscription.priceInvalid', { defaultValue: 'Every price must be a number, 0 or more.' }));
      return;
    }
    setSavingId(r.id);
    try {
      const res = await subscriptionApi.updatePrice(r.id, body);
      setRows((list) => list.map((x) => (x.id === r.id ? res.data : x)));
      setEdits((e) => { const n = { ...e }; delete n[r.id]; return n; });
      toast.success(t('subscription.priceSaved', { line: line(r.productLine), tier: tier(r.tier), defaultValue: '{{line}} — {{tier}} saved' }));
    } catch (err) {
      toast.error(apiErrorMessage(err, t('subscription.priceSaveFailed', { defaultValue: 'Could not save the price' })));
    } finally {
      setSavingId(null);
    }
  }

  if (!rows) return <div className="py-10 text-center text-sm text-muted-foreground">{t('subscription.loading', { defaultValue: 'Loading…' })}</div>;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground max-w-3xl">
        {t('subscription.pricingIntro', { defaultValue: 'Prices in NPR. The first purchase (installation) includes one year; after that clients renew monthly, quarterly, half-yearly or yearly. Changes apply to new payments only — receipts already issued keep their amounts.' })}
      </p>
      {PRODUCT_LINES.map((pl) => {
        const lineRows = rows.filter((r) => r.productLine === pl);
        if (!lineRows.length) return null;
        return (
          <div key={pl} className="bg-card rounded-xl border p-4 space-y-2">
            <h3 className="font-semibold">{line(pl)}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">{t('subscription.colPlan', { defaultValue: 'Plan' })}</th>
                    <th className="px-2 py-1.5 text-left font-medium">{t('subscription.colFirstPurchase', { defaultValue: 'First purchase (1 year)' })}</th>
                    {BILLING_PERIODS.map((p) => <th key={p} className="px-2 py-1.5 text-left font-medium">{period(p)}</th>)}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lineRows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-1.5 font-medium whitespace-nowrap">{tier(r.tier)}</td>
                      {['installationFee', ...BILLING_PERIODS.map((p) => PERIOD_FIELD[p])].map((f) => (
                        <td key={f} className="px-2 py-1.5">
                          <input
                            type="number" min="0" step="1"
                            aria-label={`${line(pl)} ${tier(r.tier)} ${f}`}
                            className="w-28 border rounded-md px-2 py-1 text-sm bg-background text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                            value={value(r, f)}
                            onChange={(e) => setEdits((ed) => ({ ...ed, [r.id]: { ...ed[r.id], [f]: e.target.value } }))}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right">
                        <Button size="sm" variant={dirty(r) ? 'default' : 'ghost'} disabled={!dirty(r) || savingId === r.id} onClick={() => save(r)}>
                          <Save className="w-3.5 h-3.5 mr-1" />{savingId === r.id ? t('subscription.saving', { defaultValue: 'Saving…' }) : t('subscription.save', { defaultValue: 'Save' })}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
