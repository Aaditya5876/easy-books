import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ListPlus, Trash2, Plus } from 'lucide-react';
import { companyApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TYPES = ['text', 'number', 'date', 'select'];

// Settings → Preferences: extra item details this business needs (Size,
// Colour, Weight…). They appear on the Inventory form; "show in list" adds a
// column. ADMIN only.
export default function ItemFieldsCard({ companyId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['item-fields', companyId],
    queryFn: () => companyApi.getItemFields(companyId).then((r) => r.data?.fields ?? []),
    enabled: !!companyId,
  });
  const [fields, setFields] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data) setFields(data.map((f) => ({ ...f, optionsText: (f.options || []).join(', ') })));
  }, [data]);

  const typeLabel = (ty) => ({
    text: t('itemFields.typeText', { defaultValue: 'Text' }),
    number: t('itemFields.typeNumber', { defaultValue: 'Number' }),
    date: t('itemFields.typeDate', { defaultValue: 'Date' }),
    select: t('itemFields.typeSelect', { defaultValue: 'Choice list' }),
  }[ty]);
  const update = (i, patch) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  async function save() {
    setSaving(true);
    try {
      const payload = fields
        .filter((f) => f.label.trim())
        .map(({ key, label, type, optionsText, required, showInList }) => ({
          ...(key ? { key } : {}),
          label: label.trim(),
          type,
          ...(type === 'select' ? { options: optionsText.split(',').map((o) => o.trim()).filter(Boolean) } : {}),
          required: !!required,
          showInList: !!showInList,
        }));
      const res = await companyApi.setItemFields(companyId, payload);
      qc.setQueryData(['item-fields', companyId], res.data.fields);
      toast.success(t('itemFields.saved', { defaultValue: 'Item fields saved' }));
    } catch (e) {
      const err = e?.response?.data;
      const msg = typeof err?.message === 'string' ? err.message
        : err?.message?.fieldErrors ? Object.values(err.message.fieldErrors).flat().join(', ')
          : (err?.message?.formErrors || []).join(', ');
      toast.error(msg || t('itemFields.saveFailed', { defaultValue: 'Could not save item fields' }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-card rounded-xl border p-6 space-y-4 max-w-2xl">
      <div>
        <h3 className="font-semibold flex items-center gap-2"><ListPlus className="w-4 h-4 text-primary" />{t('itemFields.heading', { defaultValue: 'Item Fields' })}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t('itemFields.subtitle', { defaultValue: 'Extra details your items need — e.g. Size and Colour for clothes, Weight for groceries. They appear on the Inventory form.' })}</p>
      </div>

      {fields.length === 0 && <p className="text-xs italic text-muted-foreground">{t('itemFields.none', { defaultValue: 'No extra fields yet.' })}</p>}
      <div className="space-y-2">
        {fields.map((f, i) => (
          <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-border p-2">
            <Input className="col-span-12 h-8 text-sm sm:col-span-4" value={f.label} maxLength={40}
              placeholder={t('itemFields.labelPlaceholder', { defaultValue: 'Field name, e.g. Size' })} onChange={(e) => update(i, { label: e.target.value })} />
            <select className="col-span-6 h-8 rounded-md border border-input bg-background px-2 text-sm sm:col-span-3" value={f.type}
              onChange={(e) => update(i, { type: e.target.value })}>
              {TYPES.map((ty) => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
            </select>
            <label className="col-span-3 flex items-center gap-1 text-xs sm:col-span-2">
              <input type="checkbox" className="accent-primary" checked={!!f.required} onChange={(e) => update(i, { required: e.target.checked })} />
              {t('itemFields.required', { defaultValue: 'Required' })}
            </label>
            <label className="col-span-3 flex items-center gap-1 text-xs sm:col-span-2">
              <input type="checkbox" className="accent-primary" checked={!!f.showInList} onChange={(e) => update(i, { showInList: e.target.checked })} />
              {t('itemFields.inList', { defaultValue: 'In list' })}
            </label>
            <Button type="button" variant="ghost" size="icon" className="col-span-12 h-8 w-8 justify-self-end sm:col-span-1"
              aria-label={t('itemFields.remove', { defaultValue: 'Remove field' })} onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}>
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </Button>
            {f.type === 'select' && (
              <Input className="col-span-12 h-8 text-sm" value={f.optionsText || ''}
                placeholder={t('itemFields.optionsPlaceholder', { defaultValue: 'Choices, comma separated — e.g. S, M, L, XL' })}
                onChange={(e) => update(i, { optionsText: e.target.value })} />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1" disabled={fields.length >= 20}
          onClick={() => setFields((fs) => [...fs, { label: '', type: 'text', optionsText: '', required: false, showInList: false }])}>
          <Plus className="h-3.5 w-3.5" />{t('itemFields.add', { defaultValue: 'Add field' })}
        </Button>
        <Button type="button" size="sm" disabled={saving} onClick={save}>
          {saving ? t('itemFields.saving', { defaultValue: 'Saving…' }) : t('itemFields.save', { defaultValue: 'Save fields' })}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">{t('itemFields.removeHint', { defaultValue: 'Removing a field hides it; values already saved on items are kept.' })}</p>
    </div>
  );
}
