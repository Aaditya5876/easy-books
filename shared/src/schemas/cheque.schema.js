"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePettyCashVoucherSchema = exports.CreateBankGuaranteeSchema = exports.CreateChequeSchema = exports.BankGuaranteeStatusEnum = exports.ChequeStatusEnum = void 0;
const zod_1 = require("zod");
exports.ChequeStatusEnum = zod_1.z.enum(['ISSUED', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'CANCELLED']);
exports.BankGuaranteeStatusEnum = zod_1.z.enum(['ACTIVE', 'EXPIRED', 'CLAIMED', 'RELEASED']);
exports.CreateChequeSchema = zod_1.z.object({
    chequeNumber: zod_1.z.string().min(1),
    partyName: zod_1.z.string().min(1),
    amount: zod_1.z.number().positive(),
    dateAd: zod_1.z.string(),
    isReceivable: zod_1.z.boolean(),
    bankAccountId: zod_1.z.string().uuid().optional(),
    referenceType: zod_1.z.string().optional(),
    referenceId: zod_1.z.string().uuid().optional(),
    notes: zod_1.z.string().optional(),
});
exports.CreateBankGuaranteeSchema = zod_1.z.object({
    bgNumber: zod_1.z.string().min(1),
    partyName: zod_1.z.string().min(1),
    bankName: zod_1.z.string().min(1),
    amount: zod_1.z.number().positive(),
    issuedDateAd: zod_1.z.string(),
    expiryDateAd: zod_1.z.string(),
    purpose: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
exports.CreatePettyCashVoucherSchema = zod_1.z.object({
    voucherNo: zod_1.z.string().min(1),
    dateAd: zod_1.z.string(),
    amount: zod_1.z.number().positive(),
    description: zod_1.z.string().min(1),
    category: zod_1.z.string().optional(),
    paidTo: zod_1.z.string().optional(),
    approvedBy: zod_1.z.string().optional(),
});
//# sourceMappingURL=cheque.schema.js.map