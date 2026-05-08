import { z } from 'zod';

export const CreditNoteStatusEnum = z.enum(['OPEN', 'APPLIED', 'CLOSED']);

export const CreateCreditNoteSchema = z.object({
  clientId: z.string().uuid().optional(),
  salesOrderId: z.string().uuid().optional(),
  dateAd: z.string(),
  reason: z.string().min(1),
  amount: z.number().positive(),
  notes: z.string().optional(),
});

export const CreateDebitNoteSchema = z.object({
  vendorId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  dateAd: z.string(),
  reason: z.string().min(1),
  amount: z.number().positive(),
  notes: z.string().optional(),
});

export type CreateCreditNoteDTO = z.infer<typeof CreateCreditNoteSchema>;
export type CreateDebitNoteDTO = z.infer<typeof CreateDebitNoteSchema>;
