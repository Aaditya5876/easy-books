import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { normalizeUnits } from '@easy-books/shared';

// Editable list of unit chips (Kg, Strip, Plate…). Used by GeoInfosys when
// creating a client and by a company's admin in Settings → Preferences.
export default function UnitListEditor({ units, onChange, disabled }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  function add() {
    const next = normalizeUnits([...units, ...draft.split(',')]);
    onChange(next);
    setDraft('');
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {units.map((u) => (
          <span key={u} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs">
            {u}
            {!disabled && (
              <button type="button" className="text-muted-foreground hover:text-destructive" aria-label={t('units.remove', { defaultValue: 'Remove {{unit}}', unit: u })}
                onClick={() => onChange(units.filter((x) => x !== u))}>
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {units.length === 0 && <span className="text-xs text-muted-foreground">{t('units.empty', { defaultValue: 'No units yet' })}</span>}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <Input
            className="h-8 text-sm"
            value={draft}
            maxLength={120}
            placeholder={t('units.addPlaceholder', { defaultValue: 'Add a unit, e.g. Strip, Tray, Plate (comma for several)' })}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          />
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1" disabled={!draft.trim()} onClick={add}>
            <Plus className="h-3.5 w-3.5" />{t('units.add', { defaultValue: 'Add' })}
          </Button>
        </div>
      )}
    </div>
  );
}
