import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateVisitSessionReqDto {
  @IsUUID()
  @ApiProperty({
    description: 'ID của bệnh nhân',
    example: 'd3b07384-d113-49cd-a5d6-8c1d63a628ef',
  })
  patient_id: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  @ApiProperty({
    description: 'Ngày khám',
    required: false,
    example: '2026-07-20T13:00:00.000Z',
  })
  visit_date?: Date;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Lý do khám',
    required: false,
    example: 'Đau đầu, chóng mặt',
  })
  chief_complaint?: string;

  @IsInt()
  @IsOptional()
  @ApiProperty({
    description: 'Nhịp tim',
    required: false,
    example: 80,
  })
  heart_rate?: number;

  @IsInt()
  @IsOptional()
  @ApiProperty({
    description: 'Huyết áp tâm thu',
    required: false,
    example: 120,
  })
  blood_pressure_sys?: number;

  @IsInt()
  @IsOptional()
  @ApiProperty({
    description: 'Huyết áp tâm trương',
    required: false,
    example: 80,
  })
  blood_pressure_dia?: number;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    description: 'Nhiệt độ',
    required: false,
    example: 36.8,
  })
  temperature?: number;

  @IsInt()
  @IsOptional()
  @ApiProperty({
    description: 'Chỉ số SpO2',
    required: false,
    example: 98,
  })
  spo2?: number;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Chẩn đoán sơ bộ / lâm sàng',
    required: false,
    example: 'Đau nửa đầu Migraine',
  })
  diagnosis?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Chẩn đoán cuối cùng',
    required: false,
    example: 'Đau nửa đầu cấp tính',
  })
  final_diagnosis?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Bệnh sử (History of Present Illness)',
    required: false,
    example: 'Đau đầu vùng thái dương kéo dài 2 ngày...',
  })
  hpi?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Tiền sử bệnh (Past Medical History)',
    required: false,
    example: 'Cao huyết áp nhẹ phát hiện năm 2024...',
  })
  pmh?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Khám thực thể (Physical Examination)',
    required: false,
    example: { lungs: 'clear', heart: 'normal rhythm' },
  })
  pe?: any;
}

export class UpdateVisitSessionReqDto extends PartialType(CreateVisitSessionReqDto) {}
