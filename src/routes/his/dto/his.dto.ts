import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ImportHisDto {
  @ApiPropertyOptional({
    description: 'ID của phiên khám bệnh (Visit_Session) cần import vào (nếu có)',
    example: 'c3d4e5f6-a7b8-9012-cdef-3456789012cd',
  })
  @IsOptional()
  @IsString()
  visit_session_id?: string;
}

export class HisWebhookDto {
  @ApiProperty({
    description: 'Số CCCD/CMND của bệnh nhân',
    example: '079099123456',
  })
  @IsString()
  citizen_id: string;

  @ApiPropertyOptional({
    description: 'Dữ liệu bệnh án từ HIS',
  })
  @IsOptional()
  data?: Record<string, any>;
}
