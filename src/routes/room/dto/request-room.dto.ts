import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ClinicalRoomType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateRoomRequestDto {
  @IsString()
  @ApiProperty({
    name: 'room_name',
    example: 'P_1',
  })
  room_name: string;

  @IsEnum(ClinicalRoomType)
  @ApiProperty({
    example: ClinicalRoomType.CLINICAL_ROOM,
    enum: ClinicalRoomType,
  })
  room_type: ClinicalRoomType;

  @IsOptional()
  @ValidateIf(
    (o) => o.physical_room_id !== null && o.physical_room_id !== undefined,
  )
  @IsUUID()
  @ApiPropertyOptional({
    example: '082650f9-be60-48c3-8039-f6d48ad11144',
    nullable: true,
  })
  physical_room_id?: string | null;

  @IsUUID()
  @IsOptional()
  @ApiPropertyOptional({
    name: 'specialty_id',
    example: '082650f9-be60-48c3-8039-f6d48ad11144',
  })
  specialty_id?: string;
}

export class UpdateRoomRequestDto extends PartialType(CreateRoomRequestDto) {}

export class QueryRoomReqDto {
  @ApiPropertyOptional({
    name: 'page',
    example: 1,
    description: 'Số trang hiện tại',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    name: 'limit',
    example: 10,
    description: 'Số lượng bản ghi trên một trang',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    name: 'sortBy',
    example: 'created_at',
    description:
      'Trường dùng để sắp xếp (room_name, room_type, created_at, updated_at)',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({
    name: 'sortOrder',
    example: 'desc',
    enum: ['asc', 'desc'],
    description: 'Chiều sắp xếp (asc hoặc desc)',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    name: 'room_type',
    enum: ClinicalRoomType,
    description: 'Lọc phòng theo loại phòng',
  })
  @IsOptional()
  @IsEnum(ClinicalRoomType)
  room_type?: ClinicalRoomType;

  @ApiPropertyOptional({
    name: 'search',
    example: 'P_',
    description: 'Tìm kiếm theo tên phòng (room_name)',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
