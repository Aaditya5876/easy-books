"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateVendorSchema = exports.CreateVendorSchema = void 0;
const zod_1 = require("zod");
exports.CreateVendorSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1),
    abbreviation: zod_1.z.string().optional(),
    contactPerson: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    panVat: zod_1.z.string().optional(),
    bankDetails: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
exports.UpdateVendorSchema = exports.CreateVendorSchema.omit({ companyId: true }).partial();
//# sourceMappingURL=vendor.schema.js.map