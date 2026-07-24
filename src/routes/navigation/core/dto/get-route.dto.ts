import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';

export enum RouteLocationType {
  ROOM = 'ROOM',
  POI = 'POI',
  NODE = 'NODE',
}

export class GetRouteDto {
  @IsEnum(RouteLocationType)
  @ApiProperty({
    enum: RouteLocationType,
    example: RouteLocationType.ROOM,
    description: 'Loại địa điểm xuất phát: ROOM, POI hoặc NODE',
  })
  startType: RouteLocationType;

  @IsUUID()
  @ApiProperty({
    example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0',
    description: 'ID tương ứng với điểm xuất phát (roomId, poiId hoặc nodeId)',
  })
  startId: string;

  @IsEnum(RouteLocationType)
  @ApiProperty({
    enum: RouteLocationType,
    example: RouteLocationType.POI,
    description: 'Loại địa điểm đích: ROOM, POI hoặc NODE',
  })
  targetType: RouteLocationType;

  @IsUUID()
  @ApiProperty({
    example: 'b7c43dc4-2b33-53eb-02fg-g7090ce709e1',
    description: 'ID tương ứng với điểm đích (roomId, poiId hoặc nodeId)',
  })
  targetId: string;
}
