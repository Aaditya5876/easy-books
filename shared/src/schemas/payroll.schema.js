"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollSettingsSchema = exports.SetHoldSchema = exports.CalculateOnePayrollSchema = exports.ProcessPayrollSchema = exports.PayrollStatusEnum = void 0;
const zod_1 = require("zod");
exports.PayrollStatusEnum = zod_1.z.enum(['PENDING', 'PROCESSED', 'PAID', 'ON_HOLD']);
exports.ProcessPayrollSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    month: zod_1.z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM (BS year, e.g. 2081-01)'),
});
exports.CalculateOnePayrollSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    employeeId: zod_1.z.string().uuid(),
    month: zod_1.z.string().regex(/^\d{4}-\d{2}$/),
});
exports.SetHoldSchema = zod_1.z.object({
    isOnHold: zod_1.z.boolean(),
    holdReason: zod_1.z.string().optional(),
});
exports.PayrollSettingsSchema = zod_1.z.object({
    ssfApplicable: zod_1.z.boolean().default(true),
    ssfEmployeeRate: zod_1.z.number().min(0).max(100).default(11),
    ssfEmployerRate: zod_1.z.number().min(0).max(100).default(20),
    pitApplicable: zod_1.z.boolean().default(true),
    dashainBonusApplicable: zod_1.z.boolean().default(true),
    dashainBonusMonth: zod_1.z.string().optional(),
    workingDaysPerMonth: zod_1.z.number().int().min(1).max(31).default(26),
    overtimeRatePerHour: zod_1.z.number().nonnegative().default(0),
});
//# sourceMappingURL=payroll.schema.js.map