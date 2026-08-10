import { z } from 'zod';
export declare const CreateCompanySchema: z.ZodObject<{
    name: z.ZodString;
    address: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    panVat: z.ZodOptional<z.ZodString>;
    currency: z.ZodDefault<z.ZodString>;
    fiscalYearStart: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    currency: string;
    email?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    panVat?: string | undefined;
    fiscalYearStart?: string | undefined;
}, {
    name: string;
    email?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    panVat?: string | undefined;
    currency?: string | undefined;
    fiscalYearStart?: string | undefined;
}>;
export declare const UpdateCompanySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    phone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    email: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    panVat: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    currency: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    fiscalYearStart: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    name?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    panVat?: string | undefined;
    currency?: string | undefined;
    fiscalYearStart?: string | undefined;
}, {
    email?: string | undefined;
    name?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    panVat?: string | undefined;
    currency?: string | undefined;
    fiscalYearStart?: string | undefined;
}>;
export type CreateCompanyDTO = z.infer<typeof CreateCompanySchema>;
export type UpdateCompanyDTO = z.infer<typeof UpdateCompanySchema>;
