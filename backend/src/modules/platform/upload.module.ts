import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { JwtModule } from '@nestjs/jwt';
import { UploadController } from '../../adapter/input/api/v1/upload.controller';
import { UploadsDownloadController } from '../../adapter/input/api/v1/uploads-download.controller';
import { UploadAccessGuard } from '../guards/upload-access.guard';
import { PrismaService } from '../../../core/db/psql/prisma.client';

@Module({
  imports: [MulterModule.register({}), JwtModule.register({})],
  controllers: [UploadController, UploadsDownloadController],
  providers: [UploadAccessGuard, PrismaService],
})
export class UploadModule {}
