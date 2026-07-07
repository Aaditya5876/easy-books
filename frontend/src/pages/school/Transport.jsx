import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Bus, UserMinus } from 'lucide-react';
import { transportApi } from '@/api';
import StudentCombobox from '@/components/shared/StudentCombobox';
import { getActiveCompanyId } from '@/lib/companyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const EMPTY_ROUTE = { routeName: '', description: '', stops: '', monthlyFee: 0, driverName: '', vehicleNumber: '' };

function RouteDialog({ open, onClose, initial, companyId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(initial ? {
    routeName: initial.routeName, description: initial.description || '',
    stops: initial.stops || '', monthlyFee: initial.monthlyFee,
    driverName: initial.driverName || '', vehicleNumber: initial.vehicleNumber || '',
  } : EMPTY_ROUTE);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (data) => isEdit ? transportApi.updateRoute(initial.id, data) : transportApi.createRoute(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-routes'] }); toast.success(isEdit ? t('transport.updated', { defaultValue: 'Updated' }) : t('transport.routeAdded', { defaultValue: 'Route added' })); onClose(); },
    onError: (err) => toast.error(err?.response?.data?.message || t('transport.failedToSave', { defaultValue: 'Failed to save' })),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.routeName.trim()) { toast.error(t('transport.routeNameRequired', { defaultValue: 'Route name is required' })); return; }
    save.mutate({ ...form, companyId, monthlyFee: Number(form.monthlyFee) });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? t('transport.editRoute', { defaultValue: 'Edit Route' }) : t('transport.addRoute', { defaultValue: 'Add Route' })}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t('transport.routeNameLabel', { defaultValue: 'Route Name *' })}</Label>
            <Input placeholder={t('transport.routeNamePlaceholder', { defaultValue: 'e.g. Kathmandu - Lalitpur' })} value={form.routeName} onChange={e => set('routeName', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('transport.stops', { defaultValue: 'Stops' })}</Label>
            <Input placeholder={t('transport.stopsPlaceholder', { defaultValue: 'e.g. Chabahil, Baudha, Thimi' })} value={form.stops} onChange={e => set('stops', e.target.value)} />
            <p className="text-xs text-muted-foreground">{t('transport.stopsHint', { defaultValue: 'Comma-separated list of stops' })}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('transport.driverName', { defaultValue: 'Driver Name' })}</Label>
              <Input placeholder={t('transport.driverNamePlaceholder', { defaultValue: 'Driver name' })} value={form.driverName} onChange={e => set('driverName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('transport.vehicleNumber', { defaultValue: 'Vehicle Number' })}</Label>
              <Input placeholder={t('transport.vehicleNumberPlaceholder', { defaultValue: 'e.g. Ba 1 Cha 1234' })} value={form.vehicleNumber} onChange={e => set('vehicleNumber', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('transport.monthlyFee', { defaultValue: 'Monthly Fee (Rs.)' })}</Label>
            <Input type="number" min="0" value={form.monthlyFee} onChange={e => set('monthlyFee', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('transport.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('transport.saving', { defaultValue: 'Saving…' }) : isEdit ? t('transport.saveChanges', { defaultValue: 'Save Changes' }) : t('transport.addRoute', { defaultValue: 'Add Route' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ open, onClose, routes, companyId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState({ routeId: '', studentId: '', pickupStop: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const assign = useMutation({
    mutationFn: (data) => transportApi.assign(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transport-assignments'] });
      toast.success(t('transport.studentAssigned', { defaultValue: 'Student assigned to route' }));
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('transport.failed', { defaultValue: 'Failed' })),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.routeId) { toast.error(t('transport.selectARoute', { defaultValue: 'Select a route' })); return; }
    if (!form.studentId) { toast.error(t('transport.selectAStudent', { defaultValue: 'Select a student' })); return; }
    assign.mutate({ companyId, routeId: form.routeId, studentId: form.studentId, pickupStop: form.pickupStop || undefined });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('transport.assignStudentToRoute', { defaultValue: 'Assign Student to Route' })}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t('transport.routeLabel', { defaultValue: 'Route *' })}</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.routeId} onChange={e => set('routeId', e.target.value)}>
              <option value="">{t('transport.selectRoute', { defaultValue: 'Select route…' })}</option>
              {routes.map(r => <option key={r.id} value={r.id}>{r.routeName}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('transport.studentLabel', { defaultValue: 'Student *' })}</Label>
            <StudentCombobox
              value={form.studentId}
              onChange={id => set('studentId', id)}
              placeholder={t('transport.selectStudent', { defaultValue: 'Select student…' })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('transport.pickupStop', { defaultValue: 'Pickup Stop' })}</Label>
            <Input placeholder={t('transport.pickupStopPlaceholder', { defaultValue: 'e.g. Baudha' })} value={form.pickupStop} onChange={e => set('pickupStop', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('transport.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="submit" disabled={assign.isPending}>{assign.isPending ? t('transport.assigning', { defaultValue: 'Assigning…' }) : t('transport.assign', { defaultValue: 'Assign' })}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Transport() {
  const { t } = useTranslation();
  const companyId = getActiveCompanyId();
  const qc = useQueryClient();
  const [tab, setTab] = useState('routes');
  const [routeDialog, setRouteDialog] = useState(null);
  const [assignDialog, setAssignDialog] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState('');

  const { data: routes = [], isLoading: loadingRoutes } = useQuery({
    queryKey: ['transport-routes', companyId],
    queryFn: () => transportApi.listRoutes().then(r => r.data),
    enabled: !!companyId,
  });

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['transport-assignments', companyId, selectedRoute],
    queryFn: () => transportApi.listAssignments(selectedRoute || undefined).then(r => r.data),
    enabled: !!companyId && tab === 'students',
  });

  const removeRoute = useMutation({
    mutationFn: (id) => transportApi.removeRoute(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-routes'] }); toast.success(t('transport.routeDeleted', { defaultValue: 'Route deleted' })); },
    onError: (err) => toast.error(err?.response?.data?.message || t('transport.cannotDelete', { defaultValue: 'Cannot delete' })),
  });

  const unassign = useMutation({
    mutationFn: (id) => transportApi.unassign(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-assignments'] }); toast.success(t('transport.studentUnassigned', { defaultValue: 'Student unassigned' })); },
    onError: (err) => toast.error(err?.response?.data?.message || t('transport.failed', { defaultValue: 'Failed' })),
  });

  const fmtAmt = (n) => `Rs. ${Number(n).toLocaleString('en-NP')}`;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('transport.title', { defaultValue: 'Transport Management' })}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('transport.nRoutesConfigured', { defaultValue: '{{count}} routes configured', count: routes.length })}</p>
        </div>
        <div className="flex gap-2">
          {tab === 'students' && (
            <Button variant="outline" onClick={() => setAssignDialog(true)}>
              <Plus className="w-4 h-4 mr-2" /> {t('transport.assignStudent', { defaultValue: 'Assign Student' })}
            </Button>
          )}
          {tab === 'routes' && (
            <Button onClick={() => setRouteDialog({ mode: 'add' })}>
              <Plus className="w-4 h-4 mr-2" /> {t('transport.addRoute', { defaultValue: 'Add Route' })}
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        {[['routes', t('transport.routesTab', { defaultValue: 'Routes' })], ['students', t('transport.assignmentsTab', { defaultValue: 'Student Assignments' })]].map(([tabKey, label]) => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === tabKey ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'routes' && (
        <div className="space-y-3">
          {loadingRoutes ? (
            <div className="p-12 text-center text-muted-foreground text-sm">{t('transport.loading', { defaultValue: 'Loading…' })}</div>
          ) : routes.length === 0 ? (
            <div className="p-12 text-center">
              <Bus className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t('transport.noRoutesYet', { defaultValue: 'No transport routes yet.' })}</p>
            </div>
          ) : routes.map(route => (
            <div key={route.id} className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <Bus className="w-4 h-4 text-sky-600 shrink-0" />
                    <p className="font-semibold">{route.routeName}</p>
                    <span className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
                      {t('transport.nStudents', { defaultValue: '{{count}} students', count: route._count?.studentTransports || 0 })}
                    </span>
                  </div>
                  {route.stops && (
                    <p className="text-xs text-muted-foreground mt-1 ml-7">{t('transport.stopsColon', { defaultValue: 'Stops: {{stops}}', stops: route.stops })}</p>
                  )}
                  <div className="flex gap-4 mt-2 ml-7 text-xs text-muted-foreground flex-wrap">
                    {route.driverName && <span>{t('transport.driverColon', { defaultValue: 'Driver: {{name}}', name: route.driverName })}</span>}
                    {route.vehicleNumber && <span>{t('transport.vehicleColon', { defaultValue: 'Vehicle: {{number}}', number: route.vehicleNumber })}</span>}
                    {route.monthlyFee > 0 && <span className="text-emerald-700 font-medium">{t('transport.perMonth', { defaultValue: '{{amount}}/month', amount: fmtAmt(route.monthlyFee) })}</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setRouteDialog({ mode: 'edit', route })} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { if (confirm(t('transport.deleteConfirm', { defaultValue: 'Delete "{{name}}"?', name: route.routeName }))) removeRoute.mutate(route.id); }}
                    className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'students' && (
        <>
          <select className="border rounded-md px-3 py-2 text-sm bg-background" value={selectedRoute} onChange={e => setSelectedRoute(e.target.value)}>
            <option value="">{t('transport.allRoutes', { defaultValue: 'All Routes' })}</option>
            {routes.map(r => <option key={r.id} value={r.id}>{r.routeName}</option>)}
          </select>
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            {loadingAssignments ? (
              <div className="p-12 text-center text-muted-foreground text-sm">{t('transport.loading', { defaultValue: 'Loading…' })}</div>
            ) : assignments.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">{t('transport.noAssignments', { defaultValue: 'No students assigned to transport routes.' })}</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('transport.student', { defaultValue: 'Student' })}</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('transport.class', { defaultValue: 'Class' })}</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('transport.route', { defaultValue: 'Route' })}</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('transport.pickupStop', { defaultValue: 'Pickup Stop' })}</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assignments.map(a => (
                    <tr key={a.id} className="hover:bg-muted/20">
                      <td className="px-5 py-3 font-medium">{a.student?.name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{a.student?.class ? `${a.student.class.name}${a.student.class.section ? ` (${a.student.class.section})` : ''}` : '—'}</td>
                      <td className="px-5 py-3">{a.route?.routeName}</td>
                      <td className="px-5 py-3 text-muted-foreground">{a.pickupStop || '—'}</td>
                      <td className="px-5 py-3">
                        <button onClick={() => { if (confirm(t('transport.removeConfirm', { defaultValue: 'Remove {{name}} from transport?', name: a.student?.name }))) unassign.mutate(a.id); }}
                          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors">
                          <UserMinus className="w-3.5 h-3.5" /> {t('transport.remove', { defaultValue: 'Remove' })}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {routeDialog && (
        <RouteDialog open={!!routeDialog} onClose={() => setRouteDialog(null)} initial={routeDialog.mode === 'edit' ? routeDialog.route : null} companyId={companyId} />
      )}
      {assignDialog && (
        <AssignDialog open={assignDialog} onClose={() => setAssignDialog(false)} routes={routes} companyId={companyId} />
      )}
    </div>
  );
}
