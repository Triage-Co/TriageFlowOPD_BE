import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { IsFutureDate } from '../../../shared/constraint/is_future_date.constaint';

const emptyToUndef = ({ value }: { value: unknown }) =>
  value === '' || value === null || value === undefined ? undefined : value;

const DATE_YMD = /^\d{4}-\d{2}-\d{2}$/;

export class CreateShiftRequestDto {
  @IsString()
  @ApiProperty({
    name: 'staff_id',
    example: '1149520e-bd19-4cb3-851a-6af485287b25',
  })
  staff_id: string;
  @IsString()
  @ApiProperty({
    name: 'room_id',
    example: '11090321-c0f9-406e-8884-728ebccb037b',
  })
  room_id: string;
  @IsDate()
  @Type(() => Date)
  @ApiProperty({
    name: 'date',
    example: '2026-06-25',
  })
  
  @IsFutureDate()
  date: Date;
  @IsString()
  @ApiProperty({
    name: 'start_time',
    example: '08:00',
  })
  start_time: string;
  @IsString()
  @ApiProperty({
    name: 'end_time',
    example: '17:00',
  })
  end_time: string;
}

export class UpdateShiftRequestDto extends PartialType(CreateShiftRequestDto) {}

export class QueryShiftDto {
  @ApiPropertyOptional({
    example: '2026-08-19',
    description:
      'Lọc đúng một ngày (yyyy-MM-dd). Ưu tiên hơn from/to. Nếu không truyền date/from/to thì mặc định ngày hôm nay (Asia/Ho_Chi_Minh).',
  })
  @IsOptional()
  @Transform(emptyToUndef)
  @IsString()
  @Matches(DATE_YMD, { message: 'date phải theo định dạng yyyy-MM-dd' })
  date?: string;

  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'Ngày bắt đầu khoảng lọc (yyyy-MM-dd)',
  })
  @IsOptional()
  @Transform(emptyToUndef)
  @IsString()
  @Matches(DATE_YMD, { message: 'from phải theo định dạng yyyy-MM-dd' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-08-31',
    description: 'Ngày kết thúc khoảng lọc (yyyy-MM-dd)',
  })
  @IsOptional()
  @Transform(emptyToUndef)
  @IsString()
  @Matches(DATE_YMD, { message: 'to phải theo định dạng yyyy-MM-dd' })
  to?: string;

  @ApiPropertyOptional({
    example: '11090321-c0f9-406e-8884-728ebccb037b',
    description: 'Lọc theo phòng',
  })
  @IsOptional()
  @Transform(emptyToUndef)
  @IsUUID('4', { message: 'room_id phải là định dạng UUID' })
  room_id?: string;

  @ApiPropertyOptional({
    example: '1149520e-bd19-4cb3-851a-6af485287b25',
    description: 'Lọc theo nhân viên',
  })
  @IsOptional()
  @Transform(emptyToUndef)
  @IsUUID('4', { message: 'staff_id phải là định dạng UUID' })
  staff_id?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Trang hiện tại (mặc định 1)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Số bản ghi mỗi trang (mặc định 100, tối đa 500)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500, { message: 'limit tối đa là 500' })
  @Type(() => Number)
  limit?: number;
}
