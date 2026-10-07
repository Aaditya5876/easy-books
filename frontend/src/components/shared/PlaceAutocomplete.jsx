import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { searchPlaces } from '@/lib/nominatim';
import { Input } from '@/components/ui/input';

// Free-text place input with a live OpenStreetMap suggestion dropdown —
// unlike BorrowerCombobox/StaffCombobox this does NOT force picking a
// suggestion (small local place names aren't always in Nominatim), it just
// helps the admin type a name Nominatim can actually geocode later, so the
// transport route map traces the real stops instead of guessing at whatever
// free text was typed.
export default function PlaceAutocomplete({ value, onChange, placeholder, className }) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const blurTimeoutRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = value.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(query);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  useEffect(() => () => clearTimeout(blurTimeoutRef.current), []);

  return (
    <div className="relative flex-1">
      <Input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimeoutRef.current = setTimeout(() => setOpen(false), 150); }}
        className={className}
        autoComplete="off"
      />
      {open && value.trim().length >= 3 && (loading || suggestions.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden max-h-56 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Searching…
            </div>
          ) : (
            suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(s.label); setOpen(false); setSuggestions([]); }}
                className="w-full flex items-start gap-2 px-3 py-2 text-left text-sm hover:bg-secondary transition-colors"
                title={s.fullLabel}
              >
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="truncate">{s.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
