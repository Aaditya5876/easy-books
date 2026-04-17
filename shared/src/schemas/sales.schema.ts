import { z } from 'zod';

export const OrderStatusEnum = z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']);

export const OrderItemSchema = z.object({
  itemId: z.string().uuid().optional(),
  description: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  total: z.number(),
});

export const CreateSalesOrderSchema = z.object({
  companyId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  clientName: z.string().min(1),
  clientContact: z.string().optional(),
  clientAddress: z.string().optional(),
  dateAd: z.string(),
  dateBs: z.string().optional(),
  invoiceNumber: z.string().min(1),
  items: z.array(OrderItemSchema).min(1),
  laborCharges: z.number().default(0),
  isVat: z.boolean().default(false),
  subtotal: z.number(),
  vatAmount: z.number().default(0),
  totalAmount: z.number(),
  status: OrderStatusEnum.default('PENDING'),
});

export const UpdateSalesOrderSchema = CreateSalesOrderSchema.omit({ companyId: true }).partial();

export type CreateSalesOrderDTO = z.infer<typeof CreateSalesOrderSchema>;
export type UpdateSalesOrderDTO = z.infer<typeof UpdateSalesOrderSchema>;
export type OrderItemDTO = z.infer<typeof OrderItemSchema>;
