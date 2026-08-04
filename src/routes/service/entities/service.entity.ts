import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClinicalRoomType, ServiceTypeEnum } from '@prisma/client';

export class ServiceEntity {
  @ApiProperty({ description: 'ID dịch vụ' })
  service_id: string;

  @ApiPropertyOptional({ description: 'Mã dịch vụ' })
  service_code?: string;

  @ApiPropertyOptional({ description: 'Tên dịch vụ' })
  service_name?: string;

  @ApiProperty({ description: 'Giá dịch vụ' })
  price: number;

  @ApiProperty({
    enum: ServiceTypeEnum,
    description:
      'Loại dịch vụ (Clinical_examination, prescription, Diagnostic_test, Procedure)',
  })
  service_type: ServiceTypeEnum;

  @ApiPropertyOptional({
    enum: ClinicalRoomType,
    description: 'Loại phòng dịch vụ',
  })
  room_type?: ClinicalRoomType;

  @ApiProperty({ description: 'Trạng thái hoạt động' })
  is_active: boolean;

  @ApiProperty({ description: 'Ngày tạo' })
  created_at: Date;

  @ApiProperty({ description: 'Ngày cập nhật' })
  updated_at: Date;
}

export class Service extends ServiceEntity {}
