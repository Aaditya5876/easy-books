// One place that knows the task API's format. The Workflow, Communication and
// Dashboard pages each used to send their own spelling of status/priority
// ('Pending', 'pending', 'Done'…) and snake_case fields, which the backend
// rejected — tasks could not be created and never showed up.

export const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const WORKFLOW_TYPES = ['JOB_CARD', 'ORDER_SLIP', 'GENERAL_ASSESSMENT', 'APPOINTMENT', 'GENERAL'];
export const PARTY_TYPES = ['CLIENT', 'VENDOR', 'EMPLOYEE', 'OTHER'];
export const TASK_CATEGORIES = ['General', 'Finance', 'HR', 'Operations', 'Marketing', 'Sales', 'Admin', 'Legal'];

// Memo folders a task's scanned documents can be filed under (Memo page categories).
export const MEMO_FOLDERS = ['job_card', 'order_slip', 'quotation', 'sales_bill', 'purchase_bill', 'extra_work', 'supporting_doc'];

const key = (v) => String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

export function normalizeStatus(v) {
  const k = key(v);
  if (['in_progress', 'inprogress', 'ongoing', 'progress'].includes(k)) return 'IN_PROGRESS';
  if (['completed', 'complete', 'done'].includes(k)) return 'COMPLETED';
  if (['cancelled', 'canceled'].includes(k)) return 'CANCELLED';
  return 'PENDING';
}

export function normalizePriority(v) {
  const k = key(v).toUpperCase();
  return TASK_PRIORITIES.includes(k) ? k : 'MEDIUM';
}

// snake_case form field → API field
const FIELD_MAP = {
  title: 'title', description: 'description', notes: 'notes', category: 'category',
  workflow_type: 'workflowType', workflowType: 'workflowType',
  assigned_to: 'assignedTo', assignedTo: 'assignedTo',
  assigned_name: 'assignedName', assignedName: 'assignedName',
  assigned_contact: 'assignedContact', assignedContact: 'assignedContact',
  department: 'department',
  party_type: 'partyType', partyType: 'partyType',
  party_id: 'partyId', partyId: 'partyId',
  assigned_employee_id: 'assignedEmployeeId', assignedEmployeeId: 'assignedEmployeeId',
  party_name: 'partyName', partyName: 'partyName',
  party_contact: 'partyContact', partyContact: 'partyContact',
  due_date: 'dueDate', dueDate: 'dueDate',
  due_time: 'dueTime', dueTime: 'dueTime',
  status: 'status', priority: 'priority',
};

// Turns any task-shaped form/object into exactly what POST/PUT /tasks accepts.
// Unknown keys (id, taskNumber, createdAt, attachments…) are dropped.
export function toTaskPayload(form) {
  const out = {};
  for (const [k, v] of Object.entries(form || {})) {
    const apiKey = FIELD_MAP[k];
    if (!apiKey || v === undefined) continue;
    out[apiKey] = typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v;
  }
  if ('status' in out) out.status = normalizeStatus(out.status);
  if ('priority' in out) out.priority = normalizePriority(out.priority);
  if (typeof out.partyType === 'string') out.partyType = out.partyType.toUpperCase();
  if (typeof out.workflowType === 'string') out.workflowType = out.workflowType.toUpperCase();
  if (typeof out.dueDate === 'string') out.dueDate = out.dueDate.slice(0, 10);
  return out;
}

// Bill/quotation lines → API items. Blank lines are dropped; numbers coerced.
export function toOrderItems(lines) {
  return (lines || [])
    .filter((l) => String(l.description ?? '').trim() && Number(l.quantity) > 0)
    .map((l) => ({
      ...(l.inventoryItemId ? { inventoryItemId: l.inventoryItemId } : {}),
      description: String(l.description).trim(),
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice) || 0,
      ...(l.unit ? { unit: l.unit } : {}),
    }));
}

export function linesTotal(lines, isVat = false) {
  const sub = toOrderItems(lines).reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  return Math.round((isVat ? sub * 1.13 : sub) * 100) / 100;
}

// Finds an existing record by (case-insensitive) name — used to turn a typed
// client/vendor/employee name into a real link.
export function matchByName(records, name) {
  const k = String(name ?? '').trim().toLowerCase();
  if (!k) return null;
  return (records || []).find((r) => String(r.name ?? '').trim().toLowerCase() === k) || null;
}

export function defaultMemoFolder(workflowType) {
  if (workflowType === 'JOB_CARD') return 'job_card';
  if (workflowType === 'ORDER_SLIP') return 'order_slip';
  return 'supporting_doc';
}

export function isTaskOverdue(task) {
  if (!task?.dueDate) return false;
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
  return new Date(task.dueDate) < new Date(new Date().toDateString());
}

// i18n labels — `t` is passed in so these work outside components too.
export function statusLabel(t, s) {
  return {
    PENDING: t('tasks.statusPending', { defaultValue: 'Pending' }),
    IN_PROGRESS: t('tasks.statusInProgress', { defaultValue: 'In Progress' }),
    COMPLETED: t('tasks.statusCompleted', { defaultValue: 'Completed' }),
    CANCELLED: t('tasks.statusCancelled', { defaultValue: 'Cancelled' }),
  }[s] || s;
}

export function priorityLabel(t, p) {
  return {
    LOW: t('tasks.priorityLow', { defaultValue: 'Low' }),
    MEDIUM: t('tasks.priorityMedium', { defaultValue: 'Medium' }),
    HIGH: t('tasks.priorityHigh', { defaultValue: 'High' }),
    URGENT: t('tasks.priorityUrgent', { defaultValue: 'Urgent' }),
  }[p] || p;
}

export function workflowTypeLabel(t, w) {
  return {
    JOB_CARD: t('tasks.typeJobCard', { defaultValue: 'Job Card' }),
    ORDER_SLIP: t('tasks.typeOrderSlip', { defaultValue: 'Order Slip' }),
    GENERAL_ASSESSMENT: t('tasks.typeGeneralAssessment', { defaultValue: 'General Assessment' }),
    APPOINTMENT: t('tasks.typeAppointment', { defaultValue: 'Appointment' }),
    GENERAL: t('tasks.typeGeneral', { defaultValue: 'General Task' }),
  }[w] || w;
}

export function partyTypeLabel(t, p) {
  return {
    CLIENT: t('tasks.partyClient', { defaultValue: 'Client' }),
    VENDOR: t('tasks.partyVendor', { defaultValue: 'Vendor' }),
    EMPLOYEE: t('tasks.partyEmployee', { defaultValue: 'Employee' }),
    OTHER: t('tasks.partyOther', { defaultValue: 'Other' }),
  }[p] || p;
}

export function memoFolderLabel(t, f) {
  return {
    job_card: t('memo.categoryJobCards', { defaultValue: 'Job Cards' }),
    order_slip: t('memo.categoryOrderSlips', { defaultValue: 'Order Slips' }),
    quotation: t('memo.categoryQuotations', { defaultValue: 'Quotations' }),
    sales_bill: t('memo.categorySalesBills', { defaultValue: 'Sales Bills' }),
    purchase_bill: t('memo.categoryPurchaseBills', { defaultValue: 'Purchase Bills' }),
    extra_work: t('memo.categoryExtraWork', { defaultValue: 'Extra Work / Pending' }),
    supporting_doc: t('memo.categorySupportingDocuments', { defaultValue: 'Supporting Documents' }),
  }[f] || f;
}
