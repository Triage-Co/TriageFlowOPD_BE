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

export class CreateClinicBoundaryDto {
  @IsUUID()
  @ApiProperty({
    name: 'clinicId',
    example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0',
    description: 'ID của clinic sở hữu đường biên này',
  })
  clinicId: string;

  @IsInt()
  @ApiProperty({
    name: 'seqNo',
    example: 1,
    description: 'Số thứ tự của phân đoạn đường biên quanh clinic',
  })
  seqNo: number;

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'lineGeom',
    example: 'LINESTRING(106.1 10.1, 106.2 10.1)',
    description: 'Tọa độ phân đoạn biên (WKT LineString)',
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

  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    name: 'hasWall',
    example: true,
    description: 'Có xây dựng tường vật lý hay không',
    required: false,
  })
  hasWall?: boolean;
}
