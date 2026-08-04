import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PrescriptionDetailItemDto } from './create-prescription.dto';

export class UpdatePrescriptionDto {
  @ApiPropertyOptional({ description: 'Dặn dò chung của bác sĩ' })
  @IsString()
  @IsOptional()
  diagnosis_note?: string;

  @ApiPropertyOptional({
    type: [PrescriptionDetailItemDto],
    description:
      'Danh sách chi tiết thuốc mới (nếu muốn thay thế toàn bộ danh sách)',
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionDetailItemDto)
  details?: PrescriptionDetailItemDto[];
}
