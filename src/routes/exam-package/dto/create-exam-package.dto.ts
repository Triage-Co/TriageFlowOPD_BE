import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateExamPackageDto {
  @ApiProperty({
    description: 'Tên gói khám',
    example: 'Gói khám tổng quát cơ bản',
  })
  @IsString()
  @IsNotEmpty()
  package_name: string;

  @ApiPropertyOptional({
    description: 'Mô tả chi tiết gói',
    example: 'Bao gồm siêu âm, xét nghiệm máu cơ bản',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Giá của gói', example: 500000 })
  @IsInt()
  price: number;

  @ApiPropertyOptional({ description: 'Trạng thái hoạt động', example: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiProperty({
    description: 'ID của Template Luồng Khám',
    example: 'e3f1...',
  })
  @IsUUID()
  @IsNotEmpty()
  template_id: string;
}
