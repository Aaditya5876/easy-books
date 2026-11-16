import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { taskApi } from '@/api';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { workflowTypeLabel } from '@/lib/tasks';

// Workflow jobs, loaded once per page. Used to link a bill / purchase /
// quotation made on its own page to a job, and to show "#12" in lists.
export function useWorkflowTasks() {
  const [tasks, setTasks] = useState([]);
  useEffect(() => {
    taskApi.list()
      .then((res) => setTasks(Array.isArray(res.data) ? res.data : []))
      .catch(() => setTasks([]));
  }, []);
  return tasks;
}

export function TaskLinkSelect({ tasks, value, onChange }) {
  const { t } = useTranslation();
  // Only open jobs are offered; a job already chosen stays visible.
  const options = tasks.filter((x) => x.status === 'PENDING' || x.status === 'IN_PROGRESS' || x.id === value);
  if (options.length === 0) return null;
  return (
    <div>
      <Label className="text-xs">{t('workflow.linkToJob', { defaultValue: 'Workflow job' })} <span className="text-muted-foreground">({t('workflow.optional', { defaultValue: 'optional' })})</span></Label>
      <Select value={value || '__none'} onValueChange={(v) => onChange(v === '__none' ? '' : v)}>
        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">{t('workflow.noJob', { defaultValue: 'Not for a job' })}</SelectItem>
          {options.map((x) => (
            <SelectItem key={x.id} value={x.id}>#{x.taskNumber} {x.title} · {workflowTypeLabel(t, x.workflowType)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// "#12" link to Workflow for a row's task_id / taskId.
export function TaskBadge({ tasks, taskId }) {
  if (!taskId) return <span className="text-muted-foreground">—</span>;
  const task = tasks.find((x) => x.id === taskId);
  return (
    <Link to="/workflow" className="font-mono text-xs text-primary hover:underline" title={task?.title} onClick={(e) => e.stopPropagation()}>
      #{task?.taskNumber ?? '…'}
    </Link>
  );
}
