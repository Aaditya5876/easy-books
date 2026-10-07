import { z } from 'zod';

export const CreateMemoDocumentSchema = z.object({
  companyId: z.string().uuid(),
  category: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  dateAd: z.string(),
  dateBs: z.string().optional(),
  documentType: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  referenceId: z.string().optional(),
  clientName: z.string().optional(),
  clientContact: z.string().optional(),
  clientAddress: z.string().optional(),
  vendorName: z.string().optional(),
  vendorContact: z.string().optional(),
  vendorPan: z.string().optional(),
  assignedTo: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  dueDate: z.string().optional(),
  validUntil: z.string().optional(),
  docType: z.string().optional(),
  linkedReference: z.string().optional(),
  description: z.string().optional(),
  amount: z.number().optional(),
  documentUrl: z.string().optional(),
  status: z.string().optional(),
});

export const UpdateMemoDocumentSchema = CreateMemoDocumentSchema.omit({ companyId: true }).partial();

export type CreateMemoDocumentDTO = z.infer<typeof CreateMemoDocumentSchema>;
export type UpdateMemoDocumentDTO = z.infer<typeof UpdateMemoDocumentSchema>;
