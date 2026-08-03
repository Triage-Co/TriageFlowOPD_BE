import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class TicketCheckInDto {
  @ApiProperty({
    example: 'b2c3d4e5-f6a7-8901-bcde-f0123456789a',
    description: 'ID của phòng khám/xét nghiệm mà bệnh nhân thực hiện check-in (cấu hình sẵn từ kiosk/thiết bị)',
  })
  @IsNotEmpty({ message: 'room_id không được để trống' })
  @IsUUID('4', { message: 'room_id phải là định dạng UUID' })
  room_id: string;
}
