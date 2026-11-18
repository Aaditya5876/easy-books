import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { billStatusKey } from '@/lib/bills';

const STYLES = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  PARTIAL: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30',
  PAID: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  CANCELLED: 'bg-muted text-muted-foreground',
};

const LABELS = { PENDING: 'Unpaid', PARTIAL: 'Partially paid', PAID: 'Paid', CANCELLED: 'Cancelled' };

// Unpaid / Partially paid / Paid — always worked out from Total vs Paid.
export default function BillStatusBadge({ bill }) {
  const { t } = useTranslation();
  const key = billStatusKey(bill);
  return (
    <Badge variant="outline" className={STYLES[key]}>
      {t(`bills.status${key}`, { defaultValue: LABELS[key] })}
    </Badge>
  );
}

export function billStatusLabel(t, bill) {
  const key = billStatusKey(bill);
  return t(`bills.status${key}`, { defaultValue: LABELS[key] });
}
