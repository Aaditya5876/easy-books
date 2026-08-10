import { z } from 'zod';
export declare const ChequeStatusEnum: z.ZodEnum<["ISSUED", "DEPOSITED", "CLEARED", "BOUNCED", "CANCELLED"]>;
export declare const BankGuaranteeStatusEnum: z.ZodEnum<["ACTIVE", "EXPIRED", "CLAIMED", "RELEASED"]>;
export declare const CreateChequeSchema: z.ZodObject<{
    chequeNumber: z.ZodString;
    partyName: z.ZodString;
    amount: z.ZodNumber;
    dateAd: z.ZodString;
    isReceivable: z.ZodBoolean;
    bankAccountId: z.ZodOptional<z.ZodString>;
    referenceType: z.ZodOptional<z.ZodString>;
    referenceId: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    dateAd: string;
    amount: number;
    partyName: string;
    chequeNumber: string;
    isReceivable: boolean;
    notes?: string | undefined;
    bankAccountId?: string | undefined;
    referenceType?: string | undefined;
    referenceId?: string | undefined;
}, {
    dateAd: string;
    amount: number;
    partyName: string;
    chequeNumber: string;
    isReceivable: boolean;
    notes?: string | undefined;
    bankAccountId?: string | undefined;
    referenceType?: string | undefined;
    referenceId?: string | undefined;
}>;
export declare const CreateBankGuaranteeSchema: z.ZodObject<{
    bgNumber: z.ZodString;
    partyName: z.ZodString;
    bankName: z.ZodString;
    amount: z.ZodNumber;
    issuedDateAd: z.ZodString;
    expiryDateAd: z.ZodString;
    purpose: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    bankName: string;
    partyName: string;
    bgNumber: string;
    issuedDateAd: string;
    expiryDateAd: string;
    notes?: string | undefined;
    purpose?: string | undefined;
}, {
    amount: number;
    bankName: string;
    partyName: string;
    bgNumber: string;
    issuedDateAd: string;
    expiryDateAd: string;
    notes?: string | undefined;
    purpose?: string | undefined;
}>;
export declare const CreatePettyCashVoucherSchema: z.ZodObject<{
    voucherNo: z.ZodString;
    dateAd: z.ZodString;
    amount: z.ZodNumber;
    description: z.ZodString;
    category: z.ZodOptional<z.ZodString>;
    paidTo: z.ZodOptional<z.ZodString>;
    approvedBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description: string;
    dateAd: string;
    amount: number;
    voucherNo: string;
    category?: string | undefined;
    paidTo?: string | undefined;
    approvedBy?: string | undefined;
}, {
    description: string;
    dateAd: string;
    amount: number;
    voucherNo: string;
    category?: string | undefined;
    paidTo?: string | undefined;
    approvedBy?: string | undefined;
}>;
export type CreateChequeDTO = z.infer<typeof CreateChequeSchema>;
export type CreateBankGuaranteeDTO = z.infer<typeof CreateBankGuaranteeSchema>;
export type CreatePettyCashVoucherDTO = z.infer<typeof CreatePettyCashVoucherSchema>;
