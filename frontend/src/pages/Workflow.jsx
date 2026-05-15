import { useState, useEffect } from 'react';
import { api, apiAuth } from '@/api/adapter';
import { getActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function Workflow() {
  const companyId = getActiveCompanyId();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    assigned_to: '',
    due_date: '',
    due_time: '',
    priority: 'medium',
    assigned_name: '',
    assigned_contact: '',
    department: '',
    workflow_type: 'job_card',
    transaction_type: 'sales',
    vendor_client_name: '',
  });

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);
    const data = await api.Task.filter({ company_id: companyId });
    setTasks(data);
    setLoading(false);
  }

  async function createTask() {
    try {
      console.log('createTask called', form);
      const user = await apiAuth.me();
      const payload = {
        ...form,
        company_id: companyId,
        assigned_by: user.email,
        status: 'pending',
      };
      console.log('creating task with payload', payload);
      await api.Task.create(payload);
      setForm({ title: '', description: '', assigned_to: '', due_date: '', due_time: '', priority: 'medium', assigned_name: '', assigned_contact: '', department: '', workflow_type: 'job_card', transaction_type: 'sales', vendor_client_name: '' });
      setShowNew(false);
      await loadData();
    } catch (err) {
      console.error('Error creating task', err);
      alert('Error creating task: ' + (err?.message || err));
    }
  }

  async function updateTaskStatus(taskId, status) {
    await api.Task.update(taskId, { status });
    loadData();
  }

  const statusColors = {
    pending: 'bg-amber-100 text-amber-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-slate-100 text-slate-700',
  };

  const statusIcons = {
    pending: Clock,
    in_progress: AlertCircle,
    completed: CheckCircle,
  };

  const cardBg = {
    pending: 'from-amber-50 via-white to-amber-100',
    in_progress: 'from-sky-50 via-white to-sky-100',
    completed: 'from-emerald-50 via-white to-emerald-100',
    cancelled: 'from-slate-50 via-white to-slate-100',
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status === b.status) return new Date(a.due_date || '').getTime() - new Date(b.due_date || '').getTime();
    const order = ['pending', 'in_progress', 'completed', 'cancelled'];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Workflow" subtitle="Job cards, order slips and task board" onAdd={() => setShowNew(true)} addLabel="New Task" />

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4">
          <p className="text-sm font-medium text-slate-500">Open Jobs</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{tasks.filter(t => t.status !== 'completed').length}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4">
          <p className="text-sm font-medium text-slate-500">Completed</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{tasks.filter(t => t.status === 'completed').length}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4">
          <p className="text-sm font-medium text-slate-500">Assigned Team</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{new Set(tasks.map(t => t.assigned_name || t.assigned_to).filter(Boolean)).size}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedTasks.length === 0 && (
          <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-white/80 p-12 text-center text-slate-500">
            No workflow tasks found. Create a new task to display it here.
          </div>
        )}

        {sortedTasks.map(task => {
          const Icon = statusIcons[task.status] || Clock;
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => setSelectedTask(task)}
              className={`group relative overflow-hidden rounded-[28px] border border-slate-200 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg bg-gradient-to-br ${cardBg[task.status] || cardBg.pending}`}
            >
              <div className="absolute inset-x-0 top-0 h-3 bg-white/70" />
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{task.id ? `#${task.id}` : 'JOB'} </p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">{task.title || 'Untitled task'}</h2>
                </div>
                <Badge className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]" variant="secondary">{task.status?.replace('_', ' ') || 'Pending'}</Badge>
              </div>

              <div className="space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 px-3 py-2">
                  <span className="text-slate-500">Assigned</span>
                  <span className="font-medium">{task.assigned_name || task.assigned_to || 'Unassigned'}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/80 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Assigned</p>
                    <p className="mt-1 font-medium">{task.created_date ? new Date(task.created_date).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Due</p>
                    <p className="mt-1 font-medium">{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
                <Icon className="w-4 h-4" />
                <span>Tap for full details</span>
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={!!selectedTask} onOpenChange={open => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle className="text-lg">{selectedTask?.title}</DialogTitle></DialogHeader>
          {selectedTask && (
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Assigned To</p>
                  <p className="font-medium">{selectedTask.assigned_name || selectedTask.assigned_to || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{selectedTask.status?.replace('_', ' ') || 'Pending'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Assigned Date</p>
                  <p className="font-medium">{selectedTask.created_date ? new Date(selectedTask.created_date).toLocaleDateString() : '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Due Date</p>
                  <p className="font-medium">{selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Priority</p>
                  <Badge className="rounded-full px-2 py-0.5 text-xs uppercase" variant="secondary">{selectedTask.priority || 'medium'}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Contact</p>
                  <p className="font-medium">{selectedTask.assigned_contact || '—'}</p>
                </div>
              </div>
              {selectedTask.description && (
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Description</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedTask.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTask(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Workflow Task</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Task Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.workflow_type} onValueChange={v => setForm({ ...form, workflow_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="job_card">Job Card</SelectItem>
                  <SelectItem value="order_slip">Order Slip</SelectItem>
                  <SelectItem value="general_assessments">General Assessments</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Transaction</Label>
              <Select value={form.transaction_type} onValueChange={v => setForm({ ...form, transaction_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select transaction..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.transaction_type && (
              <div>
                <Label>{form.transaction_type === 'purchase' ? 'Vendor' : 'Client'}</Label>
                <Input value={form.vendor_client_name} onChange={e => setForm({ ...form, vendor_client_name: e.target.value })} placeholder={form.transaction_type === 'purchase' ? 'Vendor name' : 'Client name'} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Assigned To</Label><Input value={form.assigned_name} onChange={e => setForm({ ...form, assigned_name: e.target.value })} placeholder="Full name" /></div>
              <div><Label>Contact</Label><Input value={form.assigned_contact} onChange={e => setForm({ ...form, assigned_contact: e.target.value })} placeholder="Phone / Email" /></div>
            </div>
            <div><Label>Assign To (Email)</Label><Input value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} placeholder="team@company.com" /></div>
            <div><Label>Department</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="e.g. Operations" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              <div><Label>Due Time</Label><Input type="time" value={form.due_time} onChange={e => setForm({ ...form, due_time: e.target.value })} /></div>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={createTask} disabled={!form.title}>Create Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
