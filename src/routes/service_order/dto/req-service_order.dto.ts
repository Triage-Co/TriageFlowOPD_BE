import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ServiceOrderStatusEnum } from '@prisma/client';

export class CreateServiceOrderReqDto {
  @IsUUID()
  @ApiProperty({
    example: 'e7f88300-c39a-4821-b6c7-28c6daae313c',
    description: 'Booking liên kết',
  })
  booking_id: string;

  @IsArray()
  @ApiProperty({
    example: '["XET_NGHIEM_MAU", "X_QUANG"]',
    description: 'Mã của Service Order',
  })
  service_code: string[];

}

export class UpdateServiceOrderReqDto extends PartialType(
  CreateServiceOrderReqDto,
) {
  @IsOptional()
  @IsEnum(ServiceOrderStatusEnum)
  @ApiPropertyOptional({
    enum: ServiceOrderStatusEnum,
    description: 'Trạng thái Service Order',
  })
  status?: ServiceOrderStatusEnum;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID của chi tiết Service Order cần cập nhật (nếu có nhiều dịch vụ)',
  })
  detail_id?: string;

  @ApiPropertyOptional({
    name: 'room_id',
    description: 'ID phòng thực hiện (nếu muốn chỉ định rõ)',
  })
  @IsOptional()
  @IsUUID()
  room_id?: string;
}

export class QueryServiceOrderReqDto {
  @ApiPropertyOptional({
    name: 'page',
    example: 1,
    description: 'Trang hiện tại',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    name: 'limit',
    example: 10,
    description: 'Số lượng bản ghi mỗi trang',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  limit?: number;
}

export class UpdateDetailReqDto {
  @ApiProperty({
    name: 'service_code',
    example: 'XQ_001',
    description: 'Mã Service mới',
  })
  @IsString()
  service_code: string;

  @ApiPropertyOptional({
    name: 'room_id',
    description: 'ID phòng thực hiện (nếu muốn chỉ định rõ)',
  })
  @IsOptional()
  @IsUUID()
  room_id?: string;
}
