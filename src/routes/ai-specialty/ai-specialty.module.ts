import { Module } from '@nestjs/common';
import { AiSpecialtyController } from './ai-specialty.controller';
import { AiSpecialtyService } from './ai-specialty.service';

@Module({
  controllers: [AiSpecialtyController],
  providers: [AiSpecialtyService],
  exports: [AiSpecialtyService],
})
export class AiSpecialtyModule {}
