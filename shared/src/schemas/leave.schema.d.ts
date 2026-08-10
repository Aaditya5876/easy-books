import { z } from 'zod';
export declare const LeaveStatusEnum: z.ZodEnum<["PENDING", "APPROVED", "REJECTED", "CANCELLED"]>;
export declare const CreateLeaveTypeSchema: z.ZodObject<{
    companyId: z.ZodString;
    name: z.ZodString;
    daysPerYear: z.ZodNumber;
    isPaid: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    companyId: string;
    daysPerYear: number;
    isPaid: boolean;
}, {
    name: string;
    companyId: string;
    daysPerYear: number;
    isPaid?: boolean | undefined;
}>;
export declare const CreateLeaveRequestSchema: z.ZodObject<{
    employeeId: z.ZodString;
    leaveTypeId: z.ZodString;
    startDate: z.ZodString;
    endDate: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason?: string | undefined;
}, {
    employeeId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason?: string | undefined;
}>;
export declare const AllocateLeaveSchema: z.ZodObject<{
    employeeId: z.ZodString;
    leaveTypeId: z.ZodString;
    fiscalYear: z.ZodString;
    totalDays: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    leaveTypeId: string;
    fiscalYear: string;
    totalDays: number;
}, {
    employeeId: string;
    leaveTypeId: string;
    fiscalYear: string;
    totalDays: number;
}>;
export type CreateLeaveTypeDTO = z.infer<typeof CreateLeaveTypeSchema>;
export type CreateLeaveRequestDTO = z.infer<typeof CreateLeaveRequestSchema>;
export type AllocateLeaveDTO = z.infer<typeof AllocateLeaveSchema>;
