import { Controller, Get, Param, Res, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { Public } from '../../../../modules/decorators/public.decorator';
import { UploadAccessGuard } from '../../../../modules/guards/upload-access.guard';

// Replaces the old `app.useStaticAssets('/uploads')` in main.ts — that served
// every uploaded file (payment-proof screenshots, bank QR codes, logos...) to
// anyone on the internet with no login at all. This requires a valid staff or
// portal session (UploadAccessGuard) before returning a file.
@ApiTags('Upload')
@Controller('uploads')
export class UploadsDownloadController {
  @Public()
  @UseGuards(UploadAccessGuard)
  @Get(':filename')
  serve(@Param('filename') filename: string, @Res() res: Response) {
    // Stored filenames are always `${uuid}${ext}` (see upload.util.ts) — no
    // path separators are ever legitimate, so reject anything that could be
    // a traversal attempt outright.
    if (!/^[\w.-]+$/.test(filename)) throw new BadRequestException('Invalid filename');

    const filePath = join(process.cwd(), 'uploads', filename);
    if (!existsSync(filePath)) throw new NotFoundException('File not found');

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
  }
}
