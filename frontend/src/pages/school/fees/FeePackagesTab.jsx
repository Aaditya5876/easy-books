import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { schoolFinanceApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';

const fmtRs = (n) => `Rs. ${Number(n ?? 0).toLocaleString('en-NP')}`;

function PackageDialog({ open, onClose, initial, feeHeads }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    name: initial?.name || '',
    price: initial?.price ?? '',
    feeHeadIds: initial?.heads?.map(h => h.feeHead.id) || [],
  });

  const [errors, setErrors] = useState({});

  const toggleHead = (id) => setForm(f => ({
    ...f,
    feeHeadIds: f.feeHeadIds.includes(id) ? f.feeHeadIds.filter(x => x !== id) : [...f.feeHeadIds, id],
  }));

  const save = useMutation({
    mutationFn: () => isEdit
      ? schoolFinanceApi.updatePackage(initial.id, form)
      : schoolFinanceApi.createPackage(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-packages'] });
      toast.success(isEdit ? t('packages.updated', { defaultValue: 'Package updated' }) : t('packages.created', { defaultValue: 'Package created' }));
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || t('packages.failedToSave', { defaultValue: 'Failed to save' })),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = t('packages.nameRequired', { defaultValue: 'Package name is required' });
    if (form.feeHeadIds.length === 0) errs.feeHeadIds = t('packages.headsRequired', { defaultValue: 'Select at least one fee head' });
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error(Object.values(errs)[0]);
      return;
    }
    setErrors({});
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? t('packages.editPackage', { defaultValue: 'Edit Package' }) : t('packages.createPackage', { defaultValue: 'Create Package' })}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t('packages.name', { defaultValue: 'Package Name *' })}</Label>
            <Input placeholder={t('packages.namePlaceholder', { defaultValue: 'e.g. Full Boarder, Day Scholar + Bus' })} value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); if (errors.name) setErrors(er => ({ ...er, name: undefined })); }} />
            {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{t('packages.includedHeads', { defaultValue: 'Included Fee Heads *' })}</Label>
            <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
              {feeHeads.map(h => (
                <label key={h.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                  <input type="checkbox" checked={form.feeHeadIds.includes(h.id)} onChange={() => { toggleHead(h.id); if (errors.feeHeadIds) setErrors(er => ({ ...er, feeHeadIds: undefined })); }} />
                  <span className="flex-1">{h.name}</span>
                  {h.type !== 'GENERAL' && <span className="text-xs text-muted-foreground">{h.type === 'TRANSPORT' ? t('packages.autoRoute', { defaultValue: 'auto: route' }) : t('packages.autoRoom', { defaultValue: 'auto: room' })}</span>}
                </label>
              ))}
            </div>
            {errors.feeHeadIds && <p className="text-xs text-red-600">{errors.feeHeadIds}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{t('packages.bundlePrice', { defaultValue: 'Bundle Price (Rs.)' })}</Label>
            <Input type="number" min="0" step="0.01" placeholder={t('packages.bundlePricePlaceholder', { defaultValue: 'Leave blank = sum of individual fees' })} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            <p className="text-xs text-muted-foreground">{t('packages.priceHint', { defaultValue: 'A fixed bundle price replaces the itemized total of the included heads — set it lower to give a package discount.' })}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('packages.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('packages.saving', { defaultValue: 'Saving…' }) : isEdit ? t('packages.update', { defaultValue: 'Update' }) : t('packages.create', { defaultValue: 'Create' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FeePackagesTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(null);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['fee-packages'],
    queryFn: () => schoolFinanceApi.listPackages().then(r => r.data),
  });

  const { data: feeHeads = [] } = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => schoolFinanceApi.listFeeHeads().then(r => r.data),
  });

  const remove = useMutation({
    mutationFn: (id) => schoolFinanceApi.removePackage(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-packages'] }); toast.success(t('packages.deleted', { defaultValue: 'Package deleted' })); },
    onError: (e) => toast.error(e.response?.data?.message || t('packages.cannotDelete', { defaultValue: 'Cannot delete' })),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-sm text-muted-foreground max-w-xl">
          {t('packages.intro', { defaultValue: 'Packages bundle fee heads at one price — e.g. "Full Boarder" covering tuition, hostel and bus. Assign them from the Student Fees tab.' })}
        </p>
        <Button onClick={() => setDialog({})}>
          <Plus className="w-4 h-4 mr-1" /> {t('packages.createPackage', { defaultValue: 'Create Package' })}
        </Button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">{t('packages.loading', { defaultValue: 'Loading…' })}</div>
      ) : packages.length === 0 ? (
        <div className="p-12 text-center bg-white border border-border rounded-xl">
          <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t('packages.empty', { defaultValue: 'No packages yet. Create one to offer bundled pricing.' })}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map(p => (
            <div key={p.id} className={`bg-white border border-border rounded-xl p-4 space-y-3 ${p.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('packages.nStudents', { defaultValue: '{{count}} students', count: p._count?.students ?? 0 })}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setDialog(p)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => {
                    if (window.confirm(t('packages.deleteConfirm', { defaultValue: 'Delete package "{{name}}"?', name: p.name }))) remove.mutate(p.id);
                  }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {p.heads.map(h => <Badge key={h.id} variant="secondary" className="text-xs">{h.feeHead.name}</Badge>)}
              </div>
              <p className="text-lg font-bold tabular-nums">
                {p.price != null ? fmtRs(p.price) : <span className="text-sm font-medium text-muted-foreground">{t('packages.itemizedSum', { defaultValue: 'Sum of individual fees' })}</span>}
                {p.price != null && <span className="text-xs font-normal text-muted-foreground"> /{t('packages.month', { defaultValue: 'month' })}</span>}
              </p>
            </div>
          ))}
        </div>
      )}

      {dialog && <PackageDialog open={!!dialog} onClose={() => setDialog(null)} initial={dialog.id ? dialog : null} feeHeads={feeHeads.filter(h => h.isActive)} />}
    </div>
  );
}
