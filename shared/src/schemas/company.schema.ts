import { z } from 'zod';

export const CreateCompanySchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  panVat: z.string().optional(),
  currency: z.string().default('NPR'),
  fiscalYearStart: z.string().optional(),
});

export const UpdateCompanySchema = CreateCompanySchema.partial();

export type CreateCompanyDTO = z.infer<typeof CreateCompanySchema>;
export type UpdateCompanyDTO = z.infer<typeof UpdateCompanySchema>;
