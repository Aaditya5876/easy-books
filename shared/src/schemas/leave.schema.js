"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllocateLeaveSchema = exports.CreateLeaveRequestSchema = exports.CreateLeaveTypeSchema = exports.LeaveStatusEnum = void 0;
const zod_1 = require("zod");
exports.LeaveStatusEnum = zod_1.z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
exports.CreateLeaveTypeSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1),
    daysPerYear: zod_1.z.number().nonnegative(),
    isPaid: zod_1.z.boolean().default(true),
});
exports.CreateLeaveRequestSchema = zod_1.z.object({
    employeeId: zod_1.z.string().uuid(),
    leaveTypeId: zod_1.z.string().uuid(),
    startDate: zod_1.z.string(),
    endDate: zod_1.z.string(),
    reason: zod_1.z.string().optional(),
});
exports.AllocateLeaveSchema = zod_1.z.object({
    employeeId: zod_1.z.string().uuid(),
    leaveTypeId: zod_1.z.string().uuid(),
    fiscalYear: zod_1.z.string(),
    totalDays: zod_1.z.number().nonnegative(),
});
//# sourceMappingURL=leave.schema.js.map