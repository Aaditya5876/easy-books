import { z } from 'zod';
export declare const TaskPriorityEnum: z.ZodEnum<["LOW", "MEDIUM", "HIGH"]>;
export declare const TaskStatusEnum: z.ZodEnum<["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]>;
export declare const CreateTaskSchema: z.ZodObject<{
    companyId: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    assignedTo: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
    priority: z.ZodDefault<z.ZodEnum<["LOW", "MEDIUM", "HIGH"]>>;
    status: z.ZodDefault<z.ZodEnum<["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "PENDING" | "COMPLETED" | "CANCELLED" | "IN_PROGRESS";
    companyId: string;
    title: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    description?: string | undefined;
    notes?: string | undefined;
    assignedTo?: string | undefined;
    dueDate?: string | undefined;
}, {
    companyId: string;
    title: string;
    status?: "PENDING" | "COMPLETED" | "CANCELLED" | "IN_PROGRESS" | undefined;
    description?: string | undefined;
    notes?: string | undefined;
    assignedTo?: string | undefined;
    dueDate?: string | undefined;
    priority?: "LOW" | "MEDIUM" | "HIGH" | undefined;
}>;
export declare const UpdateTaskSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]>>>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    title: z.ZodOptional<z.ZodString>;
    assignedTo: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    dueDate: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    priority: z.ZodOptional<z.ZodDefault<z.ZodEnum<["LOW", "MEDIUM", "HIGH"]>>>;
}, "strip", z.ZodTypeAny, {
    status?: "PENDING" | "COMPLETED" | "CANCELLED" | "IN_PROGRESS" | undefined;
    description?: string | undefined;
    notes?: string | undefined;
    title?: string | undefined;
    assignedTo?: string | undefined;
    dueDate?: string | undefined;
    priority?: "LOW" | "MEDIUM" | "HIGH" | undefined;
}, {
    status?: "PENDING" | "COMPLETED" | "CANCELLED" | "IN_PROGRESS" | undefined;
    description?: string | undefined;
    notes?: string | undefined;
    title?: string | undefined;
    assignedTo?: string | undefined;
    dueDate?: string | undefined;
    priority?: "LOW" | "MEDIUM" | "HIGH" | undefined;
}>;
export type CreateTaskDTO = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskDTO = z.infer<typeof UpdateTaskSchema>;
