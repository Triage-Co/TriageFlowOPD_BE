import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class FindShiftQueryDto {
  @ApiPropertyOptional({ description: 'Số trang', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Số lượng kết quả trên một trang (mặc định không giới hạn nếu không truyền)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (tên nhân viên, loại phòng, email)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'ID nhân viên' })
  @IsOptional()
  @IsUUID()
  staff_id?: string;

  @ApiPropertyOptional({ description: 'ID phòng' })
  @IsOptional()
  @IsUUID()
  room_id?: string;

  @ApiPropertyOptional({ description: 'Ngày trực (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Thời gian bắt đầu (HH:mm)' })
  @IsOptional()
  @IsString()
  start_time?: string;

  @ApiPropertyOptional({ description: 'Thời gian kết thúc (HH:mm)' })
  @IsOptional()
  @IsString()
  end_time?: string;
}
