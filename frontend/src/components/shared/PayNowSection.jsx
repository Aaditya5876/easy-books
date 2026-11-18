import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SmartNumberInput } from '@/components/ui/smart-number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { PAYMENT_METHODS, round2, validatePayNow } from '@/lib/bills';

export const EMPTY_PAY_NOW = { mode: 'CREDIT', method: 'CASH', amount: '', reference: '' };

export function paymentMethodLabel(t, method) {
  const fallback = { CASH: 'Cash', BANK_TRANSFER: 'Bank transfer', CHEQUE: 'Cheque', QR: 'QR / Wallet', CREDIT: 'Udharo' }[method] || method;
  return t(`bills.method${method}`, { defaultValue: fallback });
}

export function payErrorText(t, code, { forDue = false } = {}) {
  if (!code) return '';
  const texts = {
    amountRequired: t('bills.errAmountRequired', { defaultValue: 'Enter an amount more than 0' }),
    amountTooHigh: forDue
      ? t('bills.errAmountAboveDue', { defaultValue: 'Amount is more than what is due' })
      : t('bills.errAmountAboveTotal', { defaultValue: 'Amount is more than the bill total' }),
    methodRequired: t('bills.errMethodRequired', { defaultValue: 'Choose how it was paid' }),
    dateRequired: t('bills.errDateRequired', { defaultValue: 'Choose the payment date' }),
  };
  return texts[code] || '';
}

// "Payment" block next to the bill Total: Udharo / Paid in full / Part paid.
// The bill's status is never picked here — it follows from what was paid.
// kind: 'purchase' (we pay) | 'sales' (we receive).
export default function PayNowSection({ kind, value, onChange, total }) {
  const { t } = useTranslation();
  const isSale = kind === 'sales';
  const set = (patch) => onChange({ ...value, ...patch });
  const error = validatePayNow(value, total);
  const paidNow = value.mode === 'FULL' ? round2(total) : value.mode === 'PARTIAL' ? round2(value.amount) : 0;
  const stillDue = Math.max(0, round2(total - paidNow));

  const modes = [
    { key: 'CREDIT', label: t('bills.modeCredit', { defaultValue: 'Udharo' }), hint: isSale ? t('bills.modeCreditHintSale', { defaultValue: 'Collect later' }) : t('bills.modeCreditHint', { defaultValue: 'Pay later' }) },
    { key: 'FULL', label: isSale ? t('bills.modeFullSale', { defaultValue: 'Received in full' }) : t('bills.modeFull', { defaultValue: 'Paid in full' }), hint: t('bills.modeFullHint', { defaultValue: 'Settled now' }) },
    { key: 'PARTIAL', label: isSale ? t('bills.modePartialSale', { defaultValue: 'Part received' }) : t('bills.modePartial', { defaultValue: 'Part paid' }), hint: t('bills.modePartialHint', { defaultValue: 'Rest later' }) },
  ];

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('bills.payment', { defaultValue: 'Payment' })}</p>

      <div role="radiogroup" className="grid grid-cols-3 gap-2">
        {modes.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={value.mode === m.key}
            onClick={() => set({ mode: m.key })}
            className={cn(
              'rounded-md border px-2 py-2 text-left transition-colors',
              value.mode === m.key ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted',
            )}
          >
            <span className="block text-sm font-medium">{m.label}</span>
            <span className="block text-[11px] text-muted-foreground">{m.hint}</span>
          </button>
        ))}
      </div>

      {value.mode !== 'CREDIT' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">{isSale ? t('bills.receivedBy', { defaultValue: 'Received by' }) : t('bills.paidBy', { defaultValue: 'Paid by' })}</Label>
            <Select value={value.method} onValueChange={(v) => set({ method: v })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{paymentMethodLabel(t, m)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {value.mode === 'PARTIAL' ? (
            <div>
              <Label className="text-xs">{isSale ? t('bills.amountReceivedNow', { defaultValue: 'Amount received now' }) : t('bills.amountPaidNow', { defaultValue: 'Amount paid now' })}</Label>
              <SmartNumberInput className="h-8 text-sm" value={value.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0" />
            </div>
          ) : (
            <div>
              <Label className="text-xs">{t('bills.reference', { defaultValue: 'Reference no.' })} <span className="text-muted-foreground">({t('bills.optional', { defaultValue: 'optional' })})</span></Label>
              <Input className="h-8 text-sm" value={value.reference} onChange={(e) => set({ reference: e.target.value })} placeholder={t('bills.referencePlaceholder', { defaultValue: 'Cheque / transaction no.' })} />
            </div>
          )}
          {value.mode === 'PARTIAL' && (
            <div className="col-span-2">
              <Label className="text-xs">{t('bills.reference', { defaultValue: 'Reference no.' })} <span className="text-muted-foreground">({t('bills.optional', { defaultValue: 'optional' })})</span></Label>
              <Input className="h-8 text-sm" value={value.reference} onChange={(e) => set({ reference: e.target.value })} placeholder={t('bills.referencePlaceholder', { defaultValue: 'Cheque / transaction no.' })} />
            </div>
          )}
        </div>
      )}

      {error ? (
        <p className="text-xs text-destructive">{payErrorText(t, error)}</p>
      ) : (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{isSale ? t('bills.stillToCollect', { defaultValue: 'Still to collect' }) : t('bills.stillToPay', { defaultValue: 'Still to pay' })}</span>
          <span className={cn('font-mono font-semibold', stillDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
            NPR {stillDue.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
