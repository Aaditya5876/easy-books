import { z } from 'zod';
export declare const ClientStatusEnum: z.ZodEnum<["ACTIVE", "INACTIVE", "PROSPECT"]>;
export declare const CreateClientSchema: z.ZodObject<{
    companyId: z.ZodString;
    name: z.ZodString;
    abbreviation: z.ZodOptional<z.ZodString>;
    contactPerson: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    panVat: z.ZodOptional<z.ZodString>;
    crmStatus: z.ZodDefault<z.ZodEnum<["ACTIVE", "INACTIVE", "PROSPECT"]>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    companyId: string;
    crmStatus: "ACTIVE" | "INACTIVE" | "PROSPECT";
    email?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    panVat?: string | undefined;
    notes?: string | undefined;
    abbreviation?: string | undefined;
    contactPerson?: string | undefined;
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
    crmStatus?: "ACTIVE" | "INACTIVE" | "PROSPECT" | undefined;
}>;
export declare const UpdateClientSchema: z.ZodObject<{
    email: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    name: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    phone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    panVat: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    abbreviation: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    contactPerson: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    crmStatus: z.ZodOptional<z.ZodDefault<z.ZodEnum<["ACTIVE", "INACTIVE", "PROSPECT"]>>>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    name?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    panVat?: string | undefined;
    notes?: string | undefined;
    abbreviation?: string | undefined;
    contactPerson?: string | undefined;
    crmStatus?: "ACTIVE" | "INACTIVE" | "PROSPECT" | undefined;
}, {
    email?: string | undefined;
    name?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    panVat?: string | undefined;
    notes?: string | undefined;
    abbreviation?: string | undefined;
    contactPerson?: string | undefined;
    crmStatus?: "ACTIVE" | "INACTIVE" | "PROSPECT" | undefined;
}>;
export type CreateClientDTO = z.infer<typeof CreateClientSchema>;
export type UpdateClientDTO = z.infer<typeof UpdateClientSchema>;
