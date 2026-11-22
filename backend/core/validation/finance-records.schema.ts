import { z } from 'zod';

// Input checks for the finance records that took any body as-is: a missing
// date or amount used to reach the database and crash with a 500.

const text = (max = 120) => z.string().trim().min(1).max(max);
const optionalText = (max = 500) => z.string().trim().max(max).optional().nullable();
const date = z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: 'must be a valid date' });
const money = z.coerce.number().finite().positive();

export const CreateBankGuaranteeSchema = z.object({
  bgNumber: text(60),
  partyName: text(),
  bankName: text(),
  amount: money,
  issuedDateAd: date,
  expiryDateAd: date,
  purpose: optionalText(),
  notes: optionalText(),
}).refine((d) => Date.parse(d.expiryDateAd) >= Date.parse(d.issuedDateAd), {
  message: 'must be on or after the issue date', path: ['expiryDateAd'],
});

export const CreateChequeSchema = z.object({
  chequeNumber: text(40),
  partyName: text(),
  amount: money,
  dateAd: date,
  isReceivable: z.boolean(),
  bankAccountId: z.string().uuid().optional().nullable(),
  referenceType: optionalText(40),
  referenceId: z.string().uuid().optional().nullable(),
  notes: optionalText(),
});

export const CreatePettyCashSchema = z.object({
  voucherNo: text(40),
  dateAd: date,
  amount: money,
  description: text(500),
  category: optionalText(80),
  paidTo: optionalText(120),
  approvedBy: optionalText(120),
});

export const CreateFixedAssetSchema = z.object({
  companyId: z.string().uuid(),
  assetName: text(),
  assetCode: optionalText(40),
  category: optionalText(80),
  purchaseDateAd: date,
  cost: money,
  usefulLifeYears: z.coerce.number().int().positive(),
  salvageValue: z.coerce.number().finite().min(0).optional(),
  paymentMethod: z.enum(['CASH', 'BANK', 'CREDIT']).optional(),
  notes: optionalText(),
}).refine((d) => (d.salvageValue ?? 0) <= d.cost, { message: "can't be more than the cost", path: ['salvageValue'] });
