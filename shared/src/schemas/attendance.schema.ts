import { z } from 'zod';

export const AttendanceStatusEnum = z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY']);

export const CreateAttendanceSchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid(),
  date: z.string(),
  status: AttendanceStatusEnum,
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateAttendanceSchema = CreateAttendanceSchema.omit({ companyId: true }).partial();

export type CreateAttendanceDTO = z.infer<typeof CreateAttendanceSchema>;
export type UpdateAttendanceDTO = z.infer<typeof UpdateAttendanceSchema>;
