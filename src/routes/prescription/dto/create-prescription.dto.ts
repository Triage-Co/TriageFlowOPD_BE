import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class PrescriptionDetailItemDto {
  @ApiProperty({ description: 'ID của loại thuốc', example: 'd0b81048-2615-4674-8d96-5cb39a1b6357' })
  @IsUUID()
  @IsNotEmpty()
  medicine_id: string;

  @ApiProperty({ description: 'Số lượng kê', example: 10, default: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ description: 'Hướng dẫn liều dùng', example: 'Sáng 1 viên, tối 1 viên sau ăn' })
  @IsString()
  @IsOptional()
  dosage_instruction?: string;

  @ApiPropertyOptional({ description: 'Ghi chú từng loại thuốc' })
  @IsString()
  @IsOptional()
  note?: string;
}

export class CreatePrescriptionDto {
  @ApiProperty({ description: 'ID của phiên khám bệnh (Visit_Session)', example: 'd0b81048-2615-4674-8d96-5cb39a1b6357' })
  @IsUUID()
  @IsNotEmpty()
  visit_session_id: string;

  @ApiPropertyOptional({ description: 'ID của chỉ định dịch vụ (Service_Order), nếu chưa truyền hệ thống sẽ tự động khởi tạo' })
  @IsUUID()
  @IsOptional()
  service_order_id?: string;

  @ApiPropertyOptional({ description: 'ID Bác sĩ kê đơn (nếu không truyền sẽ tự động lấy theo Staff ID của tài khoản đang đăng nhập)' })
  @IsUUID()
  @IsOptional()
  prescribed_by?: string;

  @ApiPropertyOptional({ description: 'Dặn dò chung của bác sĩ / Lời khuyên' })
  @IsString()
  @IsOptional()
  diagnosis_note?: string;

  @ApiProperty({ type: [PrescriptionDetailItemDto], description: 'Danh sách chi tiết các loại thuốc kê trong đơn' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionDetailItemDto)
  details: PrescriptionDetailItemDto[];
}
