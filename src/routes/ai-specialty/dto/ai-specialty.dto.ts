import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAiSpecialtyDto {
  @ApiProperty({ example: 'sp_12' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^sp_\d+$/i, {
    message: 'ai_code phải có dạng sp_<số>, ví dụ sp_12',
  })
  @MaxLength(32)
  ai_code: string;

  @ApiProperty({ example: 'Cardiologist' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  ai_name: string;

  @ApiPropertyOptional({ example: 'Bác sĩ tim mạch' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  ai_name_vi?: string;

  @ApiPropertyOptional({ example: 'Mã chuyên khoa Infermedica' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateAiSpecialtyDto extends PartialType(CreateAiSpecialtyDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class QueryAiSpecialtyDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

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

  @ApiPropertyOptional({ example: 'cardio' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateAiSpecialtyMappingDto {
  @ApiProperty({ example: '45a24967-567e-4b67-a0dc-0d73f2052a06' })
  @IsUUID('4')
  specialty_id: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Nếu true, mapping này trở thành primary (các primary cũ bị bỏ)',
  })
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}

export class UpdateAiSpecialtyMappingDto {
  @ApiPropertyOptional({ example: '45a24967-567e-4b67-a0dc-0d73f2052a06' })
  @IsOptional()
  @IsUUID('4')
  specialty_id?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
