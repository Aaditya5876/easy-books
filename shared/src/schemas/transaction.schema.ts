import { z } from 'zod';

export const TransactionTypeEnum = z.enum(['CASH', 'BANK', 'WALLET', 'CHEQUE', 'CREDIT']);
export const TransactionCategoryEnum = z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'INVESTMENT', 'HAND_OUTS']);
export const TransactionStatusEnum = z.enum(['PENDING', 'COMPLETED', 'CANCELLED']);

export const CreateTransactionSchema = z.object({
  companyId: z.string().uuid(),
  dateAd: z.string(),
  dateBs: z.string().optional(),
  type: TransactionTypeEnum,
  category: TransactionCategoryEnum,
  amount: z.number().positive(),
  description: z.string().optional(),
  partyName: z.string().optional(),
  reference: z.string().optional(),
  status: TransactionStatusEnum.default('COMPLETED'),
  // Every transaction is a balanced double-entry — see LedgerPostingService.postManualJournalEntryTx.
  debitAccountId: z.string().uuid().optional(),
  creditAccountId: z.string().uuid().optional(),
  // A matched/created party (vendor or customer) Ledger account — tracked as a
  // running spend/income total regardless of payment method, via a separate
  // single-sided memo entry (see LedgerPostingService.postPartyMemoEntryTx).
  // Deliberately NOT one of the two balanced legs above — it never replaces
  // the real Cash/Bank/Payable/Receivable posting.
  partyAccountId: z.string().uuid().optional(),
});

export const UpdateTransactionSchema = CreateTransactionSchema.omit({ companyId: true }).partial();

export type CreateTransactionDTO = z.infer<typeof CreateTransactionSchema>;
export type UpdateTransactionDTO = z.infer<typeof UpdateTransactionSchema>;
