"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateTaskSchema = exports.CreateTaskSchema = exports.TaskStatusEnum = exports.TaskPriorityEnum = void 0;
const zod_1 = require("zod");
exports.TaskPriorityEnum = zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']);
exports.TaskStatusEnum = zod_1.z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
exports.CreateTaskSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    assignedTo: zod_1.z.string().optional(),
    dueDate: zod_1.z.string().optional(),
    priority: exports.TaskPriorityEnum.default('MEDIUM'),
    status: exports.TaskStatusEnum.default('PENDING'),
    notes: zod_1.z.string().optional(),
});
exports.UpdateTaskSchema = exports.CreateTaskSchema.omit({ companyId: true }).partial();
//# sourceMappingURL=task.schema.js.map