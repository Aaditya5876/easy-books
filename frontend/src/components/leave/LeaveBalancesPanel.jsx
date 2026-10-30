import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { employeeApi, leaveApi } from '@/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Each leave type's "days per year" is every employee's default allowance —
// this panel overrides it for one employee (e.g. extra annual leave).
export default function LeaveBalancesPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [employeeId, setEmployeeId] = useState('');
  const [edits, setEdits] = useState({});

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-for-leave'],
    queryFn: () => employeeApi.list().then(r => r.data),
  });
  const { data: balances = [], isLoading } = useQuery({
    queryKey: ['leave-balances', employeeId],
    queryFn: () => leaveApi.balances(employeeId).then(r => r.data),
    enabled: !!employeeId,
  });

  const save = useMutation({
    mutationFn: (b) => leaveApi.allocate({ employeeId, leaveTypeId: b.leaveTypeId, fiscalYear: b.fiscalYear, totalDays: Number(edits[b.id]) }),
    onSuccess: (_r, b) => {
      toast.success(t('myLeave.balanceSaved', { defaultValue: 'Leave balance updated' }));
      setEdits(e => { const n = { ...e }; delete n[b.id]; return n; });
      qc.invalidateQueries({ queryKey: ['leave-balances', employeeId] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('myLeave.balanceSaveFailed', { defaultValue: 'Could not update the balance' })),
  });

  return (
    <div className="bg-white rounded-xl border border-border">
      <div className="px-5 py-4 border-b border-border space-y-1">
        <h2 className="font-semibold text-sm">{t('myLeave.balances', { defaultValue: 'Leave Balances' })}</h2>
        <p className="text-xs text-muted-foreground">{t('myLeave.balancesHint', { defaultValue: "Everyone gets each leave type's days per year automatically. Change one person's allowance here." })}</p>
      </div>
      <div className="p-5 space-y-4">
        <Select value={employeeId} onValueChange={(v) => { setEmployeeId(v); setEdits({}); }}>
          <SelectTrigger className="max-w-sm"><SelectValue placeholder={t('myLeave.selectEmployee', { defaultValue: 'Select an employee…' })} /></SelectTrigger>
          <SelectContent>
            {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}{e.designation ? ` · ${e.designation}` : ''}</SelectItem>)}
          </SelectContent>
        </Select>

        {employeeId && (isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading', { defaultValue: 'Loading…' })}</p>
        ) : balances.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('myLeave.noLimitedTypes', { defaultValue: 'No leave types with a yearly allowance yet.' })}</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {balances.map(b => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1 min-w-[140px] font-medium">{b.leaveType?.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t('myLeave.usedOf', { defaultValue: '{{used}} used · {{remaining}} left', used: Number(b.usedDays), remaining: Number(b.remainingDays) })}
                </span>
                <Input
                  type="number" min={0} className="w-20 h-8"
                  value={edits[b.id] ?? Number(b.totalDays)}
                  onChange={e => setEdits(x => ({ ...x, [b.id]: e.target.value }))}
                  aria-label={t('myLeave.totalDays', { defaultValue: 'Total days' })}
                />
                <Button
                  size="sm" variant="outline"
                  disabled={edits[b.id] === undefined || edits[b.id] === '' || Number(edits[b.id]) < 0 || save.isPending}
                  onClick={() => save.mutate(b)}
                >
                  {t('common.save', { defaultValue: 'Save' })}
                </Button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
