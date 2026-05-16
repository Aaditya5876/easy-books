import { useState, useEffect } from 'react';
import { taskApi } from '@/api';
import { getActiveCompanyId } from '@/lib/companyContext';
import PageHeader from '../components/shared/PageHeader';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, X, ExternalLink, Calendar, User, Tag, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ['General', 'Finance', 'HR', 'Operations', 'Marketing', 'Sales', 'Admin', 'Legal'];

const CATEGORY_COLORS = {
  Finance: 'bg-blue-100 text-blue-700',
  HR: 'bg-purple-100 text-purple-700',
  Operations: 'bg-orange-100 text-orange-700',
  Marketing: 'bg-pink-100 text-pink-700',
  Sales: 'bg-green-100 text-green-700',
  Admin: 'bg-gray-100 text-gray-700',
  Legal: 'bg-red-100 text-red-700',
  General: 'bg-slate-100 text-slate-700',
};

const PRIORITY_STRIPE = {
  High: 'bg-red-500',
  Medium: 'bg-amber-500',
  Low: 'bg-green-500',
};

const PRIORITY_BADGE = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-green-100 text-green-700',
};

const EMPTY_FORM = {
  title: '',
  description: '',
  category: 'General',
  priority: 'Medium',
  status: 'Pending',
  due_date: '',
  assigned_to: '',
};

