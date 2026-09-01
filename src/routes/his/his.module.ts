import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HisController } from './his.controller';
import { HisService } from './his.service';

@Module({
  imports: [HttpModule],
  controllers: [HisController],
  providers: [HisService],
  exports: [HisService],
})
export class HisModule {}
