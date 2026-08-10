"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAttendanceSchema = exports.BulkAttendanceSchema = exports.CreateAttendanceSchema = exports.AttendanceStatusEnum = void 0;
const zod_1 = require("zod");
exports.AttendanceStatusEnum = zod_1.z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY']);
exports.CreateAttendanceSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    employeeId: zod_1.z.string().uuid(),
    date: zod_1.z.string(),
    status: exports.AttendanceStatusEnum,
    checkInTime: zod_1.z.string().optional(),
    checkOutTime: zod_1.z.string().optional(),
    overtimeHours: zod_1.z.number().nonnegative().default(0),
    notes: zod_1.z.string().optional(),
});
exports.BulkAttendanceSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    date: zod_1.z.string(),
    records: zod_1.z.array(zod_1.z.object({
        employeeId: zod_1.z.string().uuid(),
        status: exports.AttendanceStatusEnum,
        checkInTime: zod_1.z.string().optional(),
        checkOutTime: zod_1.z.string().optional(),
        overtimeHours: zod_1.z.number().nonnegative().default(0),
        notes: zod_1.z.string().optional(),
    })).min(1),
});
exports.UpdateAttendanceSchema = exports.CreateAttendanceSchema.omit({ companyId: true }).partial();
//# sourceMappingURL=attendance.schema.js.map