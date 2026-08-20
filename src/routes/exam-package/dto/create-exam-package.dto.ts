import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExamPackageDto {
  @ApiProperty({
    description: 'Tên gói khám',
    example: 'Gói khám tổng quát cơ bản',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200, { message: 'package_name tối đa 200 ký tự' })
  package_name: string;

  @ApiPropertyOptional({
    description: 'Mô tả chi tiết gói',
    example: 'Bao gồm siêu âm, xét nghiệm máu cơ bản',
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000, { message: 'description tối đa 2000 ký tự' })
  description?: string;

  @ApiProperty({ description: 'Giá của gói', example: 500000 })
  @IsInt()
  @Min(0, { message: 'price phải lớn hơn hoặc bằng 0' })
  price: number;

  @ApiPropertyOptional({ description: 'Trạng thái hoạt động', example: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiProperty({
    description: 'ID của Template Luồng Khám',
    example: 'e3f1...',
  })
  @IsUUID('4', { message: 'template_id phải là định dạng UUID' })
  @IsNotEmpty()
  template_id: string;
}
