import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePhysicalRoomDto {
  @IsUUID()
  @ApiProperty({
    name: 'floorId',
    example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0',
    description: 'ID của tầng chứa phòng này',
  })
  floorId: string;

  @IsString()
  @ApiProperty({
    name: 'roomCode',
    example: 'ROOM_101',
    description: 'Mã định danh phòng (duy nhất trên mỗi tầng)',
  })
  roomCode: string;

  @IsString()
  @ApiProperty({
    name: 'roomLabel',
    example: 'Phòng khám Nhi số 1',
    description: 'Tên hiển thị của phòng',
  })
  roomLabel: string;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    name: 'heightMeters',
    example: 3.2,
    description: 'Chiều cao phòng (mét)',
    required: false,
  })
  heightMeters?: number;

  @IsUUID()
  @IsOptional()
  @ApiProperty({
    name: 'areaId',
    example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0',
    description: 'ID khu vực (Area) chứa phòng này',
    required: false,
  })
  areaId?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'centerGeom',
    example: 'POINT(106.12 10.15)',
    description: 'Tọa độ tâm phòng (WKT Point hoặc GeoJSON)',
    required: false,
  })
  centerGeom?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'outlineGeom',
    example:
      'POLYGON((106.1 10.1, 106.2 10.1, 106.2 10.2, 106.1 10.2, 106.1 10.1))',
    description: 'Hình dạng bao quanh phòng (WKT Polygon hoặc GeoJSON)',
    required: false,
  })
  outlineGeom?: string;
}
