import { z } from 'zod';
export declare const QuotationRemarkEnum: z.ZodEnum<["QUOTED", "WORK_DONE", "CANCELLED", "REVISED", "BILLED"]>;
export declare const QuotationStatusEnum: z.ZodEnum<["ACTIVE", "CONVERTED", "EXPIRED"]>;
export declare const CreateQuotationSchema: z.ZodObject<{
    companyId: z.ZodString;
    clientId: z.ZodOptional<z.ZodString>;
    clientName: z.ZodString;
    dateAd: z.ZodString;
    dateBs: z.ZodOptional<z.ZodString>;
    quotationNumber: z.ZodString;
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
    description: z.ZodOptional<z.ZodString>;
    totalAmount: z.ZodNumber;
    remark: z.ZodDefault<z.ZodEnum<["QUOTED", "WORK_DONE", "CANCELLED", "REVISED", "BILLED"]>>;
    status: z.ZodDefault<z.ZodEnum<["ACTIVE", "CONVERTED", "EXPIRED"]>>;
}, "strip", z.ZodTypeAny, {
    status: "ACTIVE" | "EXPIRED" | "CONVERTED";
    companyId: string;
    clientName: string;
    dateAd: string;
    items: {
        description: string;
        quantity: number;
        unitPrice: number;
        discountPercent: number;
        unit?: string | undefined;
        inventoryItemId?: string | undefined;
    }[];
    quotationNumber: string;
    totalAmount: number;
    remark: "CANCELLED" | "QUOTED" | "WORK_DONE" | "REVISED" | "BILLED";
    description?: string | undefined;
    clientId?: string | undefined;
    dateBs?: string | undefined;
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
    quotationNumber: string;
    totalAmount: number;
    status?: "ACTIVE" | "EXPIRED" | "CONVERTED" | undefined;
    description?: string | undefined;
    clientId?: string | undefined;
    dateBs?: string | undefined;
    remark?: "CANCELLED" | "QUOTED" | "WORK_DONE" | "REVISED" | "BILLED" | undefined;
}>;
export declare const UpdateQuotationSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<["ACTIVE", "CONVERTED", "EXPIRED"]>>>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    clientId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    clientName: z.ZodOptional<z.ZodString>;
    dateAd: z.ZodOptional<z.ZodString>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
    }>, "many">>;
    dateBs: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    quotationNumber: z.ZodOptional<z.ZodString>;
    totalAmount: z.ZodOptional<z.ZodNumber>;
    remark: z.ZodOptional<z.ZodDefault<z.ZodEnum<["QUOTED", "WORK_DONE", "CANCELLED", "REVISED", "BILLED"]>>>;
}, "strip", z.ZodTypeAny, {
    status?: "ACTIVE" | "EXPIRED" | "CONVERTED" | undefined;
    description?: string | undefined;
    clientId?: string | undefined;
    clientName?: string | undefined;
    dateAd?: string | undefined;
    items?: {
        description: string;
        quantity: number;
        unitPrice: number;
        discountPercent: number;
        unit?: string | undefined;
        inventoryItemId?: string | undefined;
    }[] | undefined;
    dateBs?: string | undefined;
    quotationNumber?: string | undefined;
    totalAmount?: number | undefined;
    remark?: "CANCELLED" | "QUOTED" | "WORK_DONE" | "REVISED" | "BILLED" | undefined;
}, {
    status?: "ACTIVE" | "EXPIRED" | "CONVERTED" | undefined;
    description?: string | undefined;
    clientId?: string | undefined;
    clientName?: string | undefined;
    dateAd?: string | undefined;
    items?: {
        description: string;
        quantity: number;
        unitPrice: number;
        unit?: string | undefined;
        inventoryItemId?: string | undefined;
        discountPercent?: number | undefined;
    }[] | undefined;
    dateBs?: string | undefined;
    quotationNumber?: string | undefined;
    totalAmount?: number | undefined;
    remark?: "CANCELLED" | "QUOTED" | "WORK_DONE" | "REVISED" | "BILLED" | undefined;
}>;
export type CreateQuotationDTO = z.infer<typeof CreateQuotationSchema>;
export type UpdateQuotationDTO = z.infer<typeof UpdateQuotationSchema>;
