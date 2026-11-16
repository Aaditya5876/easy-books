import { z } from 'zod';
import { SalesOrderItemSchema, PaymentMethodEnum } from './sales.schema';
import { withoutDefaults } from './update-schema';

export const QuotationRemarkEnum = z.enum(['QUOTED', 'WORK_DONE', 'CANCELLED', 'REVISED', 'BILLED']);
export const QuotationStatusEnum = z.enum(['ACTIVE', 'CONVERTED', 'EXPIRED']);

export const CreateQuotationSchema = z.object({
  companyId: z.string().uuid(),
  // Workflow job this record belongs to (must be the same company's task).
  taskId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional(),
  clientName: z.string().min(1),
  clientContact: z.string().optional().nullable(),
  clientAddress: z.string().optional().nullable(),
  clientPanVat: z.string().optional().nullable(),
  dateAd: z.string(),
  dateBs: z.string().optional(),
  validUntil: z.string().optional().nullable(),
  paymentMethod: PaymentMethodEnum.optional().nullable(),
  laborItems: z.array(z.object({ description: z.string(), amount: z.number().nonnegative() })).optional().nullable(),
  quotationNumber: z.string().min(1),
  items: z.array(SalesOrderItemSchema).min(1),
  description: z.string().optional(),
  totalAmount: z.number(),
  // Read by QuotationServiceImpl when it computes the totals; without these
  // here validation stripped them and VAT/labour were always ignored.
  isVat: z.boolean().optional(),
  laborCharges: z.number().nonnegative().optional(),
  remark: QuotationRemarkEnum.default('QUOTED'),
  status: QuotationStatusEnum.default('ACTIVE'),
});

// Without defaults: an edit must not flip a converted quotation back to ACTIVE
// (which allowed converting it into a second bill).
export const UpdateQuotationSchema = z.object(withoutDefaults(CreateQuotationSchema.shape)).omit({ companyId: true }).partial();

export type CreateQuotationDTO = z.infer<typeof CreateQuotationSchema>;
export type UpdateQuotationDTO = z.infer<typeof UpdateQuotationSchema>;
