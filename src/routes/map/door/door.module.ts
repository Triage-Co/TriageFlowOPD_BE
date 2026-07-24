import { Module } from '@nestjs/common';
import { DoorService } from './door.service';
import { DoorController } from './door.controller';

@Module({
  providers: [DoorService],
  controllers: [DoorController],
})
export class DoorModule {}
