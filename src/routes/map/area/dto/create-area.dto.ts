import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAreaDto {
  @IsUUID()
  @ApiProperty({
    name: 'floorId',
    example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0',
    description: 'ID của tầng chứa khu vực này',
  })
  floorId: string;

  @IsString()
  @ApiProperty({
    name: 'areaCode',
    example: 'AREA_A',
    description: 'Mã định danh khu vực (duy nhất trên mỗi tầng)',
  })
  areaCode: string;

  @IsString()
  @ApiProperty({
    name: 'areaLabel',
    example: 'Khu khám Nội Tổng Hợp',
    description: 'Tên hiển thị của khu vực',
  })
  areaLabel: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'description',
    example: 'Khu vực chuyên khám các bệnh lý nội khoa tổng quát',
    description: 'Mô tả chi tiết về khu vực',
    required: false,
  })
  description?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'centerGeom',
    example: 'POINT(106.12 10.15)',
    description: 'Tọa độ tâm khu vực (WKT Point)',
    required: false,
  })
  centerGeom?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'outlineGeom',
    example: 'POLYGON((106.1 10.1, 106.2 10.1, 106.2 10.2, 106.1 10.2, 106.1 10.1))',
    description: 'Hình dạng bao quanh khu vực (WKT Polygon)',
    required: false,
  })
  outlineGeom?: string;
}
