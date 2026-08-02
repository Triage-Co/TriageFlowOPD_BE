import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFloorDto {
  @IsUUID()
  @ApiProperty({
    name: 'buildingId',
    example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0',
    description: 'ID của tòa nhà chứa tầng này',
  })
  buildingId: string;

  @IsInt()
  @ApiProperty({
    name: 'floorNumber',
    example: 1,
    description:
      'Số thứ tự tầng (ví dụ: 1 cho Tầng 1, 0 cho Tầng trệt, -1 cho Tầng hầm)',
  })
  floorNumber: number;

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'floorPlanImageUrl',
    example: 'https://example.com/floor-plans/building-a-floor-1.png',
    description: 'Đường dẫn ảnh sơ đồ mặt bằng tầng',
    required: false,
  })
  floorPlanImageUrl?: string;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    name: 'widthMeters',
    example: 120.5,
    description: 'Chiều rộng thực tế mặt bằng tầng (mét)',
    required: false,
  })
  widthMeters?: number;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    name: 'heightMeters',
    example: 80.0,
    description: 'Chiều cao thực tế mặt bằng tầng (mét)',
    required: false,
  })
  heightMeters?: number;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    name: 'scalePixelsPerMeter',
    example: 15.6,
    description: 'Tỷ lệ quy đổi điểm ảnh / mét',
    required: false,
  })
  scalePixelsPerMeter?: number;

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'outlineGeom',
    example:
      'POLYGON((106.1 10.1, 106.2 10.1, 106.2 10.2, 106.1 10.2, 106.1 10.1))',
    description:
      'Hình dạng đường viền bao tầng dưới dạng WKT Polygon hoặc GeoJSON',
    required: false,
  })
  outlineGeom?: string;
}
