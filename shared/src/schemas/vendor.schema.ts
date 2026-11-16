import { z } from 'zod';

export const CreateVendorSchema = z.object({
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
  bankDetails: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateVendorSchema = CreateVendorSchema.omit({ companyId: true }).partial();

export type CreateVendorDTO = z.infer<typeof CreateVendorSchema>;
export type UpdateVendorDTO = z.infer<typeof UpdateVendorSchema>;
