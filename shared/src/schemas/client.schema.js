"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateClientSchema = exports.CreateClientSchema = exports.ClientStatusEnum = void 0;
const zod_1 = require("zod");
exports.ClientStatusEnum = zod_1.z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT']);
exports.CreateClientSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1),
    abbreviation: zod_1.z.string().optional(),
    contactPerson: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    panVat: zod_1.z.string().optional(),
    crmStatus: exports.ClientStatusEnum.default('ACTIVE'),
    notes: zod_1.z.string().optional(),
});
exports.UpdateClientSchema = exports.CreateClientSchema.omit({ companyId: true }).partial();
//# sourceMappingURL=client.schema.js.map