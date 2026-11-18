import { z } from 'zod';
import { withoutDefaults } from './update-schema';

export const ClientStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT']);

export const CreateClientSchema = z.object({
  companyId: z.string().uuid(),
  // Workflow job this record belongs to (must be the same company's task).
  taskId: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  abbreviation: z.string().optional(),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  panVat: z.string().optional(),
  crmStatus: ClientStatusEnum.default('ACTIVE'),
  // Already owed before this party was added (we owe a vendor / a client owes us).
  openingBalance: z.coerce.number().finite().min(0).optional(),
  notes: z.string().optional(),
});

export const UpdateClientSchema = z.object(withoutDefaults(CreateClientSchema.shape)).omit({ companyId: true }).partial();

export type CreateClientDTO = z.infer<typeof CreateClientSchema>;
export type UpdateClientDTO = z.infer<typeof UpdateClientSchema>;
