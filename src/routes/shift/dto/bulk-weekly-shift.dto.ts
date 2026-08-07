import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkWeeklyAssignmentDto {
  @ApiProperty({ example: '11090321-c0f9-406e-8884-728ebccb037b' })
  @IsNotEmpty({ message: 'room_id không được để trống' })
  @IsUUID('4', { message: 'room_id phải là định dạng UUID' })
  room_id: string;

  @ApiProperty({ example: '1149520e-bd19-4cb3-851a-6af485287b25' })
  @IsNotEmpty({ message: 'staff_id không được để trống' })
  @IsUUID('4', { message: 'staff_id phải là định dạng UUID' })
  staff_id: string;
}

export class BulkWeeklyShiftDto {
  @ApiProperty({
    example: '2026-08-10',
    description: 'Ngày bắt đầu tuần (yyyy-MM-dd), bắt buộc phải là Thứ 2 theo giờ Việt Nam',
  })
  @IsNotEmpty({ message: 'week_start không được để trống' })
  @IsString({ message: 'week_start phải là chuỗi' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'week_start phải theo định dạng yyyy-MM-dd',
  })
  week_start: string;

  @ApiPropertyOptional({
    example: [0, 1, 2, 3, 4],
    description:
      'Danh sách offset ngày trong tuần tính từ week_start (0 = Thứ 2 ... 6 = Chủ nhật). Mặc định [0,1,2,3,4] (T2-T6)',
    default: [0, 1, 2, 3, 4],
  })
  @IsOptional()
  @IsArray({ message: 'days phải là mảng' })
  @ArrayMaxSize(7, { message: 'days tối đa 7 phần tử' })
  @IsInt({ each: true, message: 'mỗi phần tử của days phải là số nguyên' })
  @Min(0, { each: true, message: 'mỗi phần tử của days tối thiểu là 0' })
  @Max(6, { each: true, message: 'mỗi phần tử của days tối đa là 6' })
  days?: number[] = [0, 1, 2, 3, 4];

  @ApiProperty({ example: '08:00', description: 'Giờ bắt đầu ca (HH:mm)' })
  @IsNotEmpty({ message: 'start_time không được để trống' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'start_time phải theo định dạng HH:mm (00:00 - 23:59)',
  })
  start_time: string;

  @ApiProperty({ example: '17:00', description: 'Giờ kết thúc ca (HH:mm)' })
  @IsNotEmpty({ message: 'end_time không được để trống' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'end_time phải theo định dạng HH:mm (00:00 - 23:59)',
  })
  end_time: string;

  @ApiProperty({
    type: [BulkWeeklyAssignmentDto],
    description: 'Danh sách cặp phòng/nhân viên cần tạo ca trực',
  })
  @IsArray({ message: 'assignments phải là mảng' })
  @ArrayMinSize(1, { message: 'assignments phải có ít nhất 1 phần tử' })
  @ArrayMaxSize(500, { message: 'assignments tối đa 500 phần tử' })
  @ValidateNested({ each: true })
  @Type(() => BulkWeeklyAssignmentDto)
  assignments: BulkWeeklyAssignmentDto[];

  @ApiPropertyOptional({
    example: true,
    description: 'Bỏ qua và báo cáo các ca bị xung đột thay vì fail toàn bộ batch',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'skip_conflicts phải là boolean' })
  skip_conflicts?: boolean = true;
}
