import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { academicYearsApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { CalendarDays, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const companyId = () => localStorage.getItem('easybooks_active_company') || '';

function AcademicYearDialog({ open, onClose, year }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = !!year;
  const [form, setForm] = useState({
    name: year?.name || '',
    startDate: year?.startDate ? year.startDate.split('T')[0] : '',
    endDate: year?.endDate ? year.endDate.split('T')[0] : '',
    isCurrent: year?.isCurrent || false,
  });

  const save = useMutation({
    mutationFn: (d) =>
      isEdit
        ? academicYearsApi.update(year.id, d)
        : academicYearsApi.create({ ...d, companyId: companyId() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academic-years'] });
      toast.success(isEdit ? t('years.yearUpdated', { defaultValue: 'Academic year updated' }) : t('years.yearCreated', { defaultValue: 'Academic year created' }));
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || t('years.failedToSave', { defaultValue: 'Failed to save' })),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      return toast.error(t('years.fieldsRequired', { defaultValue: 'Name, start date and end date are required' }));
    }
    save.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('years.editYear', { defaultValue: 'Edit Academic Year' }) : t('years.addYear', { defaultValue: 'Add Academic Year' })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>{t('years.yearName', { defaultValue: 'Year Name *' })}</Label>
            <Input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder={t('years.yearNamePlaceholder', { defaultValue: 'e.g. 2081-82' })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t('years.startDate', { defaultValue: 'Start Date *' })}</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('years.endDate', { defaultValue: 'End Date *' })}</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.isCurrent}
              onCheckedChange={v => setForm(p => ({ ...p, isCurrent: v }))}
            />
            <Label>{t('years.markAsCurrent', { defaultValue: 'Mark as current academic year' })}</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('years.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? t('years.saving', { defaultValue: 'Saving…' }) : isEdit ? t('years.update', { defaultValue: 'Update' }) : t('years.create', { defaultValue: 'Create' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AcademicYear() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState({ open: false, year: null });

  const { data: years = [], isLoading } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => academicYearsApi.list().then(r => r.data),
  });

  const remove = useMutation({
    mutationFn: (id) => academicYearsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['academic-years'] }); toast.success(t('years.yearDeleted', { defaultValue: 'Academic year deleted' })); },
    onError: (e) => toast.error(e.response?.data?.message || t('years.cannotDelete', { defaultValue: 'Cannot delete' })),
  });

  const handleDelete = (y) => {
    if (!window.confirm(t('years.confirmDelete', { defaultValue: 'Delete "{{name}}"?', name: y.name }))) return;
    remove.mutate(y.id);
  };

  const fmt = (d) => {
    try { return format(new Date(d), 'dd MMM yyyy'); } catch { return '—'; }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('years.title', { defaultValue: 'Academic Years' })}</h1>
        </div>
        <Button onClick={() => setDialog({ open: true, year: null })}>
          <Plus className="h-4 w-4 mr-1" /> {t('years.addYearButton', { defaultValue: 'Add Year' })}
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('years.yearHeader', { defaultValue: 'Year' })}</TableHead>
              <TableHead>{t('years.startDateHeader', { defaultValue: 'Start Date' })}</TableHead>
              <TableHead>{t('years.endDateHeader', { defaultValue: 'End Date' })}</TableHead>
              <TableHead>{t('years.statusHeader', { defaultValue: 'Status' })}</TableHead>
              <TableHead className="w-24">{t('years.actionsHeader', { defaultValue: 'Actions' })}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t('years.loading', { defaultValue: 'Loading…' })}</TableCell></TableRow>
            ) : years.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">{t('years.noYearsYet', { defaultValue: 'No academic years yet. Add your first year.' })}</TableCell></TableRow>
            ) : years.map(y => (
              <TableRow key={y.id}>
                <TableCell className="font-semibold">{y.name}</TableCell>
                <TableCell>{fmt(y.startDate)}</TableCell>
                <TableCell>{fmt(y.endDate)}</TableCell>
                <TableCell>
                  {y.isCurrent ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200">{t('years.current', { defaultValue: 'Current' })}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">{t('years.past', { defaultValue: 'Past' })}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setDialog({ open: true, year: y })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(y)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {dialog.open && (
        <AcademicYearDialog
          open={dialog.open}
          onClose={() => setDialog({ open: false, year: null })}
          year={dialog.year}
        />
      )}
    </div>
  );
}
