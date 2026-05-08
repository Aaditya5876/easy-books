import { z } from 'zod';

export const OrderStatusEnum = z.enum(['PENDING', 'CONFIRMED', 'PARTIALLY_PAID', 'COMPLETED', 'CANCELLED']);
export const PaymentMethodEnum = z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'QR', 'CREDIT']);

export const SalesOrderItemSchema = z.object({
  inventoryItemId: z.string().uuid().optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().optional(),
  unitPrice: z.number().nonnegative(),
  discountPercent: z.number().min(0).max(100).default(0),
});

export const CreateSalesOrderSchema = z.object({
  companyId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  clientName: z.string().min(1),
  clientContact: z.string().optional(),
  clientAddress: z.string().optional(),
  clientPanVat: z.string().optional(),
  dateAd: z.string(),
  isVat: z.boolean().default(false),
  laborCharges: z.number().nonnegative().default(0),
  paymentMethod: PaymentMethodEnum.default('CASH'),
  issuedBy: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(SalesOrderItemSchema).min(1),
});

export const RecordSalesPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: PaymentMethodEnum,
  referenceNumber: z.string().optional(),
  dateAd: z.string(),
  notes: z.string().optional(),
});

export const UpdateSalesOrderSchema = z.object({
  notes: z.string().optional(),
  status: OrderStatusEnum.optional(),
});

export type CreateSalesOrderDTO = z.infer<typeof CreateSalesOrderSchema>;
export type UpdateSalesOrderDTO = z.infer<typeof UpdateSalesOrderSchema>;
export type RecordSalesPaymentDTO = z.infer<typeof RecordSalesPaymentSchema>;
export type SalesOrderItemDTO = z.infer<typeof SalesOrderItemSchema>;
