import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { spacesApi, inventoryApi } from '@/api';
import PageHeader from '../components/shared/PageHeader';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useRole } from '@/lib/useRole';
import { useIdempotencyKey } from '@/lib/useIdempotencyKey';
import { parseSpaceNames, SPACE_STATUS_STYLE, spaceStatusLabel, rateUnitLabel, since } from '@/lib/spaces';
import { BedDouble, Plus, Settings2, X, User, Clock, Trash2, Receipt, LogIn, Ban, Sparkles, Wrench, Pencil } from 'lucide-react';

const fmtNPR = (v) => `NPR ${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
const apiError = (e, fallback) => {
  const m = e?.response?.data?.message;
  if (Array.isArray(m)) return m.join(', ');
  if (typeof m === 'string') return m;
  if (m?.fieldErrors) return Object.values(m.fieldErrors).flat().join(', ') || fallback;
  return fallback;
};
const rows = (res) => (Array.isArray(res?.data) ? res.data : []);

// ─── Space card ──────────────────────────────────────────────────────────────

function SpaceCard({ space, onClick }) {
  const { t } = useTranslation();
  const s = space.session;
  return (
    <button type="button" onClick={() => onClick(space)}
      className={cn('w-full rounded-lg border-2 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md', SPACE_STATUS_STYLE[space.status])}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-base font-bold leading-tight">{space.name}</p>
        <span className="rounded bg-background/70 px-1.5 py-0.5 text-[10px] font-medium">{spaceStatusLabel(t, space.status)}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">{space.type}{space.capacity ? ` · ${space.capacity} ${t('spaces.seats', { defaultValue: 'seats' })}` : ''}</p>
      {s ? (
        <div className="mt-2 space-y-0.5 text-xs">
          <p className="flex items-center gap-1 truncate font-medium"><User className="h-3 w-3 shrink-0" />{s.guestName}</p>
          {s.status === 'OPEN'
            ? <p className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" />{since(s.startedAt)} · {fmtNPR(s.chargesTotal)}</p>
            : <p className="text-muted-foreground">{t('spaces.reservedFor', { defaultValue: 'For' })} {s.reservedFor ? new Date(s.reservedFor).toLocaleDateString() : '—'}</p>}
        </div>
      ) : (
        space.rate ? <p className="mt-2 text-[11px] text-muted-foreground">{fmtNPR(space.rate)} {rateUnitLabel(t, space.rateUnit)}</p> : null
      )}
    </button>
  );
}

// ─── Side panel: occupy / reserve / charges / close ──────────────────────────

function SpacePanel({ space, onClose, onChanged }) {
  const { t } = useTranslation();
  const { canSell: canCreate } = useRole(); // billing = accountant / admin / Sales-tagged staff
  const closeKey = useIdempotencyKey();
  const [session, setSession] = useState(null);
  const [stock, setStock] = useState([]);
  const [busy, setBusy] = useState(false);
  const [guest, setGuest] = useState({ guestName: '', guestContact: '', guests: '', reservedFor: '', notes: '' });
  const [charge, setCharge] = useState({ inventoryItemId: '', description: '', quantity: 1, unitPrice: '' });
  const [bill, setBill] = useState({ paymentMethod: 'CASH', isVat: false, includeTimeCharge: true, timeQuantity: '', nextStatus: 'CLEANING' });

  const loadSession = useCallback(async () => {
    if (!space.session) { setSession(null); return; }
    try { setSession((await spacesApi.session(space.session.id)).data); } catch { setSession(null); }
  }, [space.session]);

  useEffect(() => { loadSession(); }, [loadSession]);
  useEffect(() => { inventoryApi.list().then((r) => setStock(rows(r).filter((i) => !i.deletedAt))).catch(() => setStock([])); }, []);
  useEffect(() => { if (session?.timeCharge) setBill((b) => ({ ...b, timeQuantity: String(session.timeCharge.quantity) })); }, [session?.timeCharge?.quantity]);

  async function run(fn, okMsg) {
    setBusy(true);
    try {
      const res = await fn();
      if (okMsg) toast.success(okMsg);
      await onChanged();
      return res;
    } catch (e) {
      toast.error(apiError(e, t('spaces.failed', { defaultValue: 'Something went wrong' })));
      return null;
    } finally {
      setBusy(false);
    }
  }

  const start = (mode) => run(() => spacesApi.start(space.id, {
    mode, guestName: guest.guestName.trim(), guestContact: guest.guestContact || null,
    guests: guest.guests ? Number(guest.guests) : null, reservedFor: mode === 'RESERVE' && guest.reservedFor ? guest.reservedFor : null, notes: guest.notes || null,
  }), mode === 'OCCUPY' ? t('spaces.occupied', { defaultValue: 'Checked in' }) : t('spaces.reserved', { defaultValue: 'Reserved' }));

  async function addCharge() {
    const data = charge.inventoryItemId
      ? { inventoryItemId: charge.inventoryItemId, quantity: Number(charge.quantity) || 1, ...(charge.unitPrice !== '' ? { unitPrice: Number(charge.unitPrice) } : {}) }
      : { description: charge.description.trim(), quantity: Number(charge.quantity) || 1, unitPrice: Number(charge.unitPrice) || 0 };
    const ok = await run(() => spacesApi.addCharge(session.id, data));
    if (ok) { setCharge({ inventoryItemId: '', description: '', quantity: 1, unitPrice: '' }); loadSession(); }
  }

  async function closeAndBill() {
    const res = await run(() => spacesApi.close(session.id, {
      paymentMethod: bill.paymentMethod, isVat: bill.isVat, includeTimeCharge: bill.includeTimeCharge, nextStatus: bill.nextStatus,
      ...(bill.includeTimeCharge && bill.timeQuantity !== '' ? { timeQuantity: Number(bill.timeQuantity) } : {}),
    }, { idempotencyKey: closeKey.key }));
    if (res) {
      closeKey.renew();
      const d = res.data;
      toast.success(d.salesOrderId
        ? t('spaces.billed', { defaultValue: 'Bill {{no}} — {{amount}}', no: d.invoiceNumber, amount: fmtNPR(d.totalAmount) })
        : t('spaces.closedNoBill', { defaultValue: 'Closed (nothing to bill)' }));
      onClose();
    }
  }

  const st = space.status;
  const timeTotal = session?.timeCharge && bill.includeTimeCharge ? (Number(bill.timeQuantity) || 0) * session.timeCharge.unitPrice : 0;
  const preTax = (session?.chargesTotal || 0) + timeTotal;
  const grand = bill.isVat ? preTax * 1.13 : preTax;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[460px] flex-col border-l border-border bg-background shadow-2xl">
        <header className="flex items-start justify-between border-b border-border p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{space.type} · {spaceStatusLabel(t, st)}</p>
            <h2 className="text-lg font-bold">{space.name}</h2>
            {space.rate ? <p className="text-xs text-muted-foreground">{fmtNPR(space.rate)} {rateUnitLabel(t, space.rateUnit)}</p> : null}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* FREE: occupy or reserve */}
          {st === 'FREE' && (
            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label className="text-xs">{t('spaces.guestName', { defaultValue: 'Guest / customer name' })} *</Label>
                  <Input className="h-9" value={guest.guestName} onChange={(e) => setGuest({ ...guest, guestName: e.target.value })} /></div>
                <div><Label className="text-xs">{t('spaces.contact', { defaultValue: 'Contact' })}</Label>
                  <Input className="h-9" value={guest.guestContact} onChange={(e) => setGuest({ ...guest, guestContact: e.target.value })} placeholder="+977…" /></div>
                <div><Label className="text-xs">{t('spaces.people', { defaultValue: 'People' })}</Label>
                  <Input type="number" min="0" className="h-9" value={guest.guests} onChange={(e) => setGuest({ ...guest, guests: e.target.value })} /></div>
                <div className="col-span-2"><Label className="text-xs">{t('spaces.notes', { defaultValue: 'Notes' })}</Label>
                  <Textarea rows={2} value={guest.notes} onChange={(e) => setGuest({ ...guest, notes: e.target.value })} /></div>
              </div>
              <Button className="w-full gap-2" disabled={busy || !guest.guestName.trim()} onClick={() => start('OCCUPY')}>
                <LogIn className="h-4 w-4" />{t('spaces.occupyNow', { defaultValue: 'Check in / seat now' })}
              </Button>
              <div className="flex items-end gap-2">
                <div className="flex-1"><Label className="text-xs">{t('spaces.reserveFor', { defaultValue: 'Reserve for date' })}</Label>
                  <Input type="date" className="h-9" value={guest.reservedFor} onChange={(e) => setGuest({ ...guest, reservedFor: e.target.value })} /></div>
                <Button variant="outline" disabled={busy || !guest.guestName.trim()} onClick={() => start('RESERVE')}>{t('spaces.reserve', { defaultValue: 'Reserve' })}</Button>
              </div>
              <div className="flex gap-2 border-t border-border pt-3">
                <Button variant="ghost" size="sm" className="gap-1" disabled={busy} onClick={() => run(() => spacesApi.setStatus(space.id, 'CLEANING')).then(onClose)}><Sparkles className="h-3.5 w-3.5" />{t('spaces.markCleaning', { defaultValue: 'Needs cleaning' })}</Button>
                <Button variant="ghost" size="sm" className="gap-1" disabled={busy} onClick={() => run(() => spacesApi.setStatus(space.id, 'OUT_OF_SERVICE')).then(onClose)}><Wrench className="h-3.5 w-3.5" />{t('spaces.markOutOfService', { defaultValue: 'Out of service' })}</Button>
              </div>
            </section>
          )}

          {(st === 'CLEANING' || st === 'OUT_OF_SERVICE') && (
            <Button className="w-full" disabled={busy} onClick={() => run(() => spacesApi.setStatus(space.id, 'FREE'), t('spaces.nowFree', { defaultValue: 'Marked free' })).then(onClose)}>
              {t('spaces.markFree', { defaultValue: 'Mark as free' })}
            </Button>
          )}

          {/* RESERVED / OPEN */}
          {session && (
            <section className="space-y-1 rounded-lg border border-border p-3 text-sm">
              <p className="flex items-center gap-1.5 font-semibold"><User className="h-4 w-4" />{session.guestName}{session.guests ? <span className="text-xs font-normal text-muted-foreground">· {session.guests}</span> : null}</p>
              {session.guestContact && <p className="text-xs text-muted-foreground">{session.guestContact}</p>}
              <p className="text-xs text-muted-foreground">
                {session.status === 'OPEN'
                  ? `${t('spaces.since', { defaultValue: 'Since' })} ${fmtDate(session.startedAt)} (${since(session.startedAt)})`
                  : `${t('spaces.reservedFor', { defaultValue: 'For' })} ${session.reservedFor ? new Date(session.reservedFor).toLocaleDateString() : '—'}`}
              </p>
              {session.notes && <p className="text-xs">{session.notes}</p>}
            </section>
          )}

          {session?.status === 'RESERVED' && (
            <div className="flex gap-2">
              <Button className="flex-1 gap-2" disabled={busy} onClick={() => run(() => spacesApi.checkIn(session.id), t('spaces.occupied', { defaultValue: 'Checked in' })).then(onClose)}><LogIn className="h-4 w-4" />{t('spaces.checkIn', { defaultValue: 'Check in' })}</Button>
              <Button variant="outline" className="gap-2" disabled={busy} onClick={() => run(() => spacesApi.cancel(session.id), t('spaces.cancelled', { defaultValue: 'Cancelled' })).then(onClose)}><Ban className="h-4 w-4" />{t('spaces.cancelReservation', { defaultValue: 'Cancel' })}</Button>
            </div>
          )}

          {session?.status === 'OPEN' && (
            <>
              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('spaces.charges', { defaultValue: 'Charges' })}</p>
                {session.charges.length === 0 && <p className="text-xs italic text-muted-foreground">{t('spaces.noCharges', { defaultValue: 'No charges yet' })}</p>}
                {session.charges.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
                    <span className="truncate">{c.description} <span className="text-muted-foreground">× {c.quantity} @ {fmtNPR(c.unitPrice)}</span></span>
                    <span className="flex shrink-0 items-center gap-2 font-mono">{fmtNPR(c.amount)}
                      <button type="button" className="text-muted-foreground hover:text-destructive" disabled={busy}
                        onClick={() => run(() => spacesApi.removeCharge(session.id, c.id)).then(loadSession)} aria-label={t('spaces.removeCharge', { defaultValue: 'Remove' })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                ))}
                <div className="grid grid-cols-12 gap-2 rounded-md bg-muted/30 p-2">
                  <select className="col-span-12 h-8 rounded-md border border-input bg-background px-2 text-xs" value={charge.inventoryItemId}
                    onChange={(e) => setCharge({ ...charge, inventoryItemId: e.target.value })}>
                    <option value="">{t('spaces.otherCharge', { defaultValue: 'Other charge (type below)' })}</option>
                    {stock.map((i) => <option key={i.id} value={i.id}>{i.itemName || i.partNumber} — {fmtNPR(i.unitSellingPrice)}</option>)}
                  </select>
                  {!charge.inventoryItemId && (
                    <Input className="col-span-12 h-8 text-xs" value={charge.description} placeholder={t('spaces.chargeDescription', { defaultValue: 'e.g. Laundry, Room service' })}
                      onChange={(e) => setCharge({ ...charge, description: e.target.value })} />
                  )}
                  <Input type="number" min="0" step="any" className="col-span-4 h-8 text-xs" value={charge.quantity} title={t('spaces.qty', { defaultValue: 'Qty' })}
                    onChange={(e) => setCharge({ ...charge, quantity: e.target.value })} />
                  <Input type="number" min="0" step="any" className="col-span-5 h-8 text-xs" value={charge.unitPrice}
                    placeholder={charge.inventoryItemId ? t('spaces.itemPrice', { defaultValue: 'Item price' }) : t('spaces.price', { defaultValue: 'Price' })}
                    onChange={(e) => setCharge({ ...charge, unitPrice: e.target.value })} />
                  <Button size="sm" className="col-span-3 h-8 gap-1" disabled={busy || (!charge.inventoryItemId && (!charge.description.trim() || charge.unitPrice === ''))} onClick={addCharge}>
                    <Plus className="h-3.5 w-3.5" />{t('spaces.add', { defaultValue: 'Add' })}
                  </Button>
                </div>
              </section>

              {canCreate ? (
                <section className="space-y-3 rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('spaces.closeAndBill', { defaultValue: 'Close & bill' })}</p>
                  {session.timeCharge && (
                    <div className="flex items-center gap-2 text-xs">
                      <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-primary" checked={bill.includeTimeCharge}
                        onChange={(e) => setBill({ ...bill, includeTimeCharge: e.target.checked })} />{t('spaces.timeCharge', { defaultValue: 'Time charge' })}</label>
                      <Input type="number" min="0" step="any" className="h-7 w-16 text-xs" value={bill.timeQuantity} disabled={!bill.includeTimeCharge}
                        onChange={(e) => setBill({ ...bill, timeQuantity: e.target.value })} />
                      <span className="text-muted-foreground">× {fmtNPR(session.timeCharge.unitPrice)} {rateUnitLabel(t, space.rateUnit)}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={bill.paymentMethod} onChange={(e) => setBill({ ...bill, paymentMethod: e.target.value })}>
                      <option value="CASH">{t('spaces.payCash', { defaultValue: 'Paid — Cash' })}</option>
                      <option value="BANK_TRANSFER">{t('spaces.payBank', { defaultValue: 'Paid — Bank' })}</option>
                      <option value="QR">{t('spaces.payQr', { defaultValue: 'Paid — QR / Wallet' })}</option>
                      <option value="CHEQUE">{t('spaces.payCheque', { defaultValue: 'Paid — Cheque' })}</option>
                      <option value="CREDIT">{t('spaces.payCredit', { defaultValue: 'On credit (pay later)' })}</option>
                    </select>
                    <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={bill.nextStatus} onChange={(e) => setBill({ ...bill, nextStatus: e.target.value })}>
                      <option value="CLEANING">{t('spaces.thenCleaning', { defaultValue: 'Then: needs cleaning' })}</option>
                      <option value="FREE">{t('spaces.thenFree', { defaultValue: 'Then: free' })}</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="accent-primary" checked={bill.isVat} onChange={(e) => setBill({ ...bill, isVat: e.target.checked })} />{t('spaces.vat', { defaultValue: 'VAT 13%' })}</label>
                  <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                    <span className="text-muted-foreground">{t('spaces.total', { defaultValue: 'Total' })}</span>
                    <span className="font-mono text-base font-bold">{fmtNPR(grand)}</span>
                  </div>
                  <Button className="w-full gap-2" disabled={busy} onClick={closeAndBill}><Receipt className="h-4 w-4" />{t('spaces.closeAndBill', { defaultValue: 'Close & bill' })}</Button>
                </section>
              ) : (
                <p className="text-xs text-muted-foreground">{t('spaces.billingByAccountant', { defaultValue: 'An accountant or admin closes and bills.' })}</p>
              )}
              <Button variant="ghost" size="sm" className="w-full text-red-600" disabled={busy}
                onClick={() => window.confirm(t('spaces.confirmCancel', { defaultValue: 'Cancel this without a bill? Charges will be discarded.' })) && run(() => spacesApi.cancel(session.id), t('spaces.cancelled', { defaultValue: 'Cancelled' })).then(onClose)}>
                {t('spaces.cancelNoBill', { defaultValue: 'Cancel without billing' })}
              </Button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── Manage spaces (accountant / admin) ──────────────────────────────────────

const EMPTY_SPACE = { id: null, name: '', type: '', capacity: '', rate: '', rateUnit: '' };

function ManageSpacesDialog({ open, onOpenChange, spaces, onChanged }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY_SPACE);
  const [bulkNames, setBulkNames] = useState('');
  const [busy, setBusy] = useState(false);
  const types = [...new Set(spaces.map((s) => s.type))];
  const parsed = parseSpaceNames(bulkNames);
  const shared = () => ({
    type: form.type.trim(),
    capacity: form.capacity === '' ? null : Number(form.capacity),
    rate: form.rate === '' ? null : Number(form.rate),
    rateUnit: form.rate === '' ? null : (form.rateUnit || 'NIGHT'),
  });

  async function save() {
    setBusy(true);
    try {
      if (form.id) await spacesApi.update(form.id, { name: form.name.trim(), ...shared() });
      else if (parsed.length > 1) {
        const r = await spacesApi.bulk({ names: parsed, ...shared() });
        toast.success(t('spaces.bulkCreated', { defaultValue: '{{n}} added', n: r.data.created }));
      } else await spacesApi.create({ name: (parsed[0] || form.name).trim(), ...shared() });
      setForm(EMPTY_SPACE); setBulkNames('');
      await onChanged();
    } catch (e) {
      toast.error(apiError(e, t('spaces.failed', { defaultValue: 'Something went wrong' })));
    } finally {
      setBusy(false);
    }
  }

  async function remove(s) {
    if (!window.confirm(t('spaces.confirmDelete', { defaultValue: 'Delete {{name}}?', name: s.name }))) return;
    try { await spacesApi.remove(s.id); await onChanged(); } catch (e) { toast.error(apiError(e, 'Could not delete')); }
  }

  const editing = !!form.id;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-dialog max-w-2xl flex flex-col">
        <DialogHeader><DialogTitle>{t('spaces.manage', { defaultValue: 'Manage spaces' })}</DialogTitle></DialogHeader>
        <div className="grid flex-1 min-h-0 gap-4 overflow-y-auto pr-1 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{editing ? t('spaces.editSpace', { defaultValue: 'Edit space' }) : t('spaces.addSpaces', { defaultValue: 'Add spaces' })}</p>
            <div><Label className="text-xs">{t('spaces.kind', { defaultValue: 'Kind (what you call it)' })} *</Label>
              <Input className="h-9" list="space-types" value={form.type} placeholder={t('spaces.kindPlaceholder', { defaultValue: 'Room, Table, Bed, Chair…' })} onChange={(e) => setForm({ ...form, type: e.target.value })} />
              <datalist id="space-types">{types.map((ty) => <option key={ty} value={ty} />)}</datalist></div>
            {editing ? (
              <div><Label className="text-xs">{t('spaces.name', { defaultValue: 'Name / number' })} *</Label>
                <Input className="h-9" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            ) : (
              <div><Label className="text-xs">{t('spaces.names', { defaultValue: 'Names / numbers' })} *</Label>
                <Input className="h-9" value={bulkNames} placeholder="101-110, Deluxe, T1-T8" onChange={(e) => setBulkNames(e.target.value)} />
                {parsed.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">{t('spaces.willAdd', { defaultValue: 'Will add {{n}}: {{list}}', n: parsed.length, list: parsed.slice(0, 8).join(', ') + (parsed.length > 8 ? '…' : '') })}</p>}</div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">{t('spaces.capacity', { defaultValue: 'Capacity' })}</Label>
                <Input type="number" min="0" className="h-9" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
              <div><Label className="text-xs">{t('spaces.rate', { defaultValue: 'Rate' })}</Label>
                <Input type="number" min="0" className="h-9" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></div>
              <div><Label className="text-xs">{t('spaces.per', { defaultValue: 'Per' })}</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.rateUnit || 'NIGHT'} disabled={form.rate === ''}
                  onChange={(e) => setForm({ ...form, rateUnit: e.target.value })}>
                  {['NIGHT', 'DAY', 'HOUR', 'VISIT'].map((u) => <option key={u} value={u}>{rateUnitLabel(t, u)}</option>)}
                </select></div>
            </div>
            <p className="text-[11px] text-muted-foreground">{t('spaces.rateHint', { defaultValue: 'Optional. A rate is added to the bill for the time used (e.g. room nights). Tables usually have none.' })}</p>
            <div className="flex gap-2">
              {editing && <Button variant="ghost" onClick={() => setForm(EMPTY_SPACE)}>{t('spaces.cancel', { defaultValue: 'Cancel' })}</Button>}
              <Button className="flex-1" disabled={busy || !form.type.trim() || (editing ? !form.name.trim() : parsed.length === 0)} onClick={save}>
                {editing ? t('spaces.save', { defaultValue: 'Save' }) : t('spaces.add', { defaultValue: 'Add' })}
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('spaces.yourSpaces', { defaultValue: 'Your spaces' })} ({spaces.length})</p>
            {spaces.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
                <span className="truncate"><span className="font-medium">{s.name}</span> <span className="text-muted-foreground">· {s.type}{s.rate ? ` · ${fmtNPR(s.rate)} ${rateUnitLabel(t, s.rateUnit)}` : ''}</span></span>
                <span className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setForm({ id: s.id, name: s.name, type: s.type, capacity: s.capacity ?? '', rate: s.rate ?? '', rateUnit: s.rateUnit || '' })}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(s)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                </span>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>{t('spaces.done', { defaultValue: 'Done' })}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Spaces() {
  const { t } = useTranslation();
  const { canCreate } = useRole();
  const [spaces, setSpaces] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [manage, setManage] = useState(false);
  const [typeFilter, setTypeFilter] = useState(null);

  const load = useCallback(async () => {
    try { setSpaces(rows(await spacesApi.list())); } catch { setSpaces([]); }
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const types = useMemo(() => [...new Set((spaces || []).map((s) => s.type))], [spaces]);
  const counts = useMemo(() => {
    const c = {};
    for (const s of spaces || []) c[s.status] = (c[s.status] || 0) + 1;
    return c;
  }, [spaces]);

  if (!spaces) return <PageLoader />;
  const visible = spaces.filter((s) => !typeFilter || s.type === typeFilter);
  const groups = types.filter((ty) => !typeFilter || ty === typeFilter);

  return (
    <div className="space-y-4">
      <PageHeader title={t('spaces.pageTitle', { defaultValue: 'Spaces' })}
        subtitle={t('spaces.pageSubtitle', { defaultValue: 'Rooms, tables, beds — who is where, and their bill' })}>
        {canCreate && <Button variant="outline" className="gap-2" onClick={() => setManage(true)}><Settings2 className="h-4 w-4" />{t('spaces.manage', { defaultValue: 'Manage spaces' })}</Button>}
      </PageHeader>

      {spaces.length === 0 ? (
        <EmptyState icon={BedDouble} title={t('spaces.emptyTitle', { defaultValue: 'No spaces yet' })}
          description={t('spaces.emptyHint', { defaultValue: 'Add your rooms, tables or beds to start.' })}
          action={canCreate ? <Button className="gap-2" onClick={() => setManage(true)}><Plus className="h-4 w-4" />{t('spaces.addSpaces', { defaultValue: 'Add spaces' })}</Button> : null} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {['FREE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'OUT_OF_SERVICE'].map((st) => (
              <span key={st} className={cn('rounded-full border-2 px-2.5 py-0.5', SPACE_STATUS_STYLE[st])}>{spaceStatusLabel(t, st)}: <b>{counts[st] || 0}</b></span>
            ))}
            {types.length > 1 && (
              <span className="ml-auto flex gap-1">
                <Button size="sm" variant={!typeFilter ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setTypeFilter(null)}>{t('spaces.all', { defaultValue: 'All' })}</Button>
                {types.map((ty) => <Button key={ty} size="sm" variant={typeFilter === ty ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setTypeFilter(ty)}>{ty}</Button>)}
              </span>
            )}
          </div>
          {groups.map((ty) => (
            <section key={ty}>
              <p className="mb-2 text-sm font-semibold">{ty}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                {visible.filter((s) => s.type === ty).map((s) => <SpaceCard key={s.id} space={s} onClick={(sp) => setSelectedId(sp.id)} />)}
              </div>
            </section>
          ))}
        </>
      )}

      {/* Always the latest copy from the list, so the panel follows check-in / close. */}
      {selectedId && spaces.find((s) => s.id === selectedId) && (
        <SpacePanel space={spaces.find((s) => s.id === selectedId)} onClose={() => { setSelectedId(null); load(); }}
          onChanged={async () => { await load(); }} />
      )}
      <ManageSpacesDialog open={manage} onOpenChange={setManage} spaces={spaces} onChanged={load} />
    </div>
  );
}
