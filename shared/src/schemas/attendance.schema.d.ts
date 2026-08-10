import { z } from 'zod';
export declare const AttendanceStatusEnum: z.ZodEnum<["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "HOLIDAY"]>;
export declare const CreateAttendanceSchema: z.ZodObject<{
    companyId: z.ZodString;
    employeeId: z.ZodString;
    date: z.ZodString;
    status: z.ZodEnum<["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "HOLIDAY"]>;
    checkInTime: z.ZodOptional<z.ZodString>;
    checkOutTime: z.ZodOptional<z.ZodString>;
    overtimeHours: z.ZodDefault<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY";
    companyId: string;
    employeeId: string;
    date: string;
    overtimeHours: number;
    notes?: string | undefined;
    checkInTime?: string | undefined;
    checkOutTime?: string | undefined;
}, {
    status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY";
    companyId: string;
    employeeId: string;
    date: string;
    notes?: string | undefined;
    checkInTime?: string | undefined;
    checkOutTime?: string | undefined;
    overtimeHours?: number | undefined;
}>;
export declare const BulkAttendanceSchema: z.ZodObject<{
    companyId: z.ZodString;
    date: z.ZodString;
    records: z.ZodArray<z.ZodObject<{
        employeeId: z.ZodString;
        status: z.ZodEnum<["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "HOLIDAY"]>;
        checkInTime: z.ZodOptional<z.ZodString>;
        checkOutTime: z.ZodOptional<z.ZodString>;
        overtimeHours: z.ZodDefault<z.ZodNumber>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY";
        employeeId: string;
        overtimeHours: number;
        notes?: string | undefined;
        checkInTime?: string | undefined;
        checkOutTime?: string | undefined;
    }, {
        status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY";
        employeeId: string;
        notes?: string | undefined;
        checkInTime?: string | undefined;
        checkOutTime?: string | undefined;
        overtimeHours?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    date: string;
    records: {
        status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY";
        employeeId: string;
        overtimeHours: number;
        notes?: string | undefined;
        checkInTime?: string | undefined;
        checkOutTime?: string | undefined;
    }[];
}, {
    companyId: string;
    date: string;
    records: {
        status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY";
        employeeId: string;
        notes?: string | undefined;
        checkInTime?: string | undefined;
        checkOutTime?: string | undefined;
        overtimeHours?: number | undefined;
    }[];
}>;
export declare const UpdateAttendanceSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "HOLIDAY"]>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    employeeId: z.ZodOptional<z.ZodString>;
    date: z.ZodOptional<z.ZodString>;
    checkInTime: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    checkOutTime: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    overtimeHours: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    status?: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY" | undefined;
    notes?: string | undefined;
    employeeId?: string | undefined;
    date?: string | undefined;
    checkInTime?: string | undefined;
    checkOutTime?: string | undefined;
    overtimeHours?: number | undefined;
}, {
    status?: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY" | undefined;
    notes?: string | undefined;
    employeeId?: string | undefined;
    date?: string | undefined;
    checkInTime?: string | undefined;
    checkOutTime?: string | undefined;
    overtimeHours?: number | undefined;
}>;
export type CreateAttendanceDTO = z.infer<typeof CreateAttendanceSchema>;
export type UpdateAttendanceDTO = z.infer<typeof UpdateAttendanceSchema>;
export type BulkAttendanceDTO = z.infer<typeof BulkAttendanceSchema>;
