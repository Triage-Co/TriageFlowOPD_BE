import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class PharmacyCallNextDto {
  @ApiPropertyOptional({
    description: 'ID phòng nhà thuốc. Bỏ trống thì dùng phòng gắn quầy hoặc phòng PHARMACY mặc định.',
    example: 'd0b81048-2615-4674-8d96-5cb39a1b6357',
  })
  @IsUUID()
  @IsOptional()
  room_id?: string;

  @ApiPropertyOptional({
    description: 'ID màn hình quầy TV_PHARMACY để gán số đang gọi',
  })
  @IsUUID()
  @IsOptional()
  display_screen_id?: string;

  @ApiPropertyOptional({
    description: 'ID đơn thuốc cần gọi lên TV. Bỏ trống thì gọi đơn PREPARED chưa lên TV cũ nhất (1 đơn).',
  })
  @IsUUID()
  @IsOptional()
  prescription_id?: string;
}
