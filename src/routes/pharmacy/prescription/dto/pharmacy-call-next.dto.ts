import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class PharmacyCallNextDto {
  @ApiPropertyOptional({
    description: 'ID phòng nhà thuốc. Bỏ trống thì dùng phòng PHARMACY mặc định.',
    example: 'd0b81048-2615-4674-8d96-5cb39a1b6357',
  })
  @IsUUID()
  @IsOptional()
  room_id?: string;
}
