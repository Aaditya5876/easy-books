import { z } from 'zod';
export declare const OrderStatusEnum: z.ZodEnum<["PENDING", "CONFIRMED", "PARTIALLY_PAID", "COMPLETED", "CANCELLED"]>;
export declare const PaymentMethodEnum: z.ZodEnum<["CASH", "BANK_TRANSFER", "CHEQUE", "QR", "CREDIT"]>;
export declare const SalesOrderItemSchema: z.ZodObject<{
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
}>;
export declare const CreateSalesOrderSchema: z.ZodObject<{
    companyId: z.ZodString;
    clientId: z.ZodOptional<z.ZodString>;
    clientName: z.ZodString;
    clientContact: z.ZodOptional<z.ZodString>;
    clientAddress: z.ZodOptional<z.ZodString>;
    clientPanVat: z.ZodOptional<z.ZodString>;
    dateAd: z.ZodString;
    isVat: z.ZodDefault<z.ZodBoolean>;
    laborCharges: z.ZodDefault<z.ZodNumber>;
    paymentMethod: z.ZodDefault<z.ZodEnum<["CASH", "BANK_TRANSFER", "CHEQUE", "QR", "CREDIT"]>>;
    issuedBy: z.ZodOptional<z.ZodString>;
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
    clientName: string;
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
    clientId?: string | undefined;
    clientContact?: string | undefined;
    clientAddress?: string | undefined;
    clientPanVat?: string | undefined;
    issuedBy?: string | undefined;
    notes?: string | undefined;
}, {
    companyId: string;
    clientName: string;
    dateAd: string;
    items: {
        description: string;
        quantity: number;
        unitPrice: number;
        unit?: string | undefined;
        inventoryItemId?: string | undefined;
        discountPercent?: number | undefined;
    }[];
    clientId?: string | undefined;
    clientContact?: string | undefined;
    clientAddress?: string | undefined;
    clientPanVat?: string | undefined;
    isVat?: boolean | undefined;
    laborCharges?: number | undefined;
    paymentMethod?: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "QR" | "CREDIT" | undefined;
    issuedBy?: string | undefined;
    notes?: string | undefined;
}>;
export declare const RecordSalesPaymentSchema: z.ZodObject<{
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
export declare const UpdateSalesOrderSchema: z.ZodObject<{
    notes: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["PENDING", "CONFIRMED", "PARTIALLY_PAID", "COMPLETED", "CANCELLED"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "PENDING" | "CONFIRMED" | "PARTIALLY_PAID" | "COMPLETED" | "CANCELLED" | undefined;
    notes?: string | undefined;
}, {
    status?: "PENDING" | "CONFIRMED" | "PARTIALLY_PAID" | "COMPLETED" | "CANCELLED" | undefined;
    notes?: string | undefined;
}>;
export type CreateSalesOrderDTO = z.infer<typeof CreateSalesOrderSchema>;
export type UpdateSalesOrderDTO = z.infer<typeof UpdateSalesOrderSchema>;
export type RecordSalesPaymentDTO = z.infer<typeof RecordSalesPaymentSchema>;
export type SalesOrderItemDTO = z.infer<typeof SalesOrderItemSchema>;
