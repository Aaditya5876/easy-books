import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

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
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
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
