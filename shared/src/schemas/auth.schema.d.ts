import { z } from 'zod';
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
}, {
    password: string;
    email: string;
}>;
export declare const RegisterSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    name: z.ZodString;
    companyName: z.ZodString;
    businessType: z.ZodOptional<z.ZodString>;
    registrationNumber: z.ZodOptional<z.ZodString>;
    defaultUnitType: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
    name: string;
    companyName: string;
    businessType?: string | undefined;
    registrationNumber?: string | undefined;
    defaultUnitType?: string | undefined;
}, {
    password: string;
    email: string;
    name: string;
    companyName: string;
    businessType?: string | undefined;
    registrationNumber?: string | undefined;
    defaultUnitType?: string | undefined;
}>;
export declare const RefreshTokenSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export type LoginDTO = z.infer<typeof LoginSchema>;
export type RegisterDTO = z.infer<typeof RegisterSchema>;
export type RefreshTokenDTO = z.infer<typeof RefreshTokenSchema>;
