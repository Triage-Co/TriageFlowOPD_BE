import { Module } from '@nestjs/common';
import { BlockageService } from './blockage.service';
import { BlockageController } from './blockage.controller';

@Module({
  providers: [BlockageService],
  controllers: [BlockageController],
})
export class BlockageModule {}
