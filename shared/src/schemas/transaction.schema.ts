import { z } from 'zod';

export const TransactionTypeEnum = z.enum(['CASH', 'BANK', 'QR', 'CHEQUE']);
export const TransactionCategoryEnum = z.enum(['INCOME', 'EXPENSE', 'TRANSFER']);
export const TransactionStatusEnum = z.enum(['PENDING', 'COMPLETED', 'CANCELLED']);

export const CreateTransactionSchema = z.object({
  companyId: z.string().uuid(),
  dateAd: z.string(),
  dateBs: z.string().optional(),
  type: TransactionTypeEnum,
  category: TransactionCategoryEnum,
  amount: z.number().positive(),
  description: z.string().optional(),
  reference: z.string().optional(),
  status: TransactionStatusEnum.default('COMPLETED'),
});

export const UpdateTransactionSchema = CreateTransactionSchema.omit({ companyId: true }).partial();

export type CreateTransactionDTO = z.infer<typeof CreateTransactionSchema>;
export type UpdateTransactionDTO = z.infer<typeof UpdateTransactionSchema>;
