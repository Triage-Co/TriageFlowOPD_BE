import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ServiceOrderStatusEnum } from '@prisma/client';

export class CreateServiceOrderReqDto {
  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    example: 'e7f88300-c39a-4821-b6c7-28c6daae313c',
    description: 'Booking liên kết',
  })
  booking_id?: string;
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
  page?: number = 1;

  @ApiPropertyOptional({
    name: 'limit',
    example: 10,
    description: 'Số lượng bản ghi mỗi trang',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  limit?: number = 10;
}
