import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateClinicDto {
  @IsUUID()
  @ApiProperty({
    name: 'floorId',
    example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0',
    description: 'ID của tầng chứa clinic này',
  })
  floorId: string;

  @IsString()
  @ApiProperty({
    name: 'clinicCode',
    example: 'CLINIC_A',
    description: 'Mã định danh clinic (duy nhất trên mỗi tầng)',
  })
  clinicCode: string;

  @IsString()
  @ApiProperty({
    name: 'clinicLabel',
    example: 'Khu khám Nội Tổng Hợp',
    description: 'Tên hiển thị của clinic',
  })
  clinicLabel: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'description',
    example: 'Khu vực chuyên khám các bệnh lý nội khoa tổng quát',
    description: 'Mô tả chi tiết về khu khám',
    required: false,
  })
  description?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'centerGeom',
    example: 'POINT(106.12 10.15)',
    description: 'Tọa độ tâm khu khám (WKT Point)',
    required: false,
  })
  centerGeom?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'outlineGeom',
    example: 'POLYGON((106.1 10.1, 106.2 10.1, 106.2 10.2, 106.1 10.2, 106.1 10.1))',
    description: 'Hình dạng bao quanh khu khám (WKT Polygon)',
    required: false,
  })
  outlineGeom?: string;
}
