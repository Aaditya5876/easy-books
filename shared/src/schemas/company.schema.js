"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCompanySchema = exports.CreateCompanySchema = void 0;
const zod_1 = require("zod");
exports.CreateCompanySchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    address: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    panVat: zod_1.z.string().optional(),
    currency: zod_1.z.string().default('NPR'),
    fiscalYearStart: zod_1.z.string().optional(),
});
exports.UpdateCompanySchema = exports.CreateCompanySchema.partial();
//# sourceMappingURL=company.schema.js.map