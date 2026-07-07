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

export class CreateRoomBoundaryDto {
  @IsUUID()
  @ApiProperty({
    name: 'roomId',
    example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0',
    description: 'ID của phòng chứa đường biên này',
  })
  roomId: string;

  @IsInt()
  @ApiProperty({
    name: 'seqNo',
    example: 1,
    description: 'Số thứ tự của phân đoạn đường biên quanh phòng',
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
    description: 'Loại đường biên (tường, cửa đi, cửa sổ, khoảng không)',
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
}
