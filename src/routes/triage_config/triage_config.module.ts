import { Module } from '@nestjs/common';
import { TriageConfigService } from './triage_config.service';
import { TriageConfigController } from './triage_config.controller';

@Module({
  controllers: [TriageConfigController],
  providers: [TriageConfigService],
})
export class TriageConfigModule {}
