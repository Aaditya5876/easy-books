import { z } from 'zod';

export const EmployeeStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']);

export const CreateEmployeeSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1),
  employeeId: z.string().min(1),
  department: z.string().optional(),
  designation: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  dateOfJoining: z.string().optional(),
  salary: z.number().default(0),
  status: EmployeeStatusEnum.default('ACTIVE'),
});

export const UpdateEmployeeSchema = CreateEmployeeSchema.omit({ companyId: true }).partial();

export type CreateEmployeeDTO = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeDTO = z.infer<typeof UpdateEmployeeSchema>;
