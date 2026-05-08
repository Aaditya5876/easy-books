import { z } from 'zod';

export const LeaveStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);

export const CreateLeaveTypeSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1),
  daysPerYear: z.number().nonnegative(),
  isPaid: z.boolean().default(true),
});

export const CreateLeaveRequestSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
});

export const AllocateLeaveSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  fiscalYear: z.string(),
  totalDays: z.number().nonnegative(),
});

export type CreateLeaveTypeDTO = z.infer<typeof CreateLeaveTypeSchema>;
export type CreateLeaveRequestDTO = z.infer<typeof CreateLeaveRequestSchema>;
export type AllocateLeaveDTO = z.infer<typeof AllocateLeaveSchema>;
