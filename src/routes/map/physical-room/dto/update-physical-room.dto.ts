import { PartialType } from '@nestjs/swagger';
import { CreatePhysicalRoomDto } from './create-physical-room.dto';

export class UpdatePhysicalRoomDto extends PartialType(CreatePhysicalRoomDto) {}
