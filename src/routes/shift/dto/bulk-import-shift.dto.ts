import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';

export class BulkImportShiftItemDto {
  @ApiProperty({ example: '1149520e-bd19-4cb3-851a-6af485287b25' })
  @IsNotEmpty({ message: 'staff_id không được để trống' })
  @IsUUID('4', { message: 'staff_id phải là định dạng UUID' })
  staff_id: string;

  @ApiProperty({ example: '11090321-c0f9-406e-8884-728ebccb037b' })
  @IsNotEmpty({ message: 'room_id không được để trống' })
  @IsUUID('4', { message: 'room_id phải là định dạng UUID' })
  room_id: string;

  @ApiProperty({ example: '2026-08-17', description: 'Ngày ca trực (yyyy-MM-dd)' })
  @IsNotEmpty({ message: 'date không được để trống' })
  @IsString({ message: 'date phải là chuỗi' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date phải theo định dạng yyyy-MM-dd',
  })
  date: string;

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
}

export class BulkImportShiftDto {
  @ApiProperty({
    type: [BulkImportShiftItemDto],
    description: 'Danh sách ca trực đã resolve (staff_id / room_id) cần tạo',
  })
  @IsArray({ message: 'items phải là mảng' })
  @ArrayMinSize(1, { message: 'items phải có ít nhất 1 phần tử' })
  @ArrayMaxSize(600, { message: 'items tối đa 600 phần tử' })
  @ValidateNested({ each: true })
  @Type(() => BulkImportShiftItemDto)
  items: BulkImportShiftItemDto[];

  @ApiPropertyOptional({
    example: true,
    description: 'Bỏ qua và báo cáo các ca bị xung đột thay vì fail toàn bộ batch',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'skip_conflicts phải là boolean' })
  skip_conflicts?: boolean = true;
}
