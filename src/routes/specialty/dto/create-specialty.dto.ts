import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSpecialtyDto {
  @ApiProperty({ example: 'NOI_TONG_QUAT' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'specialty_code chỉ chứa chữ in hoa, số và dấu gạch dưới',
  })
  @MaxLength(64)
  specialty_code: string;

  @ApiProperty({ example: 'Nội tổng quát' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  specialty_name: string;

  @ApiPropertyOptional({ example: 'Khám và điều trị nội khoa' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateSpecialtyDto extends PartialType(CreateSpecialtyDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class QuerySpecialtyDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: 'noi' })
  @IsOptional()
  @IsString()
  search?: string;
}

/** @deprecated kept for compatibility */
export class CreateSpecialtyReqDto {}
