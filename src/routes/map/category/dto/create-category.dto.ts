import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @ApiProperty({
    name: 'name',
    example: 'Phòng khám',
    description: 'Tên danh mục dịch vụ',
  })
  name: string;

  @IsObject()
  @IsOptional()
  @ApiProperty({
    name: 'nameLocalized',
    example: { vi: 'Phòng khám', en: 'Clinic' },
    description: 'Tên danh mục đa ngôn ngữ',
    required: false,
  })
  nameLocalized?: object;

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'icon',
    example: 'clinic-icon-name',
    description: 'Tên icon hiển thị',
    required: false,
  })
  icon?: string;

  @IsInt()
  @IsOptional()
  @ApiProperty({
    name: 'sortOrder',
    example: 1,
    description: 'Thứ tự sắp xếp của danh mục',
    required: false,
  })
  sortOrder?: number;
}
