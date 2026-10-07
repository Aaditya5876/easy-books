import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { leaveApi } from '@/api';
import { useRole } from '@/lib/useRole';
import { confirm } from '@/lib/confirm';
import PageHeader from '../components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, CalendarDays, Check, X, Trash2, AlertTriangle } from 'lucide-react';

const STATUS_COLORS = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

const EMPTY_APPLY = { leaveTypeId: '', startDate: '', endDate: '', reason: '' };
const EMPTY_TYPE = { name: '', daysPerYear: '', isPaid: true };

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-NP', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export default function MyLeave() {
  const { t } = useTranslation();
  const { isAdmin, isAccountant } = useRole();
  const canApprove = isAdmin || isAccountant;
  const qc = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState(EMPTY_APPLY);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [typeForm, setTypeForm] = useState(EMPTY_TYPE);

  const { data: context, isLoading: contextLoading } = useQuery({
    queryKey: ['leave-self-context'],
    queryFn: () => leaveApi.selfContext().then(r => r.data),
  });

  const { data: myRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['leave-self-requests'],
    queryFn: () => leaveApi.selfRequests().then(r => r.data),
  });

  const { data: types = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => leaveApi.listTypes().then(r => r.data),
  });

  const { data: pendingApprovals = [], isLoading: approvalsLoading } = useQuery({
    queryKey: ['leave-pending-approvals'],
    queryFn: () => leaveApi.listRequests({ status: 'PENDING' }).then(r => r.data),
    enabled: canApprove,
  });

  const apply = useMutation({
    mutationFn: () => leaveApi.applySelf({
      leaveTypeId: applyForm.leaveTypeId,
      startDate: applyForm.startDate,
      endDate: applyForm.endDate,
      reason: applyForm.reason || undefined,
    }),
    onSuccess: () => {
      toast.success(t('myLeave.requestSubmitted', { defaultValue: 'Leave request submitted' }));
      setApplyOpen(false);
      setApplyForm(EMPTY_APPLY);
      qc.invalidateQueries({ queryKey: ['leave-self-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-pending-approvals'] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('myLeave.requestFailed', { defaultValue: 'Failed to submit request' })),
  });

  const cancelMine = useMutation({
    mutationFn: (id) => leaveApi.cancelSelf(id),
    onSuccess: () => {
      toast.success(t('myLeave.requestCancelled', { defaultValue: 'Leave request cancelled' }));
      qc.invalidateQueries({ queryKey: ['leave-self-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-self-context'] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('myLeave.cancelFailed', { defaultValue: 'Failed to cancel request' })),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => leaveApi.approve(id),
    onSuccess: () => {
      toast.success(t('myLeave.approved', { defaultValue: 'Leave request approved' }));
      qc.invalidateQueries({ queryKey: ['leave-pending-approvals'] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('myLeave.approveFailed', { defaultValue: 'Failed to approve' })),
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => leaveApi.reject(id),
    onSuccess: () => {
      toast.success(t('myLeave.rejected', { defaultValue: 'Leave request rejected' }));
      qc.invalidateQueries({ queryKey: ['leave-pending-approvals'] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('myLeave.rejectFailed', { defaultValue: 'Failed to reject' })),
  });

  const createType = useMutation({
    mutationFn: () => leaveApi.createType({
      name: typeForm.name,
      daysPerYear: parseFloat(typeForm.daysPerYear) || 0,
      isPaid: typeForm.isPaid,
    }),
    onSuccess: () => {
      toast.success(t('myLeave.typeCreated', { defaultValue: 'Leave type added' }));
      setTypeDialogOpen(false);
      setTypeForm(EMPTY_TYPE);
      qc.invalidateQueries({ queryKey: ['leave-types'] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('myLeave.typeCreateFailed', { defaultValue: 'Failed to add leave type' })),
  });

  const removeType = useMutation({
    mutationFn: (id) => leaveApi.removeType(id),
    onSuccess: () => {
      toast.success(t('myLeave.typeDeleted', { defaultValue: 'Leave type removed' }));
      qc.invalidateQueries({ queryKey: ['leave-types'] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || t('myLeave.typeDeleteFailed', { defaultValue: 'Cannot remove — in use by existing requests/balances' })),
  });

  async function handleCancel(id) {
    const ok = await confirm({ description: t('myLeave.confirmCancel', { defaultValue: 'Cancel this leave request?' }), variant: 'destructive' });
    if (ok) cancelMine.mutate(id);
  }

  async function handleRemoveType(type) {
    const ok = await confirm({ description: t('myLeave.confirmRemoveType', { defaultValue: 'Remove leave type "{{name}}"?', name: type.name }), variant: 'destructive' });
    if (ok) removeType.mutate(type.id);
  }

  const canCancel = (r) => r.status === 'PENDING' || r.status === 'APPROVED';

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t('myLeave.title', { defaultValue: 'Leave' })}
        subtitle={t('myLeave.subtitle', { defaultValue: 'Apply for leave and track your requests' })}
      >
        <Button className="gap-2" disabled={!types.length} onClick={() => setApplyOpen(true)} title={!types.length ? t('myLeave.noTypesYet', { defaultValue: 'No leave types set up yet' }) : undefined}>
          <Plus className="w-4 h-4" /> {t('myLeave.applyForLeave', { defaultValue: 'Apply for Leave' })}
        </Button>
      </PageHeader>

      {/* Not linked warning */}
      {!contextLoading && context && !context.linked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            {t('myLeave.notLinked', { defaultValue: 'No employee record is linked to your account yet. Ask an admin to set your employee email to match your login email.' })}
          </p>
        </div>
      )}

      {/* Balance cards */}
      {context?.linked && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {context.balances.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-full">{t('myLeave.noBalanceYet', { defaultValue: 'No leave balance allocated yet for this fiscal year.' })}</p>
          ) : context.balances.map(b => (
            <div key={b.id} className="bg-white rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{b.leaveType.name}</p>
              <p className="text-2xl font-bold mt-1 tabular-nums">{Number(b.remainingDays)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('myLeave.ofDays', { defaultValue: 'of {{total}} days left', total: Number(b.totalDays) })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* My requests */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{t('myLeave.myRequests', { defaultValue: 'My Requests' })}</h2>
        </div>
        {requestsLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">{t('common.loading', { defaultValue: 'Loading…' })}</div>
        ) : myRequests.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">{t('myLeave.noRequestsYet', { defaultValue: 'No leave requests yet' })}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('myLeave.type', { defaultValue: 'Type' })}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('myLeave.dates', { defaultValue: 'Dates' })}</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('myLeave.days', { defaultValue: 'Days' })}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('myLeave.status', { defaultValue: 'Status' })}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myRequests.map(r => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3">{r.leaveType?.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{Number(r.totalDays)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || ''}`}>{r.status}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canCancel(r) && (
                        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-red-600" onClick={() => handleCancel(r.id)}>
                          {t('myLeave.cancel', { defaultValue: 'Cancel' })}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending approvals — ADMIN/ACCOUNTANT only */}
      {canApprove && (
        <div className="bg-white rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm">{t('myLeave.pendingApprovals', { defaultValue: 'Pending Approvals' })}</h2>
          </div>
          {approvalsLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t('common.loading', { defaultValue: 'Loading…' })}</div>
          ) : pendingApprovals.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t('myLeave.nothingPending', { defaultValue: 'Nothing awaiting approval' })}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('myLeave.employee', { defaultValue: 'Employee' })}</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('myLeave.type', { defaultValue: 'Type' })}</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('myLeave.dates', { defaultValue: 'Dates' })}</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('myLeave.days', { defaultValue: 'Days' })}</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingApprovals.map(r => (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="px-5 py-3 font-medium">{r.employee?.name}</td>
                      <td className="px-5 py-3">{r.leaveType?.name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{Number(r.totalDays)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="gap-1 text-emerald-700 hover:bg-emerald-50" onClick={() => approveMutation.mutate(r.id)}>
                            <Check className="w-3.5 h-3.5" /> {t('myLeave.approve', { defaultValue: 'Approve' })}
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1 text-red-600 hover:bg-red-50" onClick={() => rejectMutation.mutate(r.id)}>
                            <X className="w-3.5 h-3.5" /> {t('myLeave.reject', { defaultValue: 'Reject' })}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Leave Types — ADMIN only */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm">{t('myLeave.leaveTypes', { defaultValue: 'Leave Types' })}</h2>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTypeDialogOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> {t('myLeave.addType', { defaultValue: 'Add Type' })}
            </Button>
          </div>
          {types.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t('myLeave.noTypesYetHint', { defaultValue: 'No leave types yet — add one (e.g. "Annual Leave") so staff can apply.' })}</div>
          ) : (
            <div className="divide-y divide-border">
              {types.map(ty => (
                <div key={ty.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{ty.name}</p>
                    <p className="text-xs text-muted-foreground">{Number(ty.daysPerYear)} {t('myLeave.daysPerYear', { defaultValue: 'days/year' })} · {ty.isPaid ? t('myLeave.paid', { defaultValue: 'Paid' }) : t('myLeave.unpaid', { defaultValue: 'Unpaid' })}</p>
                  </div>
                  <button onClick={() => handleRemoveType(ty)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Apply dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('myLeave.applyForLeave', { defaultValue: 'Apply for Leave' })}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>{t('myLeave.leaveType', { defaultValue: 'Leave Type' })}</Label>
              <Select value={applyForm.leaveTypeId} onValueChange={v => setApplyForm(f => ({ ...f, leaveTypeId: v }))}>
                <SelectTrigger><SelectValue placeholder={t('myLeave.selectType', { defaultValue: 'Select type…' })} /></SelectTrigger>
                <SelectContent>
                  {types.map(ty => <SelectItem key={ty.id} value={ty.id}>{ty.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('myLeave.startDate', { defaultValue: 'Start Date' })}</Label>
                <Input type="date" value={applyForm.startDate} onChange={e => setApplyForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('myLeave.endDate', { defaultValue: 'End Date' })}</Label>
                <Input type="date" value={applyForm.endDate} onChange={e => setApplyForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('myLeave.reason', { defaultValue: 'Reason' })} <span className="text-muted-foreground">{t('myLeave.optional', { defaultValue: '(optional)' })}</span></Label>
              <Textarea rows={3} value={applyForm.reason} onChange={e => setApplyForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>{t('myLeave.cancelAction', { defaultValue: 'Cancel' })}</Button>
            <Button
              disabled={apply.isPending || !applyForm.leaveTypeId || !applyForm.startDate || !applyForm.endDate}
              onClick={() => apply.mutate()}
            >
              {apply.isPending ? t('myLeave.submitting', { defaultValue: 'Submitting…' }) : t('myLeave.submitRequest', { defaultValue: 'Submit Request' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add leave type dialog */}
      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('myLeave.addType', { defaultValue: 'Add Type' })}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>{t('myLeave.typeName', { defaultValue: 'Name' })}</Label>
              <Input placeholder={t('myLeave.typeNamePlaceholder', { defaultValue: 'e.g. Annual Leave, Sick Leave' })} value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('myLeave.daysPerYear', { defaultValue: 'Days / Year' })}</Label>
              <Input type="number" min="0" step="0.5" value={typeForm.daysPerYear} onChange={e => setTypeForm(f => ({ ...f, daysPerYear: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="isPaid" checked={typeForm.isPaid} onCheckedChange={v => setTypeForm(f => ({ ...f, isPaid: v === true }))} />
              <Label htmlFor="isPaid" className="cursor-pointer font-normal">{t('myLeave.paidLeave', { defaultValue: 'Paid leave' })}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeDialogOpen(false)}>{t('myLeave.cancelAction', { defaultValue: 'Cancel' })}</Button>
            <Button disabled={createType.isPending || !typeForm.name.trim()} onClick={() => createType.mutate()}>
              {createType.isPending ? t('myLeave.saving', { defaultValue: 'Saving…' }) : t('myLeave.save', { defaultValue: 'Save' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
