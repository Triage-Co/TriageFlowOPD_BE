import { PartialType } from '@nestjs/swagger';
import { CreateRoomBoundaryDto } from './create-room-boundary.dto';

export class UpdateRoomBoundaryDto extends PartialType(CreateRoomBoundaryDto) {}
