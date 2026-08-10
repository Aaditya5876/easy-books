import { z } from 'zod';
export declare const CreateBankAccountSchema: z.ZodObject<{
    companyId: z.ZodString;
    bankName: z.ZodString;
    accountNumber: z.ZodString;
    accountType: z.ZodOptional<z.ZodString>;
    branch: z.ZodOptional<z.ZodString>;
    currentBalance: z.ZodDefault<z.ZodNumber>;
    portalUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    bankName: string;
    accountNumber: string;
    currentBalance: number;
    accountType?: string | undefined;
    branch?: string | undefined;
    portalUrl?: string | undefined;
}, {
    companyId: string;
    bankName: string;
    accountNumber: string;
    accountType?: string | undefined;
    branch?: string | undefined;
    currentBalance?: number | undefined;
    portalUrl?: string | undefined;
}>;
export declare const UpdateBankAccountSchema: z.ZodObject<{
    bankName: z.ZodOptional<z.ZodString>;
    accountType: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    accountNumber: z.ZodOptional<z.ZodString>;
    branch: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    currentBalance: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    portalUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    bankName?: string | undefined;
    accountType?: string | undefined;
    accountNumber?: string | undefined;
    branch?: string | undefined;
    currentBalance?: number | undefined;
    portalUrl?: string | undefined;
}, {
    bankName?: string | undefined;
    accountType?: string | undefined;
    accountNumber?: string | undefined;
    branch?: string | undefined;
    currentBalance?: number | undefined;
    portalUrl?: string | undefined;
}>;
export type CreateBankAccountDTO = z.infer<typeof CreateBankAccountSchema>;
export type UpdateBankAccountDTO = z.infer<typeof UpdateBankAccountSchema>;
