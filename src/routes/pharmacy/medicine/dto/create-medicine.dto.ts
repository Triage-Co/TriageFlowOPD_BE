import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateMedicineDto {
  @ApiProperty({ description: 'Mã thuốc (duy nhất)', example: 'MED-PAR-500' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64, { message: 'medicine_code tối đa 64 ký tự' })
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'medicine_code chỉ chứa chữ in hoa, số, gạch dưới và gạch ngang',
  })
  medicine_code: string;

  @ApiProperty({
    description: 'Tên biệt dược/thuốc',
    example: 'Paracetamol 500mg',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200, { message: 'medicine_name tối đa 200 ký tự' })
  medicine_name: string;

  @ApiPropertyOptional({
    description: 'Hoạt chất chính',
    example: 'Paracetamol',
  })
  @IsString()
  @IsOptional()
  active_ingredient?: string;

  @ApiPropertyOptional({ description: 'Đơn vị tính', example: 'Viên' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({
    description: 'Đường dùng (Uống, Tiêm, Bôi...)',
    example: 'Uống',
  })
  @IsString()
  @IsOptional()
  usage_route?: string;

  @ApiPropertyOptional({
    description: 'Đơn giá (VNĐ)',
    example: 2000,
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  unit_price?: number;

  @ApiPropertyOptional({
    description: 'Nhà sản xuất',
    example: 'Dược Hậu Giang',
  })
  @IsString()
  @IsOptional()
  manufacturer?: string;

  @ApiPropertyOptional({ description: 'Mô tả / Lưu ý về thuốc' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Trạng thái hoạt động', default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class BulkCreateMedicineDto {
  @ApiProperty({
    type: [CreateMedicineDto],
    description: 'Danh sách các thuốc cần khởi tạo hàng loạt',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMedicineDto)
  medicines: CreateMedicineDto[];
}
