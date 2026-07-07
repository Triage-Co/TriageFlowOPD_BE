import { Module } from '@nestjs/common';
import { PhysicalRoomService } from './physical-room.service';
import { PhysicalRoomController } from './physical-room.controller';

@Module({
  providers: [PhysicalRoomService],
  controllers: [PhysicalRoomController],
})
export class PhysicalRoomModule {}
