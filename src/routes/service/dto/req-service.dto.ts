import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsEnum,
} from 'class-validator';
import { ClinicalRoomType, ServiceTypeEnum } from '@prisma/client';

export class CreateServiceDto {}

export class CreateServiceReqDto {
  @IsString()
  @ApiProperty({
    name: 'service_code',
    example: 'KHAM_BAN_DAU',
    required: false,
    description: 'Mã dịch vụ',
  })
  service_code: string;

  @IsString()
  @ApiProperty({
    name: 'service_name',
    example: 'Khám chuyên khoa',
    description: 'Tên dịch vụ',
  })
  service_name: string;

  @IsInt()
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
    description: 'Lọc dịch vụ theo loại',
  })
  @IsOptional()
  @IsEnum(ServiceTypeEnum)
  service_type?: ServiceTypeEnum;
}
