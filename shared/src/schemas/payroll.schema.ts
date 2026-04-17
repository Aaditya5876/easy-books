import { z } from 'zod';

export const PayrollStatusEnum = z.enum(['PENDING', 'PROCESSED', 'PAID']);

export const CreatePayrollSchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
  salary: z.number().positive(),
  deductions: z.number().default(0),
  netAmount: z.number(),
  status: PayrollStatusEnum.default('PENDING'),
});

export const UpdatePayrollSchema = CreatePayrollSchema.omit({ companyId: true }).partial();

export const ProcessPayrollSchema = z.object({
  companyId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export type CreatePayrollDTO = z.infer<typeof CreatePayrollSchema>;
export type UpdatePayrollDTO = z.infer<typeof UpdatePayrollSchema>;
export type ProcessPayrollDTO = z.infer<typeof ProcessPayrollSchema>;
