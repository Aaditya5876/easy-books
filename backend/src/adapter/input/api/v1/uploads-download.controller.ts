import { Controller, Get, Param, Res, UseGuards, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../../../modules/decorators/public.decorator';
import { UploadAccessGuard } from '../../../../modules/guards/upload-access.guard';
import { FILE_STORAGE, FileStorage, mimeFor } from '../../../../../core/storage/file-storage';

// Replaces the old `app.useStaticAssets('/uploads')` in main.ts — that served
// every uploaded file (payment-proof screenshots, bank QR codes, logos...) to
// anyone on the internet with no login at all. This requires a valid staff or
// portal session (UploadAccessGuard) before returning a file, and streams it
// from FileStorage (local disk in dev, private Vercel Blob in production).
@ApiTags('Upload')
@Controller('uploads')
export class UploadsDownloadController {
  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  @Public()
  @UseGuards(UploadAccessGuard)
  @Get(':filename')
  async serve(@Param('filename') filename: string, @Res() res: Response) {
    // Stored filenames are always `[companyId_]uuid.ext` (see upload.util.ts) —
    // no path separators are ever legitimate, so reject anything that could be
    // a traversal attempt outright.
    if (!/^[\w.-]+$/.test(filename)) throw new BadRequestException('Invalid filename');

    const file = await this.storage.read(filename);
    if (!file) throw new NotFoundException('File not found');

    res.setHeader('Content-Type', file.contentType || mimeFor(filename));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Per-user content behind a session check: the browser may keep it, shared caches may not.
    res.setHeader('Cache-Control', 'private, no-cache');
    file.stream.on('error', () => res.destroy());
    file.stream.pipe(res);
  }
}
