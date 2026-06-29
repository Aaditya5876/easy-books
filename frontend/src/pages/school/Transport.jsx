import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Bus, UserMinus } from 'lucide-react';
import { transportApi, studentsApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const EMPTY_ROUTE = { routeName: '', description: '', stops: '', monthlyFee: 0, driverName: '', vehicleNumber: '' };

function RouteDialog({ open, onClose, initial, companyId }) {
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-routes'] }); toast.success(isEdit ? 'Updated' : 'Route added'); onClose(); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to save'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.routeName.trim()) { toast.error('Route name is required'); return; }
    save.mutate({ ...form, companyId, monthlyFee: Number(form.monthlyFee) });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Route' : 'Add Route'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Route Name *</Label>
            <Input placeholder="e.g. Kathmandu - Lalitpur" value={form.routeName} onChange={e => set('routeName', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Stops</Label>
            <Input placeholder="e.g. Chabahil, Baudha, Thimi" value={form.stops} onChange={e => set('stops', e.target.value)} />
            <p className="text-xs text-muted-foreground">Comma-separated list of stops</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Driver Name</Label>
              <Input placeholder="Driver name" value={form.driverName} onChange={e => set('driverName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Vehicle Number</Label>
              <Input placeholder="e.g. Ba 1 Cha 1234" value={form.vehicleNumber} onChange={e => set('vehicleNumber', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Monthly Fee (Rs.)</Label>
            <Input type="number" min="0" value={form.monthlyFee} onChange={e => set('monthlyFee', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Route'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ open, onClose, routes, students, companyId }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ routeId: '', studentId: '', pickupStop: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const assign = useMutation({
    mutationFn: (data) => transportApi.assign(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transport-assignments'] });
      toast.success('Student assigned to route');
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.routeId) { toast.error('Select a route'); return; }
    if (!form.studentId) { toast.error('Select a student'); return; }
    assign.mutate({ companyId, routeId: form.routeId, studentId: form.studentId, pickupStop: form.pickupStop || undefined });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Assign Student to Route</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Route *</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.routeId} onChange={e => set('routeId', e.target.value)}>
              <option value="">Select route…</option>
              {routes.map(r => <option key={r.id} value={r.id}>{r.routeName}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Student *</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.studentId} onChange={e => set('studentId', e.target.value)}>
              <option value="">Select student…</option>
              {students.filter(s => s.status === 'ACTIVE').map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.rollNumber ? ` (${s.rollNumber})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Pickup Stop</Label>
            <Input placeholder="e.g. Baudha" value={form.pickupStop} onChange={e => set('pickupStop', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={assign.isPending}>{assign.isPending ? 'Assigning…' : 'Assign'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Transport() {
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

  const { data: allStudents = [] } = useQuery({
    queryKey: ['school-students', companyId],
    queryFn: () => studentsApi.list().then(r => r.data),
    enabled: !!companyId,
  });

  const removeRoute = useMutation({
    mutationFn: (id) => transportApi.removeRoute(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-routes'] }); toast.success('Route deleted'); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Cannot delete'),
  });

  const unassign = useMutation({
    mutationFn: (id) => transportApi.unassign(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-assignments'] }); toast.success('Student unassigned'); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  const fmtAmt = (n) => `Rs. ${Number(n).toLocaleString('en-NP')}`;

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transport Management</h1>
          <p className="text-muted-foreground text-sm mt-1">{routes.length} routes configured</p>
        </div>
        <div className="flex gap-2">
          {tab === 'students' && (
            <Button variant="outline" onClick={() => setAssignDialog(true)}>
              <Plus className="w-4 h-4 mr-2" /> Assign Student
            </Button>
          )}
          {tab === 'routes' && (
            <Button onClick={() => setRouteDialog({ mode: 'add' })}>
              <Plus className="w-4 h-4 mr-2" /> Add Route
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        {[['routes', 'Routes'], ['students', 'Student Assignments']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'routes' && (
        <div className="space-y-3">
          {loadingRoutes ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
          ) : routes.length === 0 ? (
            <div className="p-12 text-center">
              <Bus className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No transport routes yet.</p>
            </div>
          ) : routes.map(route => (
            <div key={route.id} className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <Bus className="w-4 h-4 text-sky-600 shrink-0" />
                    <p className="font-semibold">{route.routeName}</p>
                    <span className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
                      {route._count?.studentTransports || 0} students
                    </span>
                  </div>
                  {route.stops && (
                    <p className="text-xs text-muted-foreground mt-1 ml-7">Stops: {route.stops}</p>
                  )}
                  <div className="flex gap-4 mt-2 ml-7 text-xs text-muted-foreground flex-wrap">
                    {route.driverName && <span>Driver: {route.driverName}</span>}
                    {route.vehicleNumber && <span>Vehicle: {route.vehicleNumber}</span>}
                    {route.monthlyFee > 0 && <span className="text-emerald-700 font-medium">{fmtAmt(route.monthlyFee)}/month</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setRouteDialog({ mode: 'edit', route })} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { if (confirm(`Delete "${route.routeName}"?`)) removeRoute.mutate(route.id); }}
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
            <option value="">All Routes</option>
            {routes.map(r => <option key={r.id} value={r.id}>{r.routeName}</option>)}
          </select>
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            {loadingAssignments ? (
              <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
            ) : assignments.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">No students assigned to transport routes.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Student</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Class</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Route</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Pickup Stop</th>
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
                        <button onClick={() => { if (confirm(`Remove ${a.student?.name} from transport?`)) unassign.mutate(a.id); }}
                          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors">
                          <UserMinus className="w-3.5 h-3.5" /> Remove
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
        <AssignDialog open={assignDialog} onClose={() => setAssignDialog(false)} routes={routes} students={allStudents} companyId={companyId} />
      )}
    </div>
  );
}
