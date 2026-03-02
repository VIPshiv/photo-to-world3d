import { Module } from '@nestjs/common';
import { ScenesController } from './scenes.controller';
import { ScenesService } from './scenes.service';
import { AiModule } from '../ai/ai.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [AiModule, UploadsModule], // Needs AI for auto-tag, Uploads for validation
  controllers: [ScenesController],
  providers: [ScenesService],
})
export class ScenesModule {}
