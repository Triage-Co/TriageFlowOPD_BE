import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisplayScreenKind, DisplayScreenStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class QueryDisplayScreenDto {
  @ApiPropertyOptional({ enum: DisplayScreenKind })
  @IsEnum(DisplayScreenKind)
  @IsOptional()
  kind?: DisplayScreenKind;

  @ApiPropertyOptional({ enum: DisplayScreenStatus })
  @IsEnum(DisplayScreenStatus)
  @IsOptional()
  status?: DisplayScreenStatus;
}

export class CreateDisplayScreenDto {
  @ApiProperty({ example: 'TV-NT-1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code: string;

  @ApiProperty({ example: 'Quầy 1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: DisplayScreenKind })
  @IsEnum(DisplayScreenKind)
  kind: DisplayScreenKind;

  @ApiPropertyOptional({ enum: DisplayScreenStatus })
  @IsEnum(DisplayScreenStatus)
  @IsOptional()
  status?: DisplayScreenStatus;

  @ApiPropertyOptional({ description: 'Phòng logic gắn màn hình' })
  @IsUUID()
  @IsOptional()
  room_id?: string;

  @ApiPropertyOptional({
    description: 'Cấu hình theo loại màn hình (JSON)',
    example: { enable_otp: true, floor_number: 1 },
  })
  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}

export class UpdateDisplayScreenDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(64)
  code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: DisplayScreenStatus })
  @IsEnum(DisplayScreenStatus)
  @IsOptional()
  status?: DisplayScreenStatus;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  room_id?: string | null;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}

export class VerifyDisplayPinDto {
  @ApiProperty({ example: '123456', minLength: 4, maxLength: 8 })
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  @Matches(/^\d+$/, { message: 'PIN chỉ gồm chữ số' })
  pin: string;
}

export class ChangeDisplayPinDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  @Matches(/^\d+$/, { message: 'PIN chỉ gồm chữ số' })
  current_pin: string;

  @ApiProperty({ example: '654321' })
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  @Matches(/^\d+$/, { message: 'PIN chỉ gồm chữ số' })
  new_pin: string;
}

export class FindOrCreateClinicDisplayDto {
  @ApiProperty({ description: 'UUID phòng khám để gắn TV_CLINIC' })
  @IsUUID()
  @IsNotEmpty()
  room_id: string;
}

export class FindOrCreatePaymentDisplayDto {
  @ApiPropertyOptional({ description: 'UUID phòng CASHIER (tuỳ chọn)' })
  @IsUUID()
  @IsOptional()
  room_id?: string;
}
