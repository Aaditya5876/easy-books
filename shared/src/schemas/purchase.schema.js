"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePurchaseOrderSchema = exports.RecordPurchasePaymentSchema = exports.CreatePurchaseOrderSchema = void 0;
const zod_1 = require("zod");
const sales_schema_1 = require("./sales.schema");
exports.CreatePurchaseOrderSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    vendorId: zod_1.z.string().uuid().optional(),
    vendorName: zod_1.z.string().min(1),
    vendorContact: zod_1.z.string().optional(),
    vendorAddress: zod_1.z.string().optional(),
    vendorPanVat: zod_1.z.string().optional(),
    dateAd: zod_1.z.string(),
    isVat: zod_1.z.boolean().default(false),
    laborCharges: zod_1.z.number().nonnegative().default(0),
    paymentMethod: sales_schema_1.PaymentMethodEnum.default('CASH'),
    notes: zod_1.z.string().optional(),
    items: zod_1.z.array(sales_schema_1.SalesOrderItemSchema).min(1),
});
exports.RecordPurchasePaymentSchema = zod_1.z.object({
    amount: zod_1.z.number().positive(),
    paymentMethod: sales_schema_1.PaymentMethodEnum,
    referenceNumber: zod_1.z.string().optional(),
    dateAd: zod_1.z.string(),
    notes: zod_1.z.string().optional(),
});
exports.UpdatePurchaseOrderSchema = zod_1.z.object({
    notes: zod_1.z.string().optional(),
    status: sales_schema_1.OrderStatusEnum.optional(),
});
//# sourceMappingURL=purchase.schema.js.map