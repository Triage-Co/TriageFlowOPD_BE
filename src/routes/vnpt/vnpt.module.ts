import { Module } from '@nestjs/common';
import { VnptService } from './vnpt.service';
import { VnptController } from './vnpt.controller';

@Module({
  controllers: [VnptController],
  providers: [VnptService],
})
export class VnptModule {}
