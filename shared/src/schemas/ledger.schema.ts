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

// Manual ledger entries are always a balanced double-entry pair — the API
// takes both legs (debit account + credit account) and a single amount, and
// the backend creates both rows plus both balance updates atomically. There
// is no single-sided entry creation; see LedgerPostingService.postManualJournalEntry.
export const CreateLedgerEntrySchema = z.object({
  companyId: z.string().uuid(),
  debitAccountId: z.string().uuid(),
  creditAccountId: z.string().uuid(),
  amount: z.number().positive(),
  dateAd: z.string(),
  description: z.string().optional(),
});

// Amounts/accounts are immutable after creation (they're paired) — only
// description and date can be edited; delete and re-create to change amounts.
export const UpdateLedgerEntrySchema = z.object({
  description: z.string().optional(),
  dateAd: z.string().optional(),
});

export type CreateLedgerAccountDTO = z.infer<typeof CreateLedgerAccountSchema>;
export type UpdateLedgerAccountDTO = z.infer<typeof UpdateLedgerAccountSchema>;
export type CreateLedgerEntryDTO = z.infer<typeof CreateLedgerEntrySchema>;
export type UpdateLedgerEntryDTO = z.infer<typeof UpdateLedgerEntrySchema>;
