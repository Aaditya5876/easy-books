import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { companyApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// The company's own item fields (Size, Colour…), defined in Settings → Preferences.
export function useItemFields() {
  const companyId = getActiveCompanyId();
  const { data } = useQuery({
    queryKey: ['item-fields', companyId],
    queryFn: () => companyApi.getItemFields(companyId).then((r) => r.data?.fields ?? []),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
  return data ?? [];
}

// Days until an expiry date (date-only, UTC) — negative once expired.
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = Date.parse(new Date().toISOString().slice(0, 10));
  return Math.round((Date.parse(String(dateStr).slice(0, 10)) - today) / 86_400_000);
}

// "Expired" / "Expires in N days" tag for an item, or null when far off.
export function ExpiryTag({ expiryDate, alertDays }) {
  const { t } = useTranslation();
  const days = daysUntil(expiryDate);
  if (days === null || days > (alertDays ?? 30)) return null;
  const expired = days < 0;
  return (
    <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${expired ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
      {expired
        ? t('inventory.expired', { defaultValue: 'Expired' })
        : t('inventory.expiresInDays', { defaultValue: 'Expires in {{n}}d', n: days })}
    </span>
  );
}

// Batch / expiry (when the business uses them) and the custom item fields.
// Works on the page's snake_case form: batch_no, expiry_date,
// expiry_alert_days, custom_fields.
export default function ItemExtraFields({ form, setForm, showBatch, showExpiry, defs }) {
  const { t } = useTranslation();
  const values = form.custom_fields || {};
  const setValue = (key, v) => setForm((f) => ({ ...f, custom_fields: { ...(f.custom_fields || {}), [key]: v } }));
  if (!showBatch && !showExpiry && defs.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {showBatch && (
        <div>
          <Label className="text-sm">{t('inventory.batchNo', { defaultValue: 'Batch No.' })}</Label>
          <Input className="mt-1 h-9 text-sm" value={form.batch_no || ''} maxLength={60}
            onChange={(e) => setForm((f) => ({ ...f, batch_no: e.target.value }))} placeholder="e.g. B-2611" />
        </div>
      )}
      {showExpiry && (
        <>
          <div>
            <Label className="text-sm">{t('inventory.expiryDate', { defaultValue: 'Expiry Date' })}</Label>
            <Input type="date" className="mt-1 h-9 text-sm" value={form.expiry_date ? String(form.expiry_date).slice(0, 10) : ''}
              onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} />
          </div>
          <div>
            <Label className="text-sm">{t('inventory.alertBeforeExpiryDays', { defaultValue: 'Alert Before Expiry (Days)' })}</Label>
            <Input type="number" min="0" className="mt-1 h-9 text-sm" placeholder="30" value={form.expiry_alert_days ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, expiry_alert_days: e.target.value }))} />
          </div>
        </>
      )}
      {defs.map((d) => (
        <div key={d.key}>
          <Label className="text-sm">{d.label}{d.required && <span className="text-red-500"> *</span>}</Label>
          {d.type === 'select' ? (
            <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={values[d.key] ?? ''} onChange={(e) => setValue(d.key, e.target.value)}>
              <option value="">—</option>
              {(d.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <Input className="mt-1 h-9 text-sm" type={d.type === 'number' ? 'number' : d.type === 'date' ? 'date' : 'text'}
              value={values[d.key] ?? ''} onChange={(e) => setValue(d.key, e.target.value)} />
          )}
        </div>
      ))}
    </div>
  );
}

// Payload pieces for the API (adapter converts snake → camel; custom-field
// keys are lowercase letters/digits so they pass through unchanged).
export function extraFieldsPayload(form, defs) {
  const out = {
    batch_no: form.batch_no?.trim() || null,
    expiry_date: form.expiry_date ? String(form.expiry_date).slice(0, 10) : '',
    expiry_alert_days: form.expiry_alert_days === '' || form.expiry_alert_days == null ? null : parseInt(form.expiry_alert_days, 10),
  };
  if (defs.length) {
    out.custom_fields = Object.fromEntries(
      defs.map((d) => [d.key, form.custom_fields?.[d.key]]).filter(([, v]) => v !== undefined && v !== ''),
    );
  }
  return out;
}
