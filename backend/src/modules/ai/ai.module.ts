import { Module } from '@nestjs/common';
import { AiController } from '../../adapter/input/api/v1/ai.controller';
import { AiService } from '../../application/services/ai.service';

@Module({
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
