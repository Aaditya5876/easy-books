import { z } from 'zod';

export const CreateInventoryItemSchema = z.object({
  companyId: z.string().uuid(),
  partNumber: z.string().optional(),
  itemName: z.string().optional(),
  brand: z.string().optional(),
  modelNo: z.string().optional(),
  description: z.string().optional(),
  application: z.string().optional(),
  imageUrl: z.string().url().optional(),
  quantity: z.number().default(0),
  unit: z.string().default('PCS'),
  unitPurchasePrice: z.number().nonnegative().default(0),
  unitSellingPrice: z.number().nonnegative().default(0),
  defaultDiscountPercent: z.number().min(0).max(100).default(0),
  stockLocation: z.string().optional(),
  lowStockThreshold: z.number().nonnegative().default(0),
  agingDays: z.number().int().positive().optional(),
  vendorId: z.string().uuid().optional(),
});

export const UpdateInventoryItemSchema = CreateInventoryItemSchema.omit({ companyId: true }).partial();

export type CreateInventoryItemDTO = z.infer<typeof CreateInventoryItemSchema>;
export type UpdateInventoryItemDTO = z.infer<typeof UpdateInventoryItemSchema>;
