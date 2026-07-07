import { Module } from '@nestjs/common';
import { RoomBoundaryService } from './room-boundary.service';
import { RoomBoundaryController } from './room-boundary.controller';

@Module({
  providers: [RoomBoundaryService],
  controllers: [RoomBoundaryController],
})
export class RoomBoundaryModule {}
