"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateBankAccountSchema = exports.CreateBankAccountSchema = void 0;
const zod_1 = require("zod");
exports.CreateBankAccountSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    bankName: zod_1.z.string().min(1),
    accountNumber: zod_1.z.string().min(1),
    accountType: zod_1.z.string().optional(),
    branch: zod_1.z.string().optional(),
    currentBalance: zod_1.z.number().default(0),
    portalUrl: zod_1.z.string().url().optional(),
});
exports.UpdateBankAccountSchema = exports.CreateBankAccountSchema.omit({ companyId: true }).partial();
//# sourceMappingURL=bank-account.schema.js.map