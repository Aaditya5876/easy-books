import { z } from 'zod';
import { SalesOrderItemSchema, OrderStatusEnum, PaymentMethodEnum } from './sales.schema';

export const CreatePurchaseOrderSchema = z.object({
  companyId: z.string().uuid(),
  vendorId: z.string().uuid().optional(),
  vendorName: z.string().min(1),
  vendorContact: z.string().optional(),
  vendorAddress: z.string().optional(),
  vendorPanVat: z.string().optional(),
  dateAd: z.string(),
  isVat: z.boolean().default(false),
  laborCharges: z.number().nonnegative().default(0),
  paymentMethod: PaymentMethodEnum.default('CASH'),
  notes: z.string().optional(),
  items: z.array(SalesOrderItemSchema).min(1),
});

export const RecordPurchasePaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: PaymentMethodEnum,
  referenceNumber: z.string().optional(),
  dateAd: z.string(),
  notes: z.string().optional(),
});

export const UpdatePurchaseOrderSchema = z.object({
  notes: z.string().optional(),
  status: OrderStatusEnum.optional(),
});

export type CreatePurchaseOrderDTO = z.infer<typeof CreatePurchaseOrderSchema>;
export type UpdatePurchaseOrderDTO = z.infer<typeof UpdatePurchaseOrderSchema>;
export type RecordPurchasePaymentDTO = z.infer<typeof RecordPurchasePaymentSchema>;
