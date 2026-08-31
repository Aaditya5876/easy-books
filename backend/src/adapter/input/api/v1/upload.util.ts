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
    // A random UUID, not Date.now()+Math.random() — these files are served
    // unauthenticated from a public static path (payment-proof screenshots,
    // bank QR codes, etc.), so the filename itself is the only thing standing
    // between "I have the link" and "I can guess/enumerate someone else's".
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  });
}

export function extensionFilter(allowed: string[]) {
  return (_req: any, file: any, cb: (error: Error | null, acceptFile: boolean) => void) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new BadRequestException(`File type ${ext} is not allowed`), false);
    cb(null, true);
  };
}
