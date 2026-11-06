import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { FileStorage, mimeFor } from '../../../../../core/storage/file-storage';

// Shared by the staff-facing generic uploader and the portal's own
// payment-proof uploader. Multer keeps the upload in memory (its default when
// no storage is given); saveUpload() names it and hands it to FileStorage
// (local uploads/ in dev, private Vercel Blob in production). Both are served
// from the same /uploads/<name> route behind UploadAccessGuard.
//
// A random UUID, not Date.now()+Math.random(), so links can't be guessed;
// prefixed with the owning company so UploadAccessGuard can refuse other
// schools' staff and parents. Callers pass a company the guards have already
// verified (staff: ?companyId, portal: its token).
export async function saveUpload(storage: FileStorage, file: any, companyId?: string) {
  const prefix = typeof companyId === 'string' && UUID.test(companyId) ? `${companyId}_` : '';
  const filename = `${prefix}${randomUUID()}${extname(file.originalname).toLowerCase()}`;
  await storage.save(filename, file.buffer, mimeFor(filename));
  return {
    url: `/uploads/${filename}`,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The company a stored file belongs to, or null for files uploaded before
// filenames carried it.
export function uploadOwner(filename: string): string | null {
  const [head] = filename.split('_');
  return filename.includes('_') && UUID.test(head) ? head : null;
}

export function extensionFilter(allowed: string[]) {
  return (_req: any, file: any, cb: (error: Error | null, acceptFile: boolean) => void) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new BadRequestException(`File type ${ext} is not allowed`), false);
    cb(null, true);
  };
}
