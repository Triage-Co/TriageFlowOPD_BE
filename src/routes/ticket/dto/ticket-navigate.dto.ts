import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { RouteLocationType } from '../../navigation/core/dto/get-route.dto';

export class TicketNavigateDto {
  @IsEnum(RouteLocationType)
  @ApiProperty({
    enum: RouteLocationType,
    example: RouteLocationType.ROOM,
    description:
      'Loại địa điểm xuất phát hiện tại của bệnh nhân: ROOM, POI hoặc NODE',
  })
  startType: RouteLocationType;

  @IsUUID('4', { message: 'startId phải là định dạng UUID' })
  @ApiProperty({
    example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0',
    description:
      'ID tương ứng với điểm xuất phát hiện tại (roomId, poiId hoặc nodeId)',
  })
  startId: string;
}
