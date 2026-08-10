"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateDebitNoteSchema = exports.CreateCreditNoteSchema = exports.CreditNoteStatusEnum = void 0;
const zod_1 = require("zod");
exports.CreditNoteStatusEnum = zod_1.z.enum(['OPEN', 'APPLIED', 'CLOSED']);
exports.CreateCreditNoteSchema = zod_1.z.object({
    clientId: zod_1.z.string().uuid().optional(),
    salesOrderId: zod_1.z.string().uuid().optional(),
    dateAd: zod_1.z.string(),
    reason: zod_1.z.string().min(1),
    amount: zod_1.z.number().positive(),
    notes: zod_1.z.string().optional(),
});
exports.CreateDebitNoteSchema = zod_1.z.object({
    vendorId: zod_1.z.string().uuid().optional(),
    purchaseOrderId: zod_1.z.string().uuid().optional(),
    dateAd: zod_1.z.string(),
    reason: zod_1.z.string().min(1),
    amount: zod_1.z.number().positive(),
    notes: zod_1.z.string().optional(),
});
//# sourceMappingURL=credit-note.schema.js.map