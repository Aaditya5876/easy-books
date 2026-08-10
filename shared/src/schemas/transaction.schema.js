"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateTransactionSchema = exports.CreateTransactionSchema = exports.TransactionStatusEnum = exports.TransactionCategoryEnum = exports.TransactionTypeEnum = void 0;
const zod_1 = require("zod");
exports.TransactionTypeEnum = zod_1.z.enum(['CASH', 'BANK', 'QR', 'CHEQUE', 'CREDIT']);
exports.TransactionCategoryEnum = zod_1.z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'INVESTMENT', 'HAND_OUTS']);
exports.TransactionStatusEnum = zod_1.z.enum(['PENDING', 'COMPLETED', 'CANCELLED']);
exports.CreateTransactionSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    dateAd: zod_1.z.string(),
    dateBs: zod_1.z.string().optional(),
    type: exports.TransactionTypeEnum,
    category: exports.TransactionCategoryEnum,
    amount: zod_1.z.number().positive(),
    description: zod_1.z.string().optional(),
    partyName: zod_1.z.string().optional(),
    reference: zod_1.z.string().optional(),
    status: exports.TransactionStatusEnum.default('COMPLETED'),
    debitAccountId: zod_1.z.string().uuid().optional(),
    creditAccountId: zod_1.z.string().uuid().optional(),
});
exports.UpdateTransactionSchema = exports.CreateTransactionSchema.omit({ companyId: true }).partial();
//# sourceMappingURL=transaction.schema.js.map