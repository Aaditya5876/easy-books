import { z } from 'zod';
export declare const PayrollStatusEnum: z.ZodEnum<["PENDING", "PROCESSED", "PAID", "ON_HOLD"]>;
export declare const ProcessPayrollSchema: z.ZodObject<{
    companyId: z.ZodString;
    month: z.ZodString;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    month: string;
}, {
    companyId: string;
    month: string;
}>;
export declare const CalculateOnePayrollSchema: z.ZodObject<{
    companyId: z.ZodString;
    employeeId: z.ZodString;
    month: z.ZodString;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    employeeId: string;
    month: string;
}, {
    companyId: string;
    employeeId: string;
    month: string;
}>;
export declare const SetHoldSchema: z.ZodObject<{
    isOnHold: z.ZodBoolean;
    holdReason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    isOnHold: boolean;
    holdReason?: string | undefined;
}, {
    isOnHold: boolean;
    holdReason?: string | undefined;
}>;
export declare const PayrollSettingsSchema: z.ZodObject<{
    ssfApplicable: z.ZodDefault<z.ZodBoolean>;
    ssfEmployeeRate: z.ZodDefault<z.ZodNumber>;
    ssfEmployerRate: z.ZodDefault<z.ZodNumber>;
    pitApplicable: z.ZodDefault<z.ZodBoolean>;
    dashainBonusApplicable: z.ZodDefault<z.ZodBoolean>;
    dashainBonusMonth: z.ZodOptional<z.ZodString>;
    workingDaysPerMonth: z.ZodDefault<z.ZodNumber>;
    overtimeRatePerHour: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    ssfApplicable: boolean;
    ssfEmployeeRate: number;
    ssfEmployerRate: number;
    pitApplicable: boolean;
    dashainBonusApplicable: boolean;
    workingDaysPerMonth: number;
    overtimeRatePerHour: number;
    dashainBonusMonth?: string | undefined;
}, {
    ssfApplicable?: boolean | undefined;
    ssfEmployeeRate?: number | undefined;
    ssfEmployerRate?: number | undefined;
    pitApplicable?: boolean | undefined;
    dashainBonusApplicable?: boolean | undefined;
    dashainBonusMonth?: string | undefined;
    workingDaysPerMonth?: number | undefined;
    overtimeRatePerHour?: number | undefined;
}>;
export type ProcessPayrollDTO = z.infer<typeof ProcessPayrollSchema>;
export type CalculateOnePayrollDTO = z.infer<typeof CalculateOnePayrollSchema>;
export type SetHoldDTO = z.infer<typeof SetHoldSchema>;
export type PayrollSettingsDTO = z.infer<typeof PayrollSettingsSchema>;
