import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatusEnum } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class QueryPatientBillingDto {
  @ApiPropertyOptional({
    description:
      'Lọc từ ngày (YYYY-MM-DD hoặc ISO 8601). Áp dụng visit_date, fallback booking.created_at',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description:
      'Lọc đến ngày (YYYY-MM-DD hoặc ISO 8601). Áp dụng visit_date, fallback booking.created_at',
    example: '2026-09-01',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    enum: PaymentStatusEnum,
    description: 'Lọc theo trạng thái thanh toán của đơn dịch vụ',
  })
  @IsOptional()
  @IsEnum(PaymentStatusEnum)
  payment_status?: PaymentStatusEnum;

  @ApiPropertyOptional({
    description: 'Trang (phân trang theo lần khám)',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Số lần khám mỗi trang (tối đa 50)',
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
