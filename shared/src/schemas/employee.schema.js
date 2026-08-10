"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateEmployeeSchema = exports.CreateEmployeeSchema = exports.EmployeeStatusEnum = void 0;
const zod_1 = require("zod");
exports.EmployeeStatusEnum = zod_1.z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']);
exports.CreateEmployeeSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1),
    employeeId: zod_1.z.string().min(1),
    department: zod_1.z.string().optional(),
    designation: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    address: zod_1.z.string().optional(),
    panNumber: zod_1.z.string().optional(),
    dateOfJoining: zod_1.z.string().optional(),
    basicSalary: zod_1.z.number().nonnegative().default(0),
    allowances: zod_1.z.record(zod_1.z.number()).optional(),
    bankName: zod_1.z.string().optional(),
    bankAccount: zod_1.z.string().optional(),
    status: exports.EmployeeStatusEnum.default('ACTIVE'),
});
exports.UpdateEmployeeSchema = exports.CreateEmployeeSchema.omit({ companyId: true }).partial();
//# sourceMappingURL=employee.schema.js.map