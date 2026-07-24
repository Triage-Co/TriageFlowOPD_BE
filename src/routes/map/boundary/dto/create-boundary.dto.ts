import { ApiProperty } from '@nestjs/swagger';
import { BoundaryType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateBoundaryDto {
  @IsUUID()
  @ApiProperty({
    name: 'floorId',
    example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0',
    description: 'ID của tầng chứa đường biên này',
  })
  floorId: string;

  @IsUUID()
  @IsOptional()
  @ApiProperty({
    name: 'roomId',
    example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0',
    description: 'ID của phòng chứa đường biên này (nếu có)',
    required: false,
  })
  roomId?: string;

  @IsUUID()
  @IsOptional()
  @ApiProperty({
    name: 'areaId',
    example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0',
    description: 'ID của khu vực/phòng khám chứa đường biên này (nếu có)',
    required: false,
  })
  areaId?: string;

  @IsInt()
  @ApiProperty({
    name: 'seqNo',
    example: 1,
    description: 'Số thứ tự của phân đoạn đường biên',
  })
  seqNo: number;

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'lineGeom',
    example: 'LINESTRING(106.1 10.1, 106.2 10.1)',
    description: 'Tọa độ phân đoạn biên (WKT LineString hoặc GeoJSON)',
    required: false,
  })
  lineGeom?: string;

  @IsEnum(BoundaryType)
  @ApiProperty({
    name: 'boundaryType',
    enum: BoundaryType,
    example: BoundaryType.WALL,
    description: 'Loại đường biên (WALL, DOOR, WINDOW, OPEN)',
  })
  boundaryType: BoundaryType;

  @IsUUID()
  @IsOptional()
  @ApiProperty({
    name: 'adjacentRoomId',
    example: 'b6b32cb3-1a22-42da-91ef-f6089bd608d1',
    description: 'ID của phòng giáp ranh bên kia đường biên (nếu có)',
    required: false,
  })
  adjacentRoomId?: string;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    name: 'hasWall',
    example: true,
    description: 'Có xây dựng tường vật lý hay không',
    required: false,
  })
  hasWall?: boolean;

  @IsUUID()
  @IsOptional()
  @ApiProperty({
    name: 'doorId',
    example: 'c6b32cb3-1a22-42da-91ef-f6089bd608d2',
    description: 'ID của Cửa tương ứng nếu loại đường biên là DOOR',
    required: false,
  })
  doorId?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'label',
    example: 'Lan can tầng 2',
    description: 'Ghi chú cho boundary lẻ (nếu có)',
    required: false,
  })
  label?: string;
}
