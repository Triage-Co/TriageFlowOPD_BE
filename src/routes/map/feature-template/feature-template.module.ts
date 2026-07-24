import { Module } from '@nestjs/common';
import { FeatureTemplateService } from './feature-template.service';
import { FeatureTemplateController } from './feature-template.controller';

@Module({
  providers: [FeatureTemplateService],
  controllers: [FeatureTemplateController],
})
export class FeatureTemplateModule {}
