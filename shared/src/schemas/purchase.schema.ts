import { z } from 'zod';
import { OrderItemSchema, OrderStatusEnum } from './sales.schema';

export const CreatePurchaseOrderSchema = z.object({
  companyId: z.string().uuid(),
  vendorId: z.string().uuid().optional(),
  vendorName: z.string().min(1),
  vendorContact: z.string().optional(),
  vendorAddress: z.string().optional(),
  dateAd: z.string(),
  dateBs: z.string().optional(),
  orderNumber: z.string().min(1),
  items: z.array(OrderItemSchema).min(1),
  laborCharges: z.number().default(0),
  isVat: z.boolean().default(false),
  subtotal: z.number(),
  vatAmount: z.number().default(0),
  totalAmount: z.number(),
  status: OrderStatusEnum.default('PENDING'),
});

export const UpdatePurchaseOrderSchema = CreatePurchaseOrderSchema.omit({ companyId: true }).partial();

export type CreatePurchaseOrderDTO = z.infer<typeof CreatePurchaseOrderSchema>;
export type UpdatePurchaseOrderDTO = z.infer<typeof UpdatePurchaseOrderSchema>;
