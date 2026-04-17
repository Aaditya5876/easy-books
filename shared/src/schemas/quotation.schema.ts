import { z } from 'zod';
import { OrderItemSchema } from './sales.schema';

export const QuotationRemarkEnum = z.enum(['QUOTED', 'WORK_DONE', 'CANCELLED', 'REVISED', 'BILLED']);
export const QuotationStatusEnum = z.enum(['ACTIVE', 'CONVERTED', 'EXPIRED']);

export const CreateQuotationSchema = z.object({
  companyId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  clientName: z.string().min(1),
  dateAd: z.string(),
  dateBs: z.string().optional(),
  quotationNumber: z.string().min(1),
  items: z.array(OrderItemSchema).min(1),
  description: z.string().optional(),
  totalAmount: z.number(),
  remark: QuotationRemarkEnum.default('QUOTED'),
  status: QuotationStatusEnum.default('ACTIVE'),
});

export const UpdateQuotationSchema = CreateQuotationSchema.omit({ companyId: true }).partial();

export type CreateQuotationDTO = z.infer<typeof CreateQuotationSchema>;
export type UpdateQuotationDTO = z.infer<typeof UpdateQuotationSchema>;
