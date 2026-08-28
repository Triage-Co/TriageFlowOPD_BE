import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { StepTypeEnum } from '@prisma/client';

export class CallPatientDto {
  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
    description: 'Gọi đích danh (optional)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'step_id phải là định dạng UUID' })
  step_id?: string;

  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f0123456789a' })
  @IsNotEmpty({ message: 'room_id không được để trống' })
  @IsUUID('4', { message: 'room_id phải là định dạng UUID' })
  room_id: string;

  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-0123456789ab' })
  @IsNotEmpty({ message: 'staff_id không được để trống' })
  @IsUUID('4', { message: 'staff_id phải là định dạng UUID' })
  staff_id: string;
}

export class TransferQueueDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789' })
  @IsNotEmpty({ message: 'step_id không được để trống' })
  @IsUUID('4', { message: 'step_id phải là định dạng UUID' })
  step_id: string;

  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f0123456789a' })
  @IsNotEmpty({ message: 'to_room_id không được để trống' })
  @IsUUID('4', { message: 'to_room_id phải là định dạng UUID' })
  to_room_id: string;

  @ApiPropertyOptional({ example: 'c3d4e5f6-a7b8-9012-cdef-0123456789ab' })
  @IsOptional()
  @IsUUID('4', { message: 'staff_id phải là định dạng UUID' })
  staff_id?: string;
}

export enum OverrideActionEnum {
  PIN_TOP = 'PIN_TOP',
  MOVE_TO_POSITION = 'MOVE_TO_POSITION',
  UNPIN = 'UNPIN',
}

export class OverrideQueueDto {
  @ApiProperty({
    enum: OverrideActionEnum,
    example: OverrideActionEnum.PIN_TOP,
  })
  @IsNotEmpty({ message: 'action không được để trống' })
  @IsEnum(OverrideActionEnum, {
    message: 'action phải là PIN_TOP, MOVE_TO_POSITION hoặc UNPIN',
  })
  action: OverrideActionEnum;

  @ApiPropertyOptional({ example: 3, description: 'Đứng sau ít nhất n người' })
  @IsOptional()
  @IsInt({ message: 'position phải là số nguyên' })
  @Min(0, { message: 'position phải lớn hơn hoặc bằng 0' })
  position?: number;

  @ApiPropertyOptional({ example: 'Lý do can thiệp ưu tiên' })
  @IsOptional()
  @IsString({ message: 'reason phải là chuỗi' })
  reason?: string;
}

export class UpdateRoomStatDto {
  @ApiProperty({ enum: StepTypeEnum, example: StepTypeEnum.CLINICAL })
  @IsNotEmpty({ message: 'step_type không được để trống' })
  @IsEnum(StepTypeEnum, { message: 'step_type không hợp lệ' })
  step_type: StepTypeEnum;

  @ApiProperty({
    example: 900,
    description: 'Thời gian phục vụ mặc định tính bằng giây (60 - 7200)',
  })
  @IsNotEmpty({ message: 'default_duration_sec không được để trống' })
  @IsInt({ message: 'default_duration_sec phải là số nguyên' })
  @Min(60, {
    message: 'default_duration_sec phải lớn hơn hoặc bằng 60 (1 phút)',
  })
  @Max(7200, {
    message: 'default_duration_sec phải nhỏ hơn hoặc bằng 7200 (2 giờ)',
  })
  default_duration_sec: number;
}

export class RefuseQueueDto {
  @ApiPropertyOptional({ example: 'Bệnh nhân từ chối thực hiện dịch vụ' })
  @IsOptional()
  @IsString({ message: 'reason phải là chuỗi' })
  reason?: string;
}

export class ScanQueueDto {
  @ApiPropertyOptional({
    example: 'TK-20260828-XXXX',
    description: 'Mã vé khám (từ mã QR trên vé)',
  })
  @IsOptional()
  @IsString({ message: 'ticket_code phải là chuỗi' })
  ticket_code?: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
    description: 'ID lượt chờ queue_id',
  })
  @IsOptional()
  @IsUUID('4', { message: 'queue_id phải là định dạng UUID' })
  queue_id?: string;

  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f0123456789a' })
  @IsNotEmpty({ message: 'room_id không được để trống' })
  @IsUUID('4', { message: 'room_id phải là định dạng UUID' })
  room_id: string;

  @ApiPropertyOptional({ example: 'c3d4e5f6-a7b8-9012-cdef-0123456789ab' })
  @IsOptional()
  @IsUUID('4', { message: 'staff_id phải là định dạng UUID' })
  staff_id?: string;
}

