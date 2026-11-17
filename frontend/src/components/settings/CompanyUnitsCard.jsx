import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ruler } from 'lucide-react';
import { companyApi } from '@/api';
import { Button } from '@/components/ui/button';
import UnitListEditor from '@/components/shared/UnitListEditor';
import { defaultUnitsFor } from '@easy-books/shared';

// Settings → Preferences: the company's own unit list, used by every unit
// dropdown (Inventory, Purchase, Sales, Quotations). ADMIN only.
export default function CompanyUnitsCard({ companyId, businessType }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['company-units', companyId],
    queryFn: () => companyApi.getUnits(companyId).then((r) => r.data?.units ?? []),
    enabled: !!companyId,
  });
  const [units, setUnits] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setUnits(data); }, [data]);

  const dirty = JSON.stringify(units) !== JSON.stringify(data ?? []);

  async function save() {
    setSaving(true);
    try {
      const res = await companyApi.setUnits(companyId, units);
      qc.setQueryData(['company-units', companyId], res.data.units);
      toast.success(t('units.saved', { defaultValue: 'Units saved' }));
    } catch (e) {
      const m = e?.response?.data?.message;
      toast.error(typeof m === 'string' ? m : t('units.saveFailed', { defaultValue: 'Could not save units' }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-card rounded-xl border p-6 space-y-4 max-w-lg">
      <div>
        <h3 className="font-semibold flex items-center gap-2"><Ruler className="w-4 h-4 text-primary" />{t('units.heading', { defaultValue: 'Units' })}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t('units.subtitle', { defaultValue: 'The units your business uses (Kg, Strip, Plate…). They appear in every unit dropdown. For a one-off, pick "Custom…" on the item instead.' })}</p>
      </div>
      <UnitListEditor units={units} onChange={setUnits} />
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setUnits(defaultUnitsFor(businessType))}>
          {t('units.resetDefaults', { defaultValue: 'Reset to defaults' })}
        </Button>
        <Button type="button" size="sm" disabled={!dirty || saving || units.length === 0} onClick={save}>
          {saving ? t('units.saving', { defaultValue: 'Saving…' }) : t('units.save', { defaultValue: 'Save units' })}
        </Button>
      </div>
    </div>
  );
}
