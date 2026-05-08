import { z } from 'zod';

export const ChequeStatusEnum = z.enum(['ISSUED', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'CANCELLED']);
export const BankGuaranteeStatusEnum = z.enum(['ACTIVE', 'EXPIRED', 'CLAIMED', 'RELEASED']);

export const CreateChequeSchema = z.object({
  chequeNumber: z.string().min(1),
  partyName: z.string().min(1),
  amount: z.number().positive(),
  dateAd: z.string(),
  isReceivable: z.boolean(),
  bankAccountId: z.string().uuid().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const CreateBankGuaranteeSchema = z.object({
  bgNumber: z.string().min(1),
  partyName: z.string().min(1),
  bankName: z.string().min(1),
  amount: z.number().positive(),
  issuedDateAd: z.string(),
  expiryDateAd: z.string(),
  purpose: z.string().optional(),
  notes: z.string().optional(),
});

export const CreatePettyCashVoucherSchema = z.object({
  voucherNo: z.string().min(1),
  dateAd: z.string(),
  amount: z.number().positive(),
  description: z.string().min(1),
  category: z.string().optional(),
  paidTo: z.string().optional(),
  approvedBy: z.string().optional(),
});

export type CreateChequeDTO = z.infer<typeof CreateChequeSchema>;
export type CreateBankGuaranteeDTO = z.infer<typeof CreateBankGuaranteeSchema>;
export type CreatePettyCashVoucherDTO = z.infer<typeof CreatePettyCashVoucherSchema>;
