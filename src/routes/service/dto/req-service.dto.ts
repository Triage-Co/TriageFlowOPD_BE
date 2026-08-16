import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ClinicalRoomType, ServiceTypeEnum } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateServiceDto {}

export class CreateServiceReqDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'service_code chỉ chứa chữ in hoa, số và dấu gạch dưới',
  })
  @MaxLength(64)
  @ApiProperty({
    name: 'service_code',
    example: 'KHAM_BAN_DAU',
    description: 'Mã dịch vụ',
  })
  service_code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @ApiProperty({
    name: 'service_name',
    example: 'Khám chuyên khoa',
    description: 'Tên dịch vụ',
  })
  service_name: string;

  @IsInt()
  @Min(0)
  @ApiProperty({
    name: 'price',
    example: 2000,
    description: 'Giá dịch vụ',
  })
  price: number;

  @IsNotEmpty()
  @IsEnum(ServiceTypeEnum)
  @ApiProperty({
    name: 'service_type',
    enum: ServiceTypeEnum,
    example: ServiceTypeEnum.CLINICAL_EXAMINATION,
    description:
      'Loại dịch vụ (CLINICAL_EXAMINATION, PRESCRIPTION, DIAGNOSTIC_TEST, PROCEDURE)',
  })
  service_type: ServiceTypeEnum;

  @IsOptional()
  @IsEnum(ClinicalRoomType)
  @ApiPropertyOptional({
    name: 'room_type',
    enum: ClinicalRoomType,
    description:
      'Loại phòng cho dịch vụ (tuỳ chọn, dùng cho cận lâm sàng/thủ thuật)',
  })
  room_type?: ClinicalRoomType;
}

export class UpdateServiceReqDto extends PartialType(CreateServiceReqDto) {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    name: 'is_active',
    example: true,
    description: 'Trạng thái hoạt động của dịch vụ',
  })
  is_active?: boolean;
}

export class QueryServiceReqDto {
  @ApiPropertyOptional({
    name: 'page',
    example: 1,
    description: 'Số trang hiện tại (nếu bỏ trống sẽ lấy tất cả)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    name: 'limit',
    example: 10,
    description: 'Số lượng bản ghi trên một trang (nếu bỏ trống sẽ lấy tất cả)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    name: 'service_type',
    enum: ServiceTypeEnum,
  })
  @IsOptional()
  @IsEnum(ServiceTypeEnum)
  service_type?: ServiceTypeEnum;

  @ApiPropertyOptional({
    name: 'room_type',
    enum: ClinicalRoomType,
  })
  @IsOptional()
  @IsEnum(ClinicalRoomType)
  room_type?: ClinicalRoomType;

  @ApiPropertyOptional({ 
    description: 'Trạng thái hoạt động (nếu bỏ trống sẽ không lọc theo trạng thái)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
