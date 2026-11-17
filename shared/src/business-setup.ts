import { z } from 'zod';

// Starting unit list per business type. GeoInfosys can adjust it when
// creating a client; the client's admin can change it later in Settings.
export const UNIT_PRESETS: Record<string, string[]> = {
  RETAIL: ['Piece', 'Kg', 'gm', 'Litre', 'ml', 'Packet', 'Dozen', 'Box', 'Carton', 'Bottle'],
  PHARMACY: ['Strip', 'Tablet', 'Capsule', 'Bottle', 'Box', 'Tube', 'Vial', 'Sachet', 'Piece', 'ml'],
  ELECTRONICS: ['Piece', 'Set', 'Box', 'Metre', 'Roll', 'Pair', 'Kg'],
  FOOD_BEVERAGE: ['Plate', 'Cup', 'Glass', 'Bottle', 'Piece', 'Kg', 'gm', 'Litre', 'ml', 'Packet'],
  SERVICES: ['Hour', 'Day', 'Session', 'Visit', 'Job', 'Month', 'Piece'],
  MANUFACTURING: ['Piece', 'Kg', 'Ton', 'Litre', 'Metre', 'Roll', 'Bag', 'Box', 'Set'],
  DEFAULT: ['Piece', 'Set', 'Kg', 'gm', 'Litre', 'ml', 'Box', 'Packet', 'Dozen'],
};

export function defaultUnitsFor(businessType?: string | null): string[] {
  return [...(UNIT_PRESETS[String(businessType ?? '').toUpperCase()] ?? UNIT_PRESETS.DEFAULT)];
}

// Trims, collapses spaces, drops blanks and case-insensitive duplicates
// (first spelling wins), keeps the given order.
export function normalizeUnits(units: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of units) {
    const u = String(raw ?? '').trim().replace(/\s+/g, ' ');
    if (!u || seen.has(u.toLowerCase())) continue;
    seen.add(u.toLowerCase());
    out.push(u);
  }
  return out;
}

export const UnitListSchema = z.object({
  units: z.array(z.string().max(30, 'A unit name can be at most 30 characters')).max(100),
}).refine((v) => normalizeUnits(v.units).length > 0, { message: 'Keep at least one unit', path: ['units'] });

// ── Custom item fields ──────────────────────────────────────────────────────
// Each business adds the extra item details it needs (Size, Colour, Weight…)
// instead of the app shipping a separate field set per business type.
export const ITEM_FIELD_TYPES = ['text', 'number', 'date', 'select'] as const;
export type ItemFieldType = (typeof ITEM_FIELD_TYPES)[number];
export interface ItemFieldDef {
  key: string;
  label: string;
  type: ItemFieldType;
  options?: string[];
  required?: boolean;
  showInList?: boolean;
}

const ItemFieldDefSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9]{0,39}$/).optional(),
  label: z.string().trim().min(1).max(40),
  type: z.enum(ITEM_FIELD_TYPES),
  options: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
  required: z.boolean().optional(),
  showInList: z.boolean().optional(),
});

export const ItemFieldListSchema = z.object({ fields: z.array(ItemFieldDefSchema).max(20) })
  .superRefine((v, ctx) => {
    const keys = new Set<string>();
    v.fields.forEach((f, i) => {
      if (f.type === 'select' && normalizeUnits(f.options ?? []).length === 0) {
        ctx.addIssue({ code: 'custom', path: ['fields', i, 'options'], message: `"${f.label}" needs at least one option` });
      }
      const key = f.key ?? itemFieldKey(f.label);
      if (keys.has(key)) ctx.addIssue({ code: 'custom', path: ['fields', i, 'label'], message: `Two fields are both called "${f.label}"` });
      keys.add(key);
    });
  });

// Lowercase letters and digits only: the frontend's snake/camel key
// converter leaves such keys untouched ("Weight (g)" → "weightg").
export function itemFieldKey(label: string): string {
  const k = label.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 40);
  return /^[a-z]/.test(k) ? k : `f${k || 'field'}`.slice(0, 40);
}

export function normalizeItemFields(fields: z.infer<typeof ItemFieldDefSchema>[]): ItemFieldDef[] {
  return fields.map((f) => ({
    key: f.key ?? itemFieldKey(f.label),
    label: f.label.trim(),
    type: f.type,
    ...(f.type === 'select' ? { options: normalizeUnits(f.options ?? []) } : {}),
    ...(f.required ? { required: true } : {}),
    ...(f.showInList ? { showInList: true } : {}),
  }));
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
export function isValidDateOnly(v: string): boolean {
  if (!DATE_ONLY.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// Checks an item's custom values against the company's field definitions.
// Returns cleaned values (trimmed text, numbers as numbers) or a list of errors.
export function checkCustomFields(defs: ItemFieldDef[], values: Record<string, unknown> | null | undefined) {
  const errors: string[] = [];
  const clean: Record<string, string | number> = {};
  const input = values ?? {};
  const byKey = new Map(defs.map((d) => [d.key, d]));
  for (const k of Object.keys(input)) if (!byKey.has(k)) errors.push(`Unknown field "${k}"`);
  for (const d of defs) {
    const raw = input[d.key];
    const blank = raw === undefined || raw === null || String(raw).trim() === '';
    if (blank) {
      if (d.required) errors.push(`${d.label} is required`);
      continue;
    }
    const s = String(raw).trim();
    if (d.type === 'number') {
      const n = Number(s);
      if (!Number.isFinite(n)) errors.push(`${d.label} must be a number`);
      else clean[d.key] = n;
    } else if (d.type === 'date') {
      if (!isValidDateOnly(s)) errors.push(`${d.label} must be a date (YYYY-MM-DD)`);
      else clean[d.key] = s;
    } else if (d.type === 'select') {
      if (!(d.options ?? []).includes(s)) errors.push(`${d.label} must be one of: ${(d.options ?? []).join(', ')}`);
      else clean[d.key] = s;
    } else {
      clean[d.key] = s.slice(0, 200);
    }
  }
  return { errors, clean };
}
