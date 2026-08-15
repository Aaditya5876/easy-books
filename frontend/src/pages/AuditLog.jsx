import { useState, useEffect } from 'react';
import { api } from '@/api/adapter';
import { getActiveCompanyId } from '@/lib/companyContext';
import { describeAuditLog } from '@/lib/describeAuditLog';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Shield, Eye } from 'lucide-react';

const ACTION_DOT = {
  create: 'bg-green-500',
  update: 'bg-amber-500',
  delete: 'bg-red-500',
};

export default function AuditLog() {
  const companyId = getActiveCompanyId();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [viewingChanges, setViewingChanges] = useState(null);

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId, dateFrom, dateTo, moduleFilter, actionFilter]);

  async function loadData() {
    setLoading(true);
    const data = await api.AuditLog.filter({
      company_id: companyId,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      module: moduleFilter || undefined,
      action: actionFilter || undefined,
      limit: 200,
    });
    setLogs(data);
    setLoading(false);
  }

  const filtered = logs.filter(l =>
    !userFilter || (l.user_email || '').toLowerCase().includes(userFilter.toLowerCase())
  );

  const columns = [
    { key: 'created_at', label: 'When', render: (row) => (
      <span className="text-xs font-mono whitespace-nowrap">{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</span>
    )},
    { key: 'summary', label: 'What happened', render: (row) => (
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${ACTION_DOT[(row.action || '').toLowerCase()] || 'bg-muted-foreground'}`} />
        <span className="text-sm">{describeAuditLog(row)}</span>
      </div>
    )},
    { key: 'changes', label: '', render: (row) => (
      row.changes ? (
        <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => setViewingChanges(row)}>
          <Eye className="w-3.5 h-3.5" /> Details
        </Button>
      ) : null
    )},
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Audit Log"
        subtitle="Who did what, and when — every create/update/delete across the system"
      />

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <Label className="text-xs font-medium">From Date</Label>
            <Input type="date" className="h-9 text-sm mt-1" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <Label className="text-xs font-medium">To Date</Label>
            <Input type="date" className="h-9 text-sm mt-1" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <Label className="text-xs font-medium">User Email</Label>
            <Input className="h-9 text-sm mt-1" placeholder="Search by user..." value={userFilter} onChange={e => setUserFilter(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <Label className="text-xs font-medium">Module</Label>
            <Input className="h-9 text-sm mt-1" placeholder="e.g. transactions" value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <Label className="text-xs font-medium">Action</Label>
            <select
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
            </select>
          </div>
          <Button
            variant="outline"
            onClick={() => { setDateFrom(''); setDateTo(''); setModuleFilter(''); setActionFilter(''); setUserFilter(''); }}
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No activity recorded yet"
          description="Every create, update, or delete anyone makes will show up here."
        />
      ) : (
        <DataTable columns={columns} data={filtered} emptyMessage="No matching activity" />
      )}

      <Dialog open={!!viewingChanges} onOpenChange={open => !open && setViewingChanges(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingChanges ? describeAuditLog(viewingChanges) : ''}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            {viewingChanges?.action} · {viewingChanges?.module} · {viewingChanges?.created_at ? new Date(viewingChanges.created_at).toLocaleString() : ''}
          </p>
          <pre className="text-xs bg-muted rounded-lg p-4 overflow-auto max-h-[60vh]">
            {viewingChanges ? JSON.stringify(viewingChanges.changes, null, 2) : ''}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
