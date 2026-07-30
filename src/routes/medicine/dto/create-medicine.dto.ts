import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateMedicineDto {
  @ApiProperty({ description: 'Mã thuốc (duy nhất)', example: 'MED-PAR-500' })
  @IsString()
  @IsNotEmpty()
  medicine_code: string;

  @ApiProperty({ description: 'Tên biệt dược/thuốc', example: 'Paracetamol 500mg' })
  @IsString()
  @IsNotEmpty()
  medicine_name: string;

  @ApiPropertyOptional({ description: 'Hoạt chất chính', example: 'Paracetamol' })
  @IsString()
  @IsOptional()
  active_ingredient?: string;

  @ApiPropertyOptional({ description: 'Đơn vị tính', example: 'Viên' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({ description: 'Đường dùng (Uống, Tiêm, Bôi...)', example: 'Uống' })
  @IsString()
  @IsOptional()
  usage_route?: string;

  @ApiPropertyOptional({ description: 'Đơn giá (VNĐ)', example: 2000, default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  unit_price?: number;

  @ApiPropertyOptional({ description: 'Nhà sản xuất', example: 'Dược Hậu Giang' })
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
