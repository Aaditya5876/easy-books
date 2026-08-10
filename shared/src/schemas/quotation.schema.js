"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateQuotationSchema = exports.CreateQuotationSchema = exports.QuotationStatusEnum = exports.QuotationRemarkEnum = void 0;
const zod_1 = require("zod");
const sales_schema_1 = require("./sales.schema");
exports.QuotationRemarkEnum = zod_1.z.enum(['QUOTED', 'WORK_DONE', 'CANCELLED', 'REVISED', 'BILLED']);
exports.QuotationStatusEnum = zod_1.z.enum(['ACTIVE', 'CONVERTED', 'EXPIRED']);
exports.CreateQuotationSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    clientId: zod_1.z.string().uuid().optional(),
    clientName: zod_1.z.string().min(1),
    dateAd: zod_1.z.string(),
    dateBs: zod_1.z.string().optional(),
    quotationNumber: zod_1.z.string().min(1),
    items: zod_1.z.array(sales_schema_1.SalesOrderItemSchema).min(1),
    description: zod_1.z.string().optional(),
    totalAmount: zod_1.z.number(),
    remark: exports.QuotationRemarkEnum.default('QUOTED'),
    status: exports.QuotationStatusEnum.default('ACTIVE'),
});
exports.UpdateQuotationSchema = exports.CreateQuotationSchema.omit({ companyId: true }).partial();
//# sourceMappingURL=quotation.schema.js.map