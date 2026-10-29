import { z } from 'zod';

export const PayrollStatusEnum = z.enum(['PENDING', 'PROCESSED', 'PAID', 'ON_HOLD']);

export const ProcessPayrollSchema = z.object({
  companyId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM (BS year, e.g. 2081-01)'),
});

export const CalculateOnePayrollSchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export const SetHoldSchema = z.object({
  isOnHold: z.boolean(),
  holdReason: z.string().optional(),
});

export const PayrollSettingsSchema = z.object({
  ssfApplicable: z.boolean().default(true),
  ssfEmployeeRate: z.number().min(0).max(100).default(11),
  ssfEmployerRate: z.number().min(0).max(100).default(20),
  pitApplicable: z.boolean().default(true),
  dashainBonusApplicable: z.boolean().default(true),
  dashainBonusMonth: z.string().optional(),
  workingDaysPerMonth: z.number().int().min(1).max(31).default(26),
  overtimeRatePerHour: z.number().nonnegative().default(0),
});

export type ProcessPayrollDTO = z.infer<typeof ProcessPayrollSchema>;
export type CalculateOnePayrollDTO = z.infer<typeof CalculateOnePayrollSchema>;
export type SetHoldDTO = z.infer<typeof SetHoldSchema>;
export type PayrollSettingsDTO = z.infer<typeof PayrollSettingsSchema>;

// PATCH body for Settings → Preferences payroll fields: every field optional,
// no defaults (a partial save must not reset untouched settings).
const optionalTime = z.string().regex(/^(\d{2}:\d{2})?$/, 'Use HH:MM').nullable().optional();
export const UpdatePayrollSettingsSchema = PayrollSettingsSchema.partial().extend({
  attendanceDeductionEnabled: z.boolean().optional(),
  standardStartTime: optionalTime,
  standardEndTime: optionalTime,
});
export type UpdatePayrollSettingsDTO = z.infer<typeof UpdatePayrollSettingsSchema>;
