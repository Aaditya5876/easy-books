import { z } from 'zod';
import { withoutDefaults } from './update-schema';

export const EmployeeStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']);
export const EmploymentTypeEnum = z.enum(['FULL_TIME', 'PART_TIME']);

const employeeBaseFields = {
  companyId: z.string().uuid(),
  // Workflow job this record belongs to (must be the same company's task).
  taskId: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  // Optional: left blank, the server gives the next free EMP-0001-style number.
  employeeId: z.string().trim().max(40).optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  panNumber: z.string().optional(),
  dateOfJoining: z.string().optional(),
  basicSalary: z.number().nonnegative().default(0),
  allowances: z.record(z.string(), z.number()).optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  status: EmployeeStatusEnum.default('ACTIVE'),
  employmentType: EmploymentTypeEnum.default('FULL_TIME'),
  // Required for PART_TIME (enforced by the .refine() below) — their own
  // expected hours/day, used by attendance-based salary deduction instead of
  // the company's standard working hours.
  contractedHoursPerDay: z.number().positive().max(24).optional(),
};

// PART_TIME without contractedHoursPerDay would leave attendance-based salary
// deduction with no basis to compute their shortfall — reject it here instead
// of silently falling back to the full-time standard (wrong for a part-timer).
const requiresContractedHoursForPartTime = (data: { employmentType?: string; contractedHoursPerDay?: number }, ctx: z.RefinementCtx) => {
  if (data.employmentType === 'PART_TIME' && data.contractedHoursPerDay == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'contractedHoursPerDay is required when employmentType is PART_TIME',
      path: ['contractedHoursPerDay'],
    });
  }
};

export const CreateEmployeeSchema = z.object(employeeBaseFields).superRefine(requiresContractedHoursForPartTime);

// Without defaults: editing a phone number used to reset salary to 0.
export const UpdateEmployeeSchema = z
  .object(withoutDefaults(employeeBaseFields))
  .omit({ companyId: true })
  .partial()
  .superRefine(requiresContractedHoursForPartTime);

export type CreateEmployeeDTO = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeDTO = z.infer<typeof UpdateEmployeeSchema>;
