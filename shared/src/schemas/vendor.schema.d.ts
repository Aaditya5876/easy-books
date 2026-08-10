import { z } from 'zod';
export declare const CreateVendorSchema: z.ZodObject<{
    companyId: z.ZodString;
    name: z.ZodString;
    abbreviation: z.ZodOptional<z.ZodString>;
    contactPerson: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    panVat: z.ZodOptional<z.ZodString>;
    bankDetails: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    companyId: string;
    email?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    panVat?: string | undefined;
    notes?: string | undefined;
    abbreviation?: string | undefined;
    contactPerson?: string | undefined;
    bankDetails?: string | undefined;
}, {
    name: string;
    companyId: string;
    email?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    panVat?: string | undefined;
    notes?: string | undefined;
    abbreviation?: string | undefined;
    contactPerson?: string | undefined;
    bankDetails?: string | undefined;
}>;
export declare const UpdateVendorSchema: z.ZodObject<{
    email: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    name: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    phone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    panVat: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    abbreviation: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    contactPerson: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    bankDetails: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    name?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    panVat?: string | undefined;
    notes?: string | undefined;
    abbreviation?: string | undefined;
    contactPerson?: string | undefined;
    bankDetails?: string | undefined;
}, {
    email?: string | undefined;
    name?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    panVat?: string | undefined;
    notes?: string | undefined;
    abbreviation?: string | undefined;
    contactPerson?: string | undefined;
    bankDetails?: string | undefined;
}>;
export type CreateVendorDTO = z.infer<typeof CreateVendorSchema>;
export type UpdateVendorDTO = z.infer<typeof UpdateVendorSchema>;
