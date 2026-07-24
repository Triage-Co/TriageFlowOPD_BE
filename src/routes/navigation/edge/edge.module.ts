import { Module } from '@nestjs/common';
import { EdgeService } from './edge.service';
import { EdgeController } from './edge.controller';

@Module({
  providers: [EdgeService],
  controllers: [EdgeController],
})
export class EdgeModule {}
