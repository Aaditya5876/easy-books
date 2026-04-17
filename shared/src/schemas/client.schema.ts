import { z } from 'zod';

export const ClientStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT']);

export const CreateClientSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  crmStatus: ClientStatusEnum.default('ACTIVE'),
  notes: z.string().optional(),
});

export const UpdateClientSchema = CreateClientSchema.omit({ companyId: true }).partial();

export type CreateClientDTO = z.infer<typeof CreateClientSchema>;
export type UpdateClientDTO = z.infer<typeof UpdateClientSchema>;
