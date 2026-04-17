import { z } from 'zod';

export const CreateMemoDocumentSchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().min(1),
  content: z.string().optional(),
  dateAd: z.string(),
  dateBs: z.string().optional(),
  documentType: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

export const UpdateMemoDocumentSchema = CreateMemoDocumentSchema.omit({ companyId: true }).partial();

export type CreateMemoDocumentDTO = z.infer<typeof CreateMemoDocumentSchema>;
export type UpdateMemoDocumentDTO = z.infer<typeof UpdateMemoDocumentSchema>;