const COLUMNS = [
  { key: 'Pending', label: 'Pending', dotColor: 'bg-gray-400' },
  { key: 'In Progress', label: 'In Progress', dotColor: 'bg-blue-500' },
  { key: 'Done', label: 'Done', dotColor: 'bg-green-500' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

// ─── KanbanCard ──────────────────────────────────────────────────────────────

function KanbanCard({ task, onClick }) {
  const overdue = isOverdue(task.due_date);

  return (
    <div
      className="bg-card border border-border rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow group relative"
      onClick={() => onClick(task)}
    >
      {/* Priority stripe */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-lg', PRIORITY_STRIPE[task.priority] || 'bg-gray-300')} />

      <div className="pl-3">
        {/* Title */}
        <p className="font-semibold text-sm leading-snug mb-2 pr-1">{task.title}</p>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1 mb-2">
          {task.category && (
            <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium', CATEGORY_COLORS[task.category] || CATEGORY_COLORS.General)}>
              {task.category}
            </span>
          )}
          {task.priority && (
            <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium', PRIORITY_BADGE[task.priority] || '')}>
              {task.priority}
            </span>
          )}
        </div>

        {/* Due date */}
        {task.due_date && (
          <div className={cn('flex items-center gap-1 text-xs mb-1.5', overdue ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
            <Calendar className="w-3 h-3 shrink-0" />
            <span>{formatDate(task.due_date)}{overdue ? ' · Overdue' : ''}</span>
          </div>
        )}

        {/* Assigned to */}
        {task.assigned_to && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
            <User className="w-3 h-3 shrink-0" />
            <span className="truncate">{task.assigned_to}</span>
          </div>
        )}

        {/* Description */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

function KanbanColumn({ title, dotColor, tasks, onCardClick, onAddNew }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', dotColor)} />
          <span className="font-semibold text-sm">{title}</span>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={onAddNew}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      <div className="space-y-2 min-h-[200px] bg-muted/20 rounded-lg p-2">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">No tasks</div>
        ) : (
          tasks.map(task => (
            <KanbanCard key={task.id} task={task} onClick={onCardClick} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── SlideOutPanel ────────────────────────────────────────────────────────────

function SlideOutPanel({ task, onClose, onSave }) {
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) setEditing({ ...task });
    else setEditing(null);
  }, [task]);

  if (!editing) return null;

  async function handleSave() {
    setSaving(true);
    await onSave(editing);
    setSaving(false);
  }

  const QUICK_ACTIONS = [
    { label: 'Create Sales Bill', href: '/sales' },
    { label: 'Create Purchase', href: '/purchase' },
    { label: 'Add Client', href: '/clients' },
    { label: 'Add Vendor', href: '/vendors' },
  ];

  return (
    <div
      className={cn(
        'fixed right-0 top-0 h-screen w-[420px] bg-background border-l border-border shadow-2xl z-50 transition-transform duration-300 flex flex-col',
        task ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
        <div className="flex-1 pr-4">
          <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Task Detail</p>
          <h2 className="font-bold text-base leading-snug">{editing.title}</h2>
        </div>
        <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Status + Priority row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Status
            </Label>
            <Select
              value={editing.status}
              onValueChange={v => setEditing(e => ({ ...e, status: v }))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" /> Priority
            </Label>
            <Select
              value={editing.priority}
              onValueChange={v => setEditing(e => ({ ...e, priority: v }))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Tag className="w-3 h-3" /> Category
          </Label>
          <span className={cn('inline-block text-xs px-2.5 py-1 rounded-md font-medium', CATEGORY_COLORS[editing.category] || CATEGORY_COLORS.General)}>
            {editing.category || 'General'}
          </span>
        </div>

        {/* Due date */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Calendar className="w-3 h-3" /> Due Date
          </Label>
          <Input
            type="date"
            className="h-9 text-sm"
            value={editing.due_date || ''}
            onChange={e => setEditing(ed => ({ ...ed, due_date: e.target.value }))}
          />
          {editing.due_date && isOverdue(editing.due_date) && (
            <p className="text-xs text-red-500 font-medium">This task is overdue.</p>
          )}
        </div>

        {/* Assigned to */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <User className="w-3 h-3" /> Assigned To
          </Label>
          <Input
            className="h-9 text-sm"
            placeholder="Name or email..."
            value={editing.assigned_to || ''}
            onChange={e => setEditing(ed => ({ ...ed, assigned_to: e.target.value }))}
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Description</Label>
          <Textarea
            className="text-sm resize-none"
            rows={4}
            placeholder="Add details about this task..."
            value={editing.description || ''}
            onChange={e => setEditing(ed => ({ ...ed, description: e.target.value }))}
          />
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map(action => (
              <a
                key={action.href}
                href={action.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors text-foreground"
              >
                <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
                {action.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-border shrink-0">
        <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
          <CheckCircle2 className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

// ─── NewTaskDialog ────────────────────────────────────────────────────────────

function NewTaskDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleCreate() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const companyId = getActiveCompanyId();
      const res = await taskApi.create({ ...form, companyId });
      onCreated(res.data);
      setForm(EMPTY_FORM);
      onOpenChange(false);
      toast({ title: 'Task created', description: `"${form.title}" added to ${form.status}.` });
    } catch {
      toast({ title: 'Error', description: 'Could not create task.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-dialog max-w-lg">
        <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500 -mx-6 -mt-6 mb-4 rounded-t-lg" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-amber-500" />
            New Task
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Title <span className="text-red-500">*</span></Label>
            <Input
              className="h-9 text-sm"
              placeholder="What needs to be done?"
              value={form.title}
              onChange={e => setField('title', e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description</Label>
            <Textarea
              className="text-sm resize-none"
              rows={3}
              placeholder="Optional details..."
              value={form.description}
              onChange={e => setField('description', e.target.value)}
            />
          </div>

          {/* Category + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category</Label>
              <Select value={form.category} onValueChange={v => setField('category', v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Priority</Label>
              <Select value={form.priority} onValueChange={v => setField('priority', v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={form.status} onValueChange={v => setField('status', v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Due Date</Label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={form.due_date}
                onChange={e => setField('due_date', e.target.value)}
              />
            </div>
          </div>

          {/* Assigned to */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Assigned To</Label>
            <Input
              className="h-9 text-sm"
              placeholder="Name or email..."
              value={form.assigned_to}
              onChange={e => setField('assigned_to', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!form.title.trim() || saving}>
            {saving ? 'Creating…' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Workflow() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    try {
      const res = await taskApi.list();
      setTasks(res.data || []);
    } catch {
      toast({ title: 'Error', description: 'Could not load tasks.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  // Optimistic update: replaces the task in state and updates selectedTask if open
  function applyTaskUpdate(updated) {
    setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    setSelectedTask(prev => (prev?.id === updated.id ? updated : prev));
  }

  async function handleSaveTask(edited) {
    try {
      const res = await taskApi.update(edited.id, edited);
      const saved = res.data ?? edited;
      applyTaskUpdate(saved);
      setSelectedTask(null);
      toast({ title: 'Task updated', description: `"${saved.title}" saved.` });
    } catch {
      toast({ title: 'Error', description: 'Could not save task.', variant: 'destructive' });
    }
  }

  function handleTaskCreated(newTask) {
    setTasks(prev => [newTask, ...prev]);
  }

  function openNewTaskInColumn(status) {
    setShowNewDialog(true);
  }

  const pending = tasks.filter(t => t.status === 'Pending');
  const inProgress = tasks.filter(t => t.status === 'In Progress');
  const done = tasks.filter(t => t.status === 'Done');

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Workflow"
        subtitle="Track tasks and projects across your team"
      >
        <Button onClick={() => setShowNewDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Task
        </Button>
      </PageHeader>

      {loading ? (
        <PageLoader />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No tasks yet"
          description="Create your first task to start managing work across your team."
          action={
            <Button onClick={() => setShowNewDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" /> New Task
            </Button>
          }
        />
      ) : (
        <div className="flex gap-4 items-start">
          {COLUMNS.map(col => {
            const colTasks =
              col.key === 'Pending' ? pending
              : col.key === 'In Progress' ? inProgress
              : done;
            return (
              <KanbanColumn
                key={col.key}
                title={col.label}
                dotColor={col.dotColor}
                tasks={colTasks}
                onCardClick={setSelectedTask}
                onAddNew={() => openNewTaskInColumn(col.key)}
              />
            );
          })}
        </div>
      )}

      {/* Backdrop overlay */}
      {selectedTask && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setSelectedTask(null)}
        />
      )}

      {/* Slide-out detail panel */}
      <SlideOutPanel
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onSave={handleSaveTask}
      />

      {/* New Task dialog */}
      <NewTaskDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreated={handleTaskCreated}
      />
    </div>
  );
}
