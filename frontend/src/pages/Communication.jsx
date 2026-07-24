import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api, apiAuth } from '@/api/adapter';
import { getActiveCompanyId } from '@/lib/companyContext';
import { formatDate } from '@/lib/utils';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  MessageSquare, Mail, CheckCircle, Clock, AlertCircle,
  ClipboardList, Pencil, FileText, Calendar, Users, User, Phone, Building2, Plus
} from 'lucide-react';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';

const PRIORITY_CONFIG = [
  { v: 'low',    label: '● Low',      cls: 'border-slate-300 text-slate-600', act: 'border-slate-500 bg-slate-50 text-slate-700' },
  { v: 'medium', label: '●● Medium',  cls: 'border-yellow-400 text-yellow-700', act: 'border-yellow-500 bg-yellow-50 text-yellow-800' },
  { v: 'high',   label: '●●● High',   cls: 'border-orange-400 text-orange-700', act: 'border-orange-500 bg-orange-50 text-orange-800' },
  { v: 'urgent', label: '🔴 Urgent',  cls: 'border-red-400 text-red-600', act: 'border-red-500 bg-red-50 text-red-700' },
];

export default function Communication() {
  const companyId = getActiveCompanyId();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');
  const [showNew, setShowNew] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [colFilters, setColFilters] = useState({ title: '', assigned_to: '', department: '', created_date: '', due_date: '', priority: '', status: '' });
  const [partyOptions, setPartyOptions] = useState([]);
  const setCol = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const [form, setForm] = useState({
    title: '', description: '', assigned_to: '', due_date: '', priority: 'medium', department: '', party_type: '', party_name: '', party_contact: '', assigned_name: '', assigned_contact: '', due_time: ''
  });

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);
    const data = await api.Task.filter({ company_id: companyId }, '-created_date', 50);
    setTasks(data);
    setLoading(false);
  }

  async function createTask() {
    const user = await apiAuth.me();
    await api.Task.create({
      ...form,
      company_id: companyId,
      assigned_by: user.email,
      status: 'pending',
    });
    setForm({ title: '', description: '', assigned_to: '', due_date: '', priority: 'medium' });
    setShowNew(false);
    loadData();
  }

  async function updateTaskStatus(taskId, status) {
    await api.Task.update(taskId, { status });
    loadData();
  }

  const filtered = tasks.filter(t => {
    const f = colFilters;
    return (
      (!f.title || t.title?.toLowerCase().includes(f.title.toLowerCase())) &&
      (!f.assigned_to || (t.assigned_name || t.assigned_to || '').toLowerCase().includes(f.assigned_to.toLowerCase())) &&
      (!f.created_date || (t.created_date ? new Date(t.created_date).toLocaleDateString() : '').includes(f.created_date)) &&
      (!f.due_date || (t.due_date || '').includes(f.due_date)) &&
      (!f.priority || (t.priority || '').toLowerCase().includes(f.priority.toLowerCase())) &&
      (!f.department || (t.department || '').toLowerCase().includes(f.department.toLowerCase())) &&
      (!f.status || (t.status || '').toLowerCase().includes(f.status.toLowerCase()))
    );
  });

  const priorityColors = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-amber-100 text-amber-700',
    urgent: 'bg-red-100 text-red-700',
  };

  const statusIcons = {
    pending: Clock,
    in_progress: AlertCircle,
    completed: CheckCircle,
  };

  const taskColumns = [
    { key: 'title', label: 'Task', filterValue: colFilters.title, onFilterChange: v => setCol('title', v), filterPlaceholder: 'Search title...', render: (row) => <span className="font-medium">{row.title}</span> },
    { key: 'assigned_to', label: 'Assigned To', filterValue: colFilters.assigned_to, onFilterChange: v => setCol('assigned_to', v), filterPlaceholder: 'Search name...', render: (row) => (
      <div>
        <div className="font-medium text-sm">{row.assigned_name || row.assigned_to}</div>
        {row.assigned_name && row.assigned_to && <div className="text-xs text-muted-foreground">{row.assigned_to}</div>}
      </div>
    )},
    { key: 'department', label: 'Department', filterValue: colFilters.department, onFilterChange: v => setCol('department', v), filterPlaceholder: 'Search dept...', render: (row) => row.department || '—' },
    { key: 'party', label: 'Party', render: (row) => row.party_name ? (
      <div>
        <div className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 inline-block capitalize mb-0.5">{row.party_type}</div>
        <div className="font-medium text-sm">{row.party_name}</div>
        {row.party_contact && <div className="text-xs text-muted-foreground">{row.party_contact}</div>}
      </div>
    ) : '—' },
    { key: 'created_date', label: 'Assigned Date', filterValue: colFilters.created_date, filterType: 'date', onFilterChange: v => setCol('created_date', v), render: (row) => row.created_date ? new Date(row.created_date).toLocaleDateString() : '—' },
    { key: 'due_date', label: 'Due Date', filterValue: colFilters.due_date, filterType: 'date', onFilterChange: v => setCol('due_date', v), render: (row) => formatDate(row.due_date) },
    { key: 'priority', label: 'Priority', filterValue: colFilters.priority, onFilterChange: v => setCol('priority', v), filterPlaceholder: 'e.g. high', render: (row) => (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${priorityColors[row.priority] || ''}`}>
        {row.priority}
      </span>
    )},
    { key: 'status', label: 'Status', filterValue: colFilters.status, onFilterChange: v => setCol('status', v), filterPlaceholder: 'e.g. pending', render: (row) => {
      const Icon = statusIcons[row.status] || Clock;
      return (
        <Select value={row.status} onValueChange={v => updateTaskStatus(row.id, v)}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <div className="flex items-center gap-1.5">
              <Icon className="w-3 h-3" />
              <span className="capitalize">{row.status?.replace('_', ' ')}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      );
    }},
    { key: 'actions', label: '', render: (row) => (
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); setSelectedTask(row); }}>View Details</Button>
    )},
  ];

  const taskStats = {
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Communication" subtitle="Tasks, messages & team collaboration" onAdd={() => setShowNew(true)} addLabel="New Task" />

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{taskStats.pending}</p>
          <p className="text-xs text-amber-600">Pending</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{taskStats.in_progress}</p>
          <p className="text-xs text-blue-600">In Progress</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{taskStats.completed}</p>
          <p className="text-xs text-green-600">Completed</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tasks">Task Management</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="mt-4">
          <div className="flex justify-end mb-4">
            {Object.values(colFilters).some(v => v) && (
              <Button variant="outline" size="sm" onClick={() => setColFilters({ title: '', assigned_to: '', department: '', created_date: '', due_date: '', priority: '', status: '' })}>Clear Filters</Button>
            )}
          </div>
          {tasks.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No tasks yet"
                description="Assign your first task to a team member or party."
                action={
                  <Button onClick={() => setShowNew(true)}>
                    <Plus className="w-4 h-4 mr-2" />Add First Record
                  </Button>
                }
              />
            ) : (
              <DataTable columns={taskColumns} data={filtered} emptyMessage="No tasks assigned yet" />
            )}
        </TabsContent>
        <TabsContent value="messages" className="mt-4">
          <div className="bg-card rounded-xl border p-12 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground">Internal messaging coming soon</p>
            <p className="text-xs text-muted-foreground mt-1">Team WhatsApp and chat integration</p>
          </div>
        </TabsContent>
        <TabsContent value="email" className="mt-4">
          <div className="bg-card rounded-xl border p-12 text-center">
            <Mail className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground">Email integration coming soon</p>
            <p className="text-xs text-muted-foreground mt-1">Send and receive team emails</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Task Detail Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!selectedTask} onOpenChange={open => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle className="text-lg">{selectedTask?.title}</DialogTitle></DialogHeader>
          {selectedTask && (
            <div className="space-y-4 text-sm overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assigned To</p>
                  <p className="font-medium">{selectedTask.assigned_name || '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</p>
                  <p className="font-medium">{selectedTask.assigned_contact || '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedTask.assigned_to || '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assigned By</p>
                  <p className="font-medium">{selectedTask.assigned_by || '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assigned Date</p>
                  <p className="font-medium">{selectedTask.created_date ? new Date(selectedTask.created_date).toLocaleDateString() : '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Due Date & Time</p>
                  <p className="font-medium">{formatDate(selectedTask.due_date)}{selectedTask.due_time ? ' · ' + selectedTask.due_time : ''}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Priority</p>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize ${priorityColors[selectedTask.priority] || ''}`}>{selectedTask.priority}</span>
                </div>
                <div className="space-y-0.5">
                   <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Party Type</p>
                   <p className="font-medium capitalize">{selectedTask.party_type || '—'}</p>
                </div>
                <div className="space-y-0.5">
                   <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Party Name</p>
                   <p className="font-medium">{selectedTask.party_name || '—'}{selectedTask.party_contact ? ' · ' + selectedTask.party_contact : ''}</p>
                </div>
                <div className="space-y-0.5">
                   <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{selectedTask.status?.replace('_', ' ')}</p>
                </div>
              </div>
              {selectedTask.description && (
                <div className="border-t pt-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{selectedTask.description}</p>
                </div>
              )}
              {selectedTask.progress_notes && (
                <div className="border-t pt-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progress Notes</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{selectedTask.progress_notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setSelectedTask(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign New Task Dialog ─────────────────────────────────────────── */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="glass-dialog max-w-4xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-teal-400 to-cyan-500 -mx-6 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />Assign New Task
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 max-h-[65vh] overflow-hidden mt-2">
            {/* LEFT — Task Details */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="space-y-3 overflow-y-auto pr-1"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5" />Task Details
              </p>

              {/* Title */}
              <div className="space-y-1">
                <Label>Task Title *</Label>
                <div className="relative">
                  <Pencil className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="Task title"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <Label>Description</Label>
                <div className="relative">
                  <FileText className="absolute left-2.5 top-3 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Textarea
                    className="pl-8 text-sm"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    placeholder="Optional details..."
                  />
                </div>
              </div>

              {/* Priority chips */}
              <div className="space-y-1">
                <Label>Priority</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {PRIORITY_CONFIG.map(p => (
                    <button
                      key={p.v}
                      type="button"
                      onClick={() => setForm({ ...form, priority: p.v })}
                      className={`sel-chip text-xs ${form.priority === p.v ? p.act + ' border-2' : p.cls + ' border opacity-75'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due Date + Due Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Due Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="date"
                      className="pl-8 h-9 text-sm"
                      value={form.due_date}
                      onChange={e => setForm({ ...form, due_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Due Time</Label>
                  <div className="relative">
                    <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="time"
                      className="pl-8 h-9 text-sm"
                      value={form.due_time || ''}
                      onChange={e => setForm({ ...form, due_time: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* RIGHT — Assignment */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.06 }}
              className="space-y-3 overflow-y-auto pr-1"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />Assignment
              </p>

              {/* Assigned To (full name) */}
              <div className="space-y-1">
                <Label>Assigned To</Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    value={form.assigned_name || ''}
                    onChange={e => setForm({ ...form, assigned_name: e.target.value })}
                    placeholder="Full name"
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-1">
                <Label>Contact</Label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    value={form.assigned_contact || ''}
                    onChange={e => setForm({ ...form, assigned_contact: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    value={form.assigned_to}
                    onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                    placeholder="team@company.com"
                  />
                </div>
              </div>

              {/* Department */}
              <div className="space-y-1">
                <Label>Department</Label>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-9 text-sm"
                    value={form.department}
                    onChange={e => setForm({ ...form, department: e.target.value })}
                    placeholder="e.g. Engineering, Sales"
                  />
                </div>
              </div>

              {/* Party Type chips */}
              <div className="space-y-1">
                <Label>Party Type</Label>
                <div className="flex gap-2 mt-1">
                  {['client', 'vendor'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={async () => {
                        setForm({ ...form, party_type: t, party_name: '', party_contact: '' });
                        if (t === 'client') {
                          const data = await api.Client.filter({ company_id: companyId });
                          setPartyOptions(data.map(c => ({ id: c.id, name: c.name, contact: c.phone || c.email || '' })));
                        } else if (t === 'vendor') {
                          const data = await api.Vendor.filter({ company_id: companyId });
                          setPartyOptions(data.map(v => ({ id: v.id, name: v.name, contact: v.phone || v.email || '' })));
                        }
                      }}
                      className={`sel-chip flex-1 capitalize text-xs ${form.party_type === t ? 'border-primary bg-primary/10 text-primary border-2' : 'border-border text-muted-foreground border opacity-70'}`}
                    >
                      {t}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, party_type: '', party_name: '', party_contact: '' })}
                    className={`sel-chip flex-1 text-xs ${!form.party_type ? 'border-primary bg-primary/10 text-primary border-2' : 'border-border text-muted-foreground border opacity-70'}`}
                  >
                    Internal
                  </button>
                </div>
              </div>

              {/* Party fields (when party_type is set) */}
              {form.party_type && (
                <div className="space-y-2">
                  <div>
                    <Label>Select Existing {form.party_type === 'client' ? 'Client' : 'Vendor'}</Label>
                    <Select value={form.party_name} onValueChange={v => {
                      const opt = partyOptions.find(o => o.name === v);
                      setForm({ ...form, party_name: v, party_contact: opt?.contact || '' });
                    }}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pick from list or type below..." /></SelectTrigger>
                      <SelectContent>
                        {partyOptions.map(o => <SelectItem key={o.id} value={o.name}>{o.name}{o.contact ? ` · ${o.contact}` : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Name (or type new)</Label>
                      <Input className="h-9 text-sm" value={form.party_name || ''} onChange={e => setForm({ ...form, party_name: e.target.value })} placeholder={form.party_type === 'client' ? 'Client name' : 'Vendor name'} />
                    </div>
                    <div>
                      <Label>Contact</Label>
                      <Input className="h-9 text-sm" value={form.party_contact || ''} onChange={e => setForm({ ...form, party_contact: e.target.value })} placeholder="Phone / Email" />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={createTask} disabled={!form.title}>Assign Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
