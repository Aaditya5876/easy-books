import { z } from 'zod';

export const CreateBankAccountSchema = z.object({
  companyId: z.string().uuid(),
  bankName: z.string().min(1),
  accountNumber: z.string().min(1),
  accountType: z.string().optional(),
  branch: z.string().optional(),
  currentBalance: z.number().default(0),
  portalUrl: z.string().url().optional(),
});

export const UpdateBankAccountSchema = CreateBankAccountSchema.omit({ companyId: true }).partial();

export type CreateBankAccountDTO = z.infer<typeof CreateBankAccountSchema>;
export type UpdateBankAccountDTO = z.infer<typeof UpdateBankAccountSchema>;
