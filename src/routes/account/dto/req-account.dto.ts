import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class CreateAccountDto {}

export class BanReqDto {
  @ApiProperty({
    name: 'hours',
    example: 2,
    description: 'Số giờ',
  })
  @IsInt()
  @Min(0)
  @Max(23)
  @Type(() => Number)
  hours: number;

  @ApiProperty({
    name: 'minutes',
    example: 30,
    description: 'Số phút',
  })
  @IsInt()
  @Min(0)
  @Max(59)
  @Type(() => Number)
  minutes: number;
}
