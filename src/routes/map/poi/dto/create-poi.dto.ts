import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePoiDto {
  @IsUUID()
  @ApiProperty({
    name: 'roomId',
    example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0',
    description: 'ID của phòng đặt POI này',
  })
  roomId: string;

  @IsUUID()
  @ApiProperty({
    name: 'categoryId',
    example: 'b6b32cb3-1a22-42da-91ef-f6089bd608d1',
    description: 'ID danh mục dịch vụ của POI',
  })
  categoryId: string;

  @IsString()
  @ApiProperty({
    name: 'name',
    example: 'Quầy thuốc số 1',
    description: 'Tên của điểm dịch vụ (POI)',
  })
  name: string;

  @IsObject()
  @IsOptional()
  @ApiProperty({
    name: 'nameLocalized',
    example: { vi: 'Quầy thuốc số 1', en: 'Pharmacy No.1' },
    description: 'Tên POI đa ngôn ngữ',
    required: false,
  })
  nameLocalized?: object;

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'description',
    example: 'Quầy cấp phát thuốc bảo hiểm y tế',
    description: 'Mô tả chi tiết điểm dịch vụ',
    required: false,
  })
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ApiProperty({
    name: 'keywords',
    example: ['thuốc', 'quầy thuốc', 'phát thuốc', 'pharmacy'],
    description: 'Từ khóa tìm kiếm liên quan',
    required: false,
  })
  keywords?: string[];

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'logoUrl',
    example: 'https://example.com/logos/pharmacy.png',
    description: 'Đường dẫn ảnh logo của điểm dịch vụ',
    required: false,
  })
  logoUrl?: string;

  @IsObject()
  @IsOptional()
  @ApiProperty({
    name: 'contactInfo',
    example: { phone: '0243.123.456', email: 'pharmacy1@opd.com' },
    description: 'Thông tin liên hệ',
    required: false,
  })
  contactInfo?: object;

  @IsObject()
  @IsOptional()
  @ApiProperty({
    name: 'openingHours',
    example: { mon_fri: '07:30 - 17:00', sat: '08:00 - 12:00' },
    description: 'Khung giờ hoạt động',
    required: false,
  })
  openingHours?: object;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    name: 'active',
    example: true,
    description: 'Trạng thái hoạt động',
    required: false,
  })
  active?: boolean;
}
