import { Module } from '@nestjs/common';
import { PlacedFeatureService } from './placed-feature.service';
import { PlacedFeatureController } from './placed-feature.controller';

@Module({
  providers: [PlacedFeatureService],
  controllers: [PlacedFeatureController],
})
export class PlacedFeatureModule {}
