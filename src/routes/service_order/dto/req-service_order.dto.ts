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

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    example: 'e7f88300-c39a-4821-b6c7-28c6daae313c',
    description: 'Phòng chỉ định (nếu có)',
  })
  room_id?: string;
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
