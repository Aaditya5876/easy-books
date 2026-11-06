import { BadRequestException } from '@nestjs/common';

// Files attached in the sale/purchase form ("Attach invoices, receipts or
// photos") are kept as a linked Sales Bill / Purchase Bill document, so they
// appear under Memo → Sales/Purchase Bills. Only this company's own uploads
// (/uploads/<companyId>_...) may be attached.
export const MAX_BILL_ATTACHMENTS = 10;

export function billAttachmentUrls(companyId: string, attachments: unknown): string[] {
  if (attachments == null) return [];
  if (!Array.isArray(attachments) || attachments.length > MAX_BILL_ATTACHMENTS) {
    throw new BadRequestException(`Attach at most ${MAX_BILL_ATTACHMENTS} files`);
  }
  return attachments.map((a) => {
    const url = typeof a === 'string' ? a : (a as { url?: unknown })?.url;
    if (typeof url !== 'string' || !/^\/uploads\/[\w.-]+$/.test(url) || !url.startsWith(`/uploads/${companyId}_`)) {
      throw new BadRequestException('Attachments must be files uploaded to this company');
    }
    return url;
  });
}
