import {
  Controller, Post, UploadedFile, UseInterceptors, BadRequestException, Inject, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { saveUpload, extensionFilter } from './upload.util';
import { FILE_STORAGE, FileStorage } from '../../../../../core/storage/file-storage';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xlsx', '.xls'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('api/v1/upload')
export class UploadController {
  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  @Post()
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Upload a file (image or PDF) — returns permanent URL' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: extensionFilter(ALLOWED_EXTENSIONS),
  }))
  uploadFile(@UploadedFile() file: any, @Query('companyId') companyId: string) {
    if (!file) throw new BadRequestException('No file provided');
    return saveUpload(this.storage, file, companyId);
  }
}
