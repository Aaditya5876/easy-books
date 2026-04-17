import { z } from 'zod';

export const InventoryUnitEnum = z.enum(['PIECE', 'SET', 'LITER', 'ML', 'KG', 'GM', 'NOS']);

export const CreateInventoryItemSchema = z.object({
  companyId: z.string().uuid(),
  brand: z.string().optional(),
  modelNo: z.string().optional(),
  description: z.string().optional(),
  application: z.string().optional(),
  imageUrl: z.string().url().optional(),
  quantity: z.number().default(0),
  unit: InventoryUnitEnum.default('PIECE'),
  unitPurchasePrice: z.number().default(0),
  unitSellingPrice: z.number().default(0),
  stockLocation: z.string().optional(),
  lowStockThreshold: z.number().default(0),
  agingDays: z.number().optional(),
  supplierName: z.string().optional(),
});

export const UpdateInventoryItemSchema = CreateInventoryItemSchema.omit({ companyId: true }).partial();

export type CreateInventoryItemDTO = z.infer<typeof CreateInventoryItemSchema>;
export type UpdateInventoryItemDTO = z.infer<typeof UpdateInventoryItemSchema>;
