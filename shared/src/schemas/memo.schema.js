"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateMemoDocumentSchema = exports.CreateMemoDocumentSchema = void 0;
const zod_1 = require("zod");
exports.CreateMemoDocumentSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    category: zod_1.z.string().optional(),
    title: zod_1.z.string().optional(),
    content: zod_1.z.string().optional(),
    dateAd: zod_1.z.string(),
    dateBs: zod_1.z.string().optional(),
    documentType: zod_1.z.string().optional(),
    attachments: zod_1.z.array(zod_1.z.string()).optional(),
    referenceId: zod_1.z.string().optional(),
    clientName: zod_1.z.string().optional(),
    clientContact: zod_1.z.string().optional(),
    clientAddress: zod_1.z.string().optional(),
    vendorName: zod_1.z.string().optional(),
    vendorContact: zod_1.z.string().optional(),
    vendorPan: zod_1.z.string().optional(),
    assignedTo: zod_1.z.string().optional(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    deliveryDate: zod_1.z.string().optional(),
    dueDate: zod_1.z.string().optional(),
    validUntil: zod_1.z.string().optional(),
    docType: zod_1.z.string().optional(),
    linkedReference: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    amount: zod_1.z.number().optional(),
    documentUrl: zod_1.z.string().optional(),
    status: zod_1.z.string().optional(),
});
exports.UpdateMemoDocumentSchema = exports.CreateMemoDocumentSchema.omit({ companyId: true }).partial();
//# sourceMappingURL=memo.schema.js.map