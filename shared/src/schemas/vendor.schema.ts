import { z } from 'zod';

export const CreateVendorSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  bankDetails: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateVendorSchema = CreateVendorSchema.omit({ companyId: true }).partial();

export type CreateVendorDTO = z.infer<typeof CreateVendorSchema>;
export type UpdateVendorDTO = z.infer<typeof UpdateVendorSchema>;
