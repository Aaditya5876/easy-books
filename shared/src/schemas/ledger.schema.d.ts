import { z } from 'zod';
export declare const LedgerAccountTypeEnum: z.ZodEnum<["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]>;
export declare const CreateLedgerAccountSchema: z.ZodObject<{
    companyId: z.ZodString;
    accountName: z.ZodString;
    accountCode: z.ZodOptional<z.ZodString>;
    accountType: z.ZodEnum<["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]>;
    openingBalance: z.ZodDefault<z.ZodNumber>;
    fiscalYear: z.ZodOptional<z.ZodString>;
    contactId: z.ZodOptional<z.ZodString>;
    contactType: z.ZodOptional<z.ZodEnum<["CLIENT", "VENDOR"]>>;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    accountName: string;
    accountType: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
    openingBalance: number;
    fiscalYear?: string | undefined;
    accountCode?: string | undefined;
    contactId?: string | undefined;
    contactType?: "CLIENT" | "VENDOR" | undefined;
}, {
    companyId: string;
    accountName: string;
    accountType: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
    fiscalYear?: string | undefined;
    accountCode?: string | undefined;
    openingBalance?: number | undefined;
    contactId?: string | undefined;
    contactType?: "CLIENT" | "VENDOR" | undefined;
}>;
export declare const UpdateLedgerAccountSchema: z.ZodObject<{
    fiscalYear: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    accountName: z.ZodOptional<z.ZodString>;
    accountCode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    accountType: z.ZodOptional<z.ZodEnum<["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]>>;
    openingBalance: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    contactId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    contactType: z.ZodOptional<z.ZodOptional<z.ZodEnum<["CLIENT", "VENDOR"]>>>;
}, "strip", z.ZodTypeAny, {
    fiscalYear?: string | undefined;
    accountName?: string | undefined;
    accountCode?: string | undefined;
    accountType?: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE" | undefined;
    openingBalance?: number | undefined;
    contactId?: string | undefined;
    contactType?: "CLIENT" | "VENDOR" | undefined;
}, {
    fiscalYear?: string | undefined;
    accountName?: string | undefined;
    accountCode?: string | undefined;
    accountType?: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE" | undefined;
    openingBalance?: number | undefined;
    contactId?: string | undefined;
    contactType?: "CLIENT" | "VENDOR" | undefined;
}>;
export declare const CreateLedgerEntrySchema: z.ZodObject<{
    companyId: z.ZodString;
    debitAccountId: z.ZodString;
    creditAccountId: z.ZodString;
    amount: z.ZodNumber;
    dateAd: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    dateAd: string;
    amount: number;
    debitAccountId: string;
    creditAccountId: string;
    description?: string | undefined;
}, {
    companyId: string;
    dateAd: string;
    amount: number;
    debitAccountId: string;
    creditAccountId: string;
    description?: string | undefined;
}>;
export declare const UpdateLedgerEntrySchema: z.ZodObject<{
    description: z.ZodOptional<z.ZodString>;
    dateAd: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description?: string | undefined;
    dateAd?: string | undefined;
}, {
    description?: string | undefined;
    dateAd?: string | undefined;
}>;
export type CreateLedgerAccountDTO = z.infer<typeof CreateLedgerAccountSchema>;
export type UpdateLedgerAccountDTO = z.infer<typeof UpdateLedgerAccountSchema>;
export type CreateLedgerEntryDTO = z.infer<typeof CreateLedgerEntrySchema>;
export type UpdateLedgerEntryDTO = z.infer<typeof UpdateLedgerEntrySchema>;
