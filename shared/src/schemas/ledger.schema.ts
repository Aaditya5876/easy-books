import { z } from 'zod';

export const LedgerAccountTypeEnum = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']);

export const CreateLedgerAccountSchema = z.object({
  companyId: z.string().uuid(),
  accountName: z.string().min(1),
  accountCode: z.string().optional(),
  accountType: LedgerAccountTypeEnum,
  openingBalance: z.number().default(0),
  fiscalYear: z.string().optional(),
  contactId: z.string().uuid().optional(),
  contactType: z.enum(['CLIENT', 'VENDOR']).optional(),
});

export const UpdateLedgerAccountSchema = CreateLedgerAccountSchema.omit({ companyId: true }).partial();

export const CreateLedgerEntrySchema = z.object({
  companyId: z.string().uuid(),
  accountId: z.string().uuid(),
  dateAd: z.string(),
  dateBs: z.string().optional(),
  description: z.string().optional(),
  debit: z.number().nonnegative().default(0),
  credit: z.number().nonnegative().default(0),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
});

export const UpdateLedgerEntrySchema = CreateLedgerEntrySchema.omit({ companyId: true }).partial();

export type CreateLedgerAccountDTO = z.infer<typeof CreateLedgerAccountSchema>;
export type UpdateLedgerAccountDTO = z.infer<typeof UpdateLedgerAccountSchema>;
export type CreateLedgerEntryDTO = z.infer<typeof CreateLedgerEntrySchema>;
export type UpdateLedgerEntryDTO = z.infer<typeof UpdateLedgerEntrySchema>;
