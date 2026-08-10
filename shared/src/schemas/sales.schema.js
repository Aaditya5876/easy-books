"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSalesOrderSchema = exports.RecordSalesPaymentSchema = exports.CreateSalesOrderSchema = exports.SalesOrderItemSchema = exports.PaymentMethodEnum = exports.OrderStatusEnum = void 0;
const zod_1 = require("zod");
exports.OrderStatusEnum = zod_1.z.enum(['PENDING', 'CONFIRMED', 'PARTIALLY_PAID', 'COMPLETED', 'CANCELLED']);
exports.PaymentMethodEnum = zod_1.z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'QR', 'CREDIT']);
exports.SalesOrderItemSchema = zod_1.z.object({
    inventoryItemId: zod_1.z.string().uuid().optional(),
    description: zod_1.z.string().min(1),
    quantity: zod_1.z.number().positive(),
    unit: zod_1.z.string().optional(),
    unitPrice: zod_1.z.number().nonnegative(),
    discountPercent: zod_1.z.number().min(0).max(100).default(0),
});
exports.CreateSalesOrderSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    clientId: zod_1.z.string().uuid().optional(),
    clientName: zod_1.z.string().min(1),
    clientContact: zod_1.z.string().optional(),
    clientAddress: zod_1.z.string().optional(),
    clientPanVat: zod_1.z.string().optional(),
    dateAd: zod_1.z.string(),
    isVat: zod_1.z.boolean().default(false),
    laborCharges: zod_1.z.number().nonnegative().default(0),
    paymentMethod: exports.PaymentMethodEnum.default('CASH'),
    issuedBy: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    items: zod_1.z.array(exports.SalesOrderItemSchema).min(1),
});
exports.RecordSalesPaymentSchema = zod_1.z.object({
    amount: zod_1.z.number().positive(),
    paymentMethod: exports.PaymentMethodEnum,
    referenceNumber: zod_1.z.string().optional(),
    dateAd: zod_1.z.string(),
    notes: zod_1.z.string().optional(),
});
exports.UpdateSalesOrderSchema = zod_1.z.object({
    notes: zod_1.z.string().optional(),
    status: exports.OrderStatusEnum.optional(),
});
//# sourceMappingURL=sales.schema.js.map