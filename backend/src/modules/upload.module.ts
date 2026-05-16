import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadController } from '../adapter/input/api/v1/upload.controller';

@Module({
  imports: [MulterModule.register({})],
  controllers: [UploadController],
})
export class UploadModule {}
