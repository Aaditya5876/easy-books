"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateInventoryItemSchema = exports.CreateInventoryItemSchema = void 0;
const zod_1 = require("zod");
exports.CreateInventoryItemSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    partNumber: zod_1.z.string().optional(),
    itemName: zod_1.z.string().optional(),
    brand: zod_1.z.string().optional(),
    modelNo: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    application: zod_1.z.string().optional(),
    imageUrl: zod_1.z.string().url().optional(),
    quantity: zod_1.z.number().default(0),
    unit: zod_1.z.string().default('PCS'),
    unitPurchasePrice: zod_1.z.number().nonnegative().default(0),
    unitSellingPrice: zod_1.z.number().nonnegative().default(0),
    defaultDiscountPercent: zod_1.z.number().min(0).max(100).default(0),
    stockLocation: zod_1.z.string().optional(),
    lowStockThreshold: zod_1.z.number().nonnegative().default(0),
    agingDays: zod_1.z.number().int().positive().optional(),
    vendorId: zod_1.z.string().uuid().optional(),
});
exports.UpdateInventoryItemSchema = exports.CreateInventoryItemSchema.omit({ companyId: true }).partial();
//# sourceMappingURL=inventory.schema.js.map