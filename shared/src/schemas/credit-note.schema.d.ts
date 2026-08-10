import { z } from 'zod';
export declare const CreditNoteStatusEnum: z.ZodEnum<["OPEN", "APPLIED", "CLOSED"]>;
export declare const CreateCreditNoteSchema: z.ZodObject<{
    clientId: z.ZodOptional<z.ZodString>;
    salesOrderId: z.ZodOptional<z.ZodString>;
    dateAd: z.ZodString;
    reason: z.ZodString;
    amount: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    dateAd: string;
    amount: number;
    reason: string;
    clientId?: string | undefined;
    notes?: string | undefined;
    salesOrderId?: string | undefined;
}, {
    dateAd: string;
    amount: number;
    reason: string;
    clientId?: string | undefined;
    notes?: string | undefined;
    salesOrderId?: string | undefined;
}>;
export declare const CreateDebitNoteSchema: z.ZodObject<{
    vendorId: z.ZodOptional<z.ZodString>;
    purchaseOrderId: z.ZodOptional<z.ZodString>;
    dateAd: z.ZodString;
    reason: z.ZodString;
    amount: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    dateAd: string;
    amount: number;
    reason: string;
    vendorId?: string | undefined;
    notes?: string | undefined;
    purchaseOrderId?: string | undefined;
}, {
    dateAd: string;
    amount: number;
    reason: string;
    vendorId?: string | undefined;
    notes?: string | undefined;
    purchaseOrderId?: string | undefined;
}>;
export type CreateCreditNoteDTO = z.infer<typeof CreateCreditNoteSchema>;
export type CreateDebitNoteDTO = z.infer<typeof CreateDebitNoteSchema>;
