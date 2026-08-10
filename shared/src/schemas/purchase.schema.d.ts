import { z } from 'zod';
export declare const CreatePurchaseOrderSchema: z.ZodObject<{
    companyId: z.ZodString;
    vendorId: z.ZodOptional<z.ZodString>;
    vendorName: z.ZodString;
    vendorContact: z.ZodOptional<z.ZodString>;
    vendorAddress: z.ZodOptional<z.ZodString>;
    vendorPanVat: z.ZodOptional<z.ZodString>;
    dateAd: z.ZodString;
    isVat: z.ZodDefault<z.ZodBoolean>;
    laborCharges: z.ZodDefault<z.ZodNumber>;
    paymentMethod: z.ZodDefault<z.ZodEnum<["CASH", "BANK_TRANSFER", "CHEQUE", "QR", "CREDIT"]>>;
    notes: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        inventoryItemId: z.ZodOptional<z.ZodString>;
        description: z.ZodString;
        quantity: z.ZodNumber;
        unit: z.ZodOptional<z.ZodString>;
        unitPrice: z.ZodNumber;
        discountPercent: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        quantity: number;
        unitPrice: number;
        discountPercent: number;
        unit?: string | undefined;
        inventoryItemId?: string | undefined;
    }, {
        description: string;
        quantity: number;
        unitPrice: number;
        unit?: string | undefined;
        inventoryItemId?: string | undefined;
        discountPercent?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    dateAd: string;
    isVat: boolean;
    laborCharges: number;
    paymentMethod: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "QR" | "CREDIT";
    items: {
        description: string;
        quantity: number;
        unitPrice: number;
        discountPercent: number;
        unit?: string | undefined;
        inventoryItemId?: string | undefined;
    }[];
    vendorName: string;
    vendorId?: string | undefined;
    notes?: string | undefined;
    vendorContact?: string | undefined;
    vendorAddress?: string | undefined;
    vendorPanVat?: string | undefined;
}, {
    companyId: string;
    dateAd: string;
    items: {
        description: string;
        quantity: number;
        unitPrice: number;
        unit?: string | undefined;
        inventoryItemId?: string | undefined;
        discountPercent?: number | undefined;
    }[];
    vendorName: string;
    vendorId?: string | undefined;
    isVat?: boolean | undefined;
    laborCharges?: number | undefined;
    paymentMethod?: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "QR" | "CREDIT" | undefined;
    notes?: string | undefined;
    vendorContact?: string | undefined;
    vendorAddress?: string | undefined;
    vendorPanVat?: string | undefined;
}>;
export declare const RecordPurchasePaymentSchema: z.ZodObject<{
    amount: z.ZodNumber;
    paymentMethod: z.ZodEnum<["CASH", "BANK_TRANSFER", "CHEQUE", "QR", "CREDIT"]>;
    referenceNumber: z.ZodOptional<z.ZodString>;
    dateAd: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    dateAd: string;
    paymentMethod: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "QR" | "CREDIT";
    amount: number;
    notes?: string | undefined;
    referenceNumber?: string | undefined;
}, {
    dateAd: string;
    paymentMethod: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "QR" | "CREDIT";
    amount: number;
    notes?: string | undefined;
    referenceNumber?: string | undefined;
}>;
export declare const UpdatePurchaseOrderSchema: z.ZodObject<{
    notes: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["PENDING", "CONFIRMED", "PARTIALLY_PAID", "COMPLETED", "CANCELLED"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "PENDING" | "CONFIRMED" | "PARTIALLY_PAID" | "COMPLETED" | "CANCELLED" | undefined;
    notes?: string | undefined;
}, {
    status?: "PENDING" | "CONFIRMED" | "PARTIALLY_PAID" | "COMPLETED" | "CANCELLED" | undefined;
    notes?: string | undefined;
}>;
export type CreatePurchaseOrderDTO = z.infer<typeof CreatePurchaseOrderSchema>;
export type UpdatePurchaseOrderDTO = z.infer<typeof UpdatePurchaseOrderSchema>;
export type RecordPurchasePaymentDTO = z.infer<typeof RecordPurchasePaymentSchema>;
