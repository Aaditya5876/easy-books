import { z } from 'zod';
import { withoutDefaults } from './update-schema';
import { isValidDateOnly } from '../business-setup';

export const CreateInventoryItemSchema = z.object({
  companyId: z.string().uuid(),
  partNumber: z.string().optional(),
  itemName: z.string().optional(),
  brand: z.string().optional(),
  modelNo: z.string().optional(),
  description: z.string().optional(),
  application: z.string().optional(),
  // An uploaded file's path (/uploads/…) or a full URL; '' = none. (.url()
  // rejected both the empty value and upload paths, so adding an item from
  // the Inventory page always failed.)
  imageUrl: z.string().max(500).optional().nullable(),
  quantity: z.number().default(0),
  unit: z.string().default('PCS'),
  unitPurchasePrice: z.number().nonnegative().default(0),
  unitSellingPrice: z.number().nonnegative().default(0),
  defaultDiscountPercent: z.number().min(0).max(100).default(0),
  stockLocation: z.string().optional(),
  lowStockThreshold: z.number().nonnegative().default(0),
  agingDays: z.number().int().positive().optional(),
  vendorId: z.string().uuid().optional(),
  // Pharmacy / food: batch and expiry (the form collected these before, but
  // they were dropped because the API didn't know them).
  batchNo: z.string().trim().max(60).optional().nullable(),
  expiryDate: z.string().refine(isValidDateOnly, 'Expiry date must be YYYY-MM-DD').optional().nullable().or(z.literal('')),
  expiryAlertDays: z.number().int().min(0).max(3650).optional().nullable(),
  supplierName: z.string().trim().max(120).optional().nullable(),
  // Values for the company's own item fields (Size, Colour…) — checked
  // against Company.itemFields in InventoryServiceImpl.
  customFields: z.record(z.string(), z.unknown()).optional().nullable(),
});

// Without defaults: renaming an item used to reset stock and prices to 0.
export const UpdateInventoryItemSchema = z.object(withoutDefaults(CreateInventoryItemSchema.shape)).omit({ companyId: true }).partial();

export type CreateInventoryItemDTO = z.infer<typeof CreateInventoryItemSchema>;
export type UpdateInventoryItemDTO = z.infer<typeof UpdateInventoryItemSchema>;
