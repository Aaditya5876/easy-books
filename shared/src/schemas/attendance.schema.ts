import { z } from 'zod';

export const AttendanceStatusEnum = z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY']);

export const CreateAttendanceSchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid(),
  date: z.string(),
  status: AttendanceStatusEnum,
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  overtimeHours: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

export const BulkAttendanceSchema = z.object({
  companyId: z.string().uuid(),
  date: z.string(),
  records: z.array(z.object({
    employeeId: z.string().uuid(),
    status: AttendanceStatusEnum,
    checkInTime: z.string().optional(),
    checkOutTime: z.string().optional(),
    overtimeHours: z.number().nonnegative().default(0),
    notes: z.string().optional(),
  })).min(1),
});

export const UpdateAttendanceSchema = CreateAttendanceSchema.omit({ companyId: true }).partial();

export type CreateAttendanceDTO = z.infer<typeof CreateAttendanceSchema>;
export type UpdateAttendanceDTO = z.infer<typeof UpdateAttendanceSchema>;
export type BulkAttendanceDTO = z.infer<typeof BulkAttendanceSchema>;
