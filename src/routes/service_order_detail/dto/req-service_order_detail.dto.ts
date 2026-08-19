import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  OmitType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateServiceOrderDetailReqDto {
  @IsUUID()
  @ApiProperty({
    name: 'service_order_id',
    example: 'c0a80123-1234-4567-890a-123456789abc',
    description: 'ID của Service Order',
  })
  service_order_id: string;

  @IsUUID()
  @ApiProperty({
    name: 'service_id',
    example: 'c0a80123-1234-4567-890a-123456789abc',
    description: 'ID của Service',
  })
  service_id: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    name: 'quantity',
    example: 1,
    description: 'Số lượng dịch vụ',
  })
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({
    name: 'price_at_order',
    example: 5000,
    description: 'Giá dịch vụ tại thời điểm đặt',
  })
  price_at_order?: number;
}

export class UpdateServiceOrderDetailReqDto extends PartialType(
  OmitType(CreateServiceOrderDetailReqDto, [
    'quantity',
    'price_at_order',
  ] as const),
) {}

export class QueryServiceOrderDetailReqDto {
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
