import { z } from 'zod';

export const TaskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const TaskStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

export const CreateTaskSchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  priority: TaskPriorityEnum.default('MEDIUM'),
  status: TaskStatusEnum.default('PENDING'),
  notes: z.string().optional(),
});

export const UpdateTaskSchema = CreateTaskSchema.omit({ companyId: true }).partial();

export type CreateTaskDTO = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskDTO = z.infer<typeof UpdateTaskSchema>;
