"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateLedgerEntrySchema = exports.CreateLedgerEntrySchema = exports.UpdateLedgerAccountSchema = exports.CreateLedgerAccountSchema = exports.LedgerAccountTypeEnum = void 0;
const zod_1 = require("zod");
exports.LedgerAccountTypeEnum = zod_1.z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']);
exports.CreateLedgerAccountSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    accountName: zod_1.z.string().min(1),
    accountCode: zod_1.z.string().optional(),
    accountType: exports.LedgerAccountTypeEnum,
    openingBalance: zod_1.z.number().default(0),
    fiscalYear: zod_1.z.string().optional(),
    contactId: zod_1.z.string().uuid().optional(),
    contactType: zod_1.z.enum(['CLIENT', 'VENDOR']).optional(),
});
exports.UpdateLedgerAccountSchema = exports.CreateLedgerAccountSchema.omit({ companyId: true }).partial();
exports.CreateLedgerEntrySchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    debitAccountId: zod_1.z.string().uuid(),
    creditAccountId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
    dateAd: zod_1.z.string(),
    description: zod_1.z.string().optional(),
});
exports.UpdateLedgerEntrySchema = zod_1.z.object({
    description: zod_1.z.string().optional(),
    dateAd: zod_1.z.string().optional(),
});
//# sourceMappingURL=ledger.schema.js.map