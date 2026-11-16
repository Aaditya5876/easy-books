import { z } from 'zod';

export const TaskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const TaskStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
// What kind of work the task is — Workflow groups and filters by this.
export const WorkflowTypeEnum = z.enum(['JOB_CARD', 'ORDER_SLIP', 'GENERAL_ASSESSMENT', 'APPOINTMENT', 'GENERAL']);
export const TaskPartyTypeEnum = z.enum(['CLIENT', 'VENDOR', 'EMPLOYEE', 'OTHER']);

const optionalText = z.string().trim().max(500).optional().nullable();

export const CreateTaskSchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().trim().min(1),
  description: z.string().optional().nullable(),
  workflowType: WorkflowTypeEnum.default('GENERAL'),
  category: optionalText,
  assignedTo: optionalText,
  assignedName: optionalText,
  assignedContact: optionalText,
  assignedEmployeeId: z.string().uuid().optional().nullable(),
  department: optionalText,
  partyType: TaskPartyTypeEnum.optional().nullable(),
  partyId: z.string().uuid().optional().nullable(),
  partyName: optionalText,
  partyContact: optionalText,
  dueDate: z.string().optional().nullable(),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm').optional().nullable().or(z.literal('')),
  priority: TaskPriorityEnum.default('MEDIUM'),
  status: TaskStatusEnum.default('PENDING'),
  notes: z.string().optional().nullable(),
});

// No .default()s on update — a partial edit (e.g. status only) must not reset
// priority/status/type back to their defaults.
export const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().optional().nullable(),
  workflowType: WorkflowTypeEnum.optional(),
  category: optionalText,
  assignedTo: optionalText,
  assignedName: optionalText,
  assignedContact: optionalText,
  assignedEmployeeId: z.string().uuid().optional().nullable(),
  department: optionalText,
  partyType: TaskPartyTypeEnum.optional().nullable(),
  partyId: z.string().uuid().optional().nullable(),
  partyName: optionalText,
  partyContact: optionalText,
  dueDate: z.string().optional().nullable(),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm').optional().nullable().or(z.literal('')),
  priority: TaskPriorityEnum.optional(),
  status: TaskStatusEnum.optional(),
  notes: z.string().optional().nullable(),
});

export type CreateTaskDTO = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskDTO = z.infer<typeof UpdateTaskSchema>;
