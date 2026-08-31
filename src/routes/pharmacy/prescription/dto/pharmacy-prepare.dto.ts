import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class PharmacyPrepareDto {
  @ApiPropertyOptional({
    description:
      'ID màn hình quầy TV_PHARMACY. Nếu có, stamp called_at + display_screen_id cho đúng đơn này.',
  })
  @IsUUID()
  @IsOptional()
  display_screen_id?: string;
}
