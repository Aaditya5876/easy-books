import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { schoolFinanceApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Sparkles, Bus, Home, Tag } from 'lucide-react';
import { toast } from 'sonner';

function HeadDialog({ open, onClose, initial }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    name: initial?.name || '',
    code: initial?.code || '',
    type: initial?.type || 'GENERAL',
  });

  const save = useMutation({
    mutationFn: () => isEdit
      ? schoolFinanceApi.updateFeeHead(initial.id, form)
      : schoolFinanceApi.createFeeHead(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-heads'] });
      toast.success(isEdit ? t('feeHeads.updated', { defaultValue: 'Fee head updated' }) : t('feeHeads.created', { defaultValue: 'Fee head created' }));
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || t('feeHeads.failedToSave', { defaultValue: 'Failed to save' })),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error(t('feeHeads.nameRequired', { defaultValue: 'Name is required' }));
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{isEdit ? t('feeHeads.editHead', { defaultValue: 'Edit Fee Head' }) : t('feeHeads.addHead', { defaultValue: 'Add Fee Head' })}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t('feeHeads.name', { defaultValue: 'Name *' })}</Label>
            <Input placeholder={t('feeHeads.namePlaceholder', { defaultValue: 'e.g. Tuition Fee, Lab Fee' })} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('feeHeads.code', { defaultValue: 'Code' })}</Label>
              <Input placeholder="TUI" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('feeHeads.type', { defaultValue: 'Type' })}</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="GENERAL">{t('feeHeads.typeGeneral', { defaultValue: 'General' })}</option>
                <option value="TRANSPORT">{t('feeHeads.typeTransport', { defaultValue: 'Transport (auto from route)' })}</option>
                <option value="HOSTEL">{t('feeHeads.typeHostel', { defaultValue: 'Hostel (auto from room)' })}</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('feeHeads.typeHint', { defaultValue: 'Transport/Hostel heads bill automatically from the student’s actual route or room — no structure needed.' })}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('feeHeads.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('feeHeads.saving', { defaultValue: 'Saving…' }) : isEdit ? t('feeHeads.update', { defaultValue: 'Update' }) : t('feeHeads.add', { defaultValue: 'Add' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FeeHeadsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(null);

  const { data: heads = [], isLoading } = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => schoolFinanceApi.listFeeHeads().then(r => r.data),
  });

  const createDefaults = useMutation({
    mutationFn: () => schoolFinanceApi.createDefaultFeeHeads(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['fee-heads'] });
      toast.success(t('feeHeads.defaultsCreated', { defaultValue: '{{count}} standard fee heads created', count: res.data.created }));
    },
    onError: (e) => toast.error(e.response?.data?.message || t('feeHeads.failed', { defaultValue: 'Failed' })),
  });

  const remove = useMutation({
    mutationFn: (id) => schoolFinanceApi.removeFeeHead(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-heads'] }); toast.success(t('feeHeads.removed', { defaultValue: 'Fee head removed' })); },
    onError: (e) => toast.error(e.response?.data?.message || t('feeHeads.cannotDelete', { defaultValue: 'Cannot delete' })),
  });

  const typeBadge = (type) =>
    type === 'TRANSPORT' ? <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100"><Bus className="w-3 h-3 mr-1" />{t('feeHeads.typeTransportShort', { defaultValue: 'Transport' })}</Badge>
    : type === 'HOSTEL' ? <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100"><Home className="w-3 h-3 mr-1" />{t('feeHeads.typeHostelShort', { defaultValue: 'Hostel' })}</Badge>
    : <Badge variant="secondary"><Tag className="w-3 h-3 mr-1" />{t('feeHeads.typeGeneralShort', { defaultValue: 'General' })}</Badge>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-sm text-muted-foreground max-w-xl">
          {t('feeHeads.intro', { defaultValue: 'Fee heads are your charge types — every invoice line and income report is grouped by them.' })}
        </p>
        <div className="flex gap-2">
          {heads.length === 0 && (
            <Button variant="outline" onClick={() => createDefaults.mutate()} disabled={createDefaults.isPending}>
              <Sparkles className="w-4 h-4 mr-1" /> {t('feeHeads.createDefaults', { defaultValue: 'Create Standard Heads' })}
            </Button>
          )}
          <Button onClick={() => setDialog({})}>
            <Plus className="w-4 h-4 mr-1" /> {t('feeHeads.addHead', { defaultValue: 'Add Fee Head' })}
          </Button>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t('feeHeads.loading', { defaultValue: 'Loading…' })}</div>
        ) : heads.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {t('feeHeads.empty', { defaultValue: 'No fee heads yet — create the standard set to get started.' })}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('feeHeads.nameHeader', { defaultValue: 'Name' })}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('feeHeads.codeHeader', { defaultValue: 'Code' })}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('feeHeads.typeHeader', { defaultValue: 'Type' })}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('feeHeads.statusHeader', { defaultValue: 'Status' })}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {heads.map(h => (
                <tr key={h.id} className={h.isActive ? '' : 'opacity-50'}>
                  <td className="px-5 py-3 font-medium">{h.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{h.code || '—'}</td>
                  <td className="px-5 py-3">{typeBadge(h.type)}</td>
                  <td className="px-5 py-3">
                    {h.isActive
                      ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{t('feeHeads.active', { defaultValue: 'Active' })}</Badge>
                      : <Badge variant="secondary">{t('feeHeads.inactive', { defaultValue: 'Inactive' })}</Badge>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => setDialog(h)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => {
                        if (window.confirm(t('feeHeads.deleteConfirm', { defaultValue: 'Delete "{{name}}"? If it has billing history it will be deactivated instead.', name: h.name }))) remove.mutate(h.id);
                      }}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {dialog && <HeadDialog open={!!dialog} onClose={() => setDialog(null)} initial={dialog.id ? dialog : null} />}
    </div>
  );
}
