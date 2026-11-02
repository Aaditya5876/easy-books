import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

// Shared by the staff-facing generic uploader and the portal's own
// payment-proof uploader — both files land in the same local `uploads/` dir
// and get served from the same `/uploads` static prefix (see main.ts).
export function makeUploadStorage() {
  return diskStorage({
    destination: (_req, _file, cb) => {
      const uploadDir = join(process.cwd(), 'uploads');
      if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    // A random UUID, not Date.now()+Math.random(), so links can't be guessed;
    // prefixed with the owning company so UploadAccessGuard can refuse other
    // schools' staff and parents. The guards run before this interceptor, so
    // the company is already verified (staff: ?companyId, portal: its token).
    filename: (req: any, file, cb) => {
      const companyId = req.query?.companyId || req.portalUser?.companyId;
      const prefix = typeof companyId === 'string' && UUID.test(companyId) ? `${companyId}_` : '';
      cb(null, `${prefix}${randomUUID()}${extname(file.originalname)}`);
    },
  });
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
