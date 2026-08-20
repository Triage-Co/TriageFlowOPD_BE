import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  Max,
  Min,
  IsOptional,
  IsBoolean,
  IsString,
} from 'class-validator';

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

export class FindAllUsersQueryDto {
  @ApiPropertyOptional({ description: 'Trang hiện tại' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Số lượng item trên 1 trang',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Trạng thái hoạt động (true/false)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (email, sdt, tên)' })
  @IsOptional()
  @IsString()
  search?: string;
}
