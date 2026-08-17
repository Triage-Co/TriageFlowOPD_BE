import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class BanReqDto {
  @ApiProperty({
    name: 'hours',
    example: 2,
    description: 'Số giờ người dùng bị cấm',
  })
  @IsInt({ message: 'Số giờ phải là một số nguyên hợp lệ' })
  @Min(0, { message: 'Số giờ không được nhỏ hơn 0' })
  @Type(() => Number)
  hours: number;

  @ApiProperty({
    name: 'minutes',
    example: 30,
    description: 'Số phút người dùng bị cấm',
  })
  @IsInt({ message: 'Số phút phải là một số nguyên hợp lệ' })
  @Min(0, { message: 'Số phút không được nhỏ hơn 0' })
  @Type(() => Number)
  minutes: number;
}
