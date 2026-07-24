import { Module } from '@nestjs/common';
import { BoundaryService } from './boundary.service';
import { BoundaryController } from './boundary.controller';

@Module({
  controllers: [BoundaryController],
  providers: [BoundaryService],
  exports: [BoundaryService],
})
export class BoundaryModule {}
