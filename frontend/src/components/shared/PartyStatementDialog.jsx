import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { clientApi, vendorApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/bills';

const TYPE_LABELS = { OPENING: 'Opening', BILL: 'Bill', PAYMENT: 'Payment', RETURN: 'Return' };
const money = (v) => (v ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

// A vendor's or client's running statement — Date, Description, Ref, Dr, Cr,
// Balance — the same layout as a hand-written party ledger. For a vendor the
// balance is what we owe them; for a client, what they owe us.
export default function PartyStatementDialog({ kind, party, open, onOpenChange }) {
  const { t } = useTranslation();
  const isVendor = kind === 'vendor';
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!open || !party?.id) return;
    setData(null);
    (isVendor ? vendorApi : clientApi).statement(party.id)
      .then((res) => setData(res.data))
      .catch((err) => toast.error(apiErrorMessage(err, t('statement.loadFailed', { defaultValue: 'Could not load the statement' }))));
  }, [open, party?.id]);

  const balanceLabel = isVendor ? t('statement.weOwe', { defaultValue: 'We owe' }) : t('statement.owesUs', { defaultValue: 'Owes us' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('statement.title', { name: party?.name, defaultValue: '{{name}} — Statement' })}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isVendor
              ? t('statement.vendorHint', { defaultValue: 'Cr = we owe more (bills). Dr = we owe less (payments, returns).' })
              : t('statement.clientHint', { defaultValue: 'Dr = they owe more (bills). Cr = they owe less (payments, returns).' })}
          </p>
        </DialogHeader>

        {!data ? (
          <div className="py-10 text-center text-sm text-muted-foreground">{t('statement.loading', { defaultValue: 'Loading…' })}</div>
        ) : data.lines.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">{t('statement.empty', { defaultValue: 'No bills or payments yet.' })}</div>
        ) : (
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t('statement.colDate', { defaultValue: 'Date' })}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('statement.colDescription', { defaultValue: 'Description' })}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('statement.colRef', { defaultValue: 'Ref' })}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('statement.colDr', { defaultValue: 'Dr' })}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('statement.colCr', { defaultValue: 'Cr' })}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('statement.colBalance', { defaultValue: 'Balance' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.lines.map((l, i) => (
                  <tr key={i} className={l.type === 'OPENING' ? 'bg-muted/30' : ''}>
                    <td className="px-3 py-1.5 whitespace-nowrap text-xs">
                      <div>{formatDate(l.date)}</div>
                      {l.dateBs && <div className="text-muted-foreground">{l.dateBs}</div>}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t(`statement.type${l.type}`, { defaultValue: TYPE_LABELS[l.type] })}
                      </span>
                      {l.description}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs">{l.reference || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{money(l.debit)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{money(l.credit)}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-medium">{money(l.balance) || '0.00'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40 font-semibold">
                <tr>
                  <td className="px-3 py-2" colSpan={3}>{t('statement.totals', { defaultValue: 'Totals' })}</td>
                  <td className="px-3 py-2 text-right font-mono">{money(data.totals.debit) || '0.00'}</td>
                  <td className="px-3 py-2 text-right font-mono">{money(data.totals.credit) || '0.00'}</td>
                  <td className="px-3 py-2 text-right font-mono">{money(data.closingBalance) || '0.00'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <DialogFooter className="sm:justify-between items-center gap-2">
          {data && (
            <p className="text-sm">
              {balanceLabel}:{' '}
              <span className={`font-mono font-semibold ${data.closingBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                NPR {Number(data.closingBalance).toLocaleString()}
              </span>
              {data.closingBalance <= 0 && <span className="text-muted-foreground"> ({t('statement.nil', { defaultValue: 'nil' })})</span>}
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('statement.close', { defaultValue: 'Close' })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
