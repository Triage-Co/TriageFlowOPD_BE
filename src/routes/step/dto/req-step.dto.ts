import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatusEnum, StepStatusEnum } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateParentStepReqDto {
  @ApiProperty({
    description: 'ID của flow (Luồng khám)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'flow_id phải là định dạng UUID v4' })
  @IsNotEmpty({ message: 'flow_id không được để trống' })
  flow_id: string;

  @ApiPropertyOptional({
    description: 'ID của phòng (nếu có)',
    example: '123e4567-e89b-12d3-a456-426614174011',
  })
  @IsUUID('4')
  @IsOptional()
  room_id?: string;

  @ApiPropertyOptional({
    description: 'ID của nhân viên phụ trách (nếu có)',
    example: '123e4567-e89b-12d3-a456-426614174022',
  })
  @IsUUID('4')
  @IsOptional()
  staff_id?: string;

  @ApiPropertyOptional({
    enum: StepStatusEnum,
    description: 'Trạng thái của bước (Mặc định: PENDING)',
    example: StepStatusEnum.PENDING,
  })
  @IsEnum(StepStatusEnum, { message: 'Trạng thái không hợp lệ' })
  @IsOptional()
  step_status?: StepStatusEnum;
}

export class CreateSubStepReqDto {
  @ApiProperty({
    description: 'ID của bước cha',
    example: '123e4567-e89b-12d3-a456-426614174033',
  })
  @IsUUID('4', { message: 'parent_step_id phải là định dạng UUID v4' })
  @IsNotEmpty({ message: 'parent_step_id không được để trống' })
  parent_step_id: string;

  @ApiPropertyOptional({
    description: 'ID của phòng (nếu có)',
    example: '123e4567-e89b-12d3-a456-426614174011',
  })
  @IsUUID('4')
  @IsOptional()
  room_id?: string;

  @ApiPropertyOptional({
    description: 'ID của nhân viên phụ trách (nếu có)',
    example: '123e4567-e89b-12d3-a456-426614174022',
  })
  @IsUUID('4')
  @IsOptional()
  staff_id?: string;

  @ApiPropertyOptional({
    enum: StepStatusEnum,
    description: 'Trạng thái của bước (Mặc định: PENDING)',
    example: StepStatusEnum.PENDING,
  })
  @IsEnum(StepStatusEnum, { message: 'Trạng thái không hợp lệ' })
  @IsOptional()
  step_status?: StepStatusEnum;
}

export class CreateDependencyReqDto {
  @ApiProperty({
    description: 'ID của bước đang phải chờ (bước theo sau)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  @IsNotEmpty()
  waiting_step_id: string;

  @ApiProperty({
    description: 'ID của bước điều kiện (bước phải hoàn thành trước)',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID('4')
  @IsNotEmpty()
  required_step_id: string;
}

export class UpdateStepReqDto {
  @ApiPropertyOptional({
    description: 'ID của phòng',
    example: '123e4567-e89b-12d3-a456-426614174011',
  })
  @IsUUID('4')
  @IsOptional()
  room_id?: string;

  @ApiPropertyOptional({
    description: 'ID của nhân viên phụ trách',
    example: '123e4567-e89b-12d3-a456-426614174022',
  })
  @IsUUID('4')
  @IsOptional()
  staff_id?: string;

  @ApiPropertyOptional({
    description: 'Số thứ tự/Số chứng từ (nếu có)',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  docNo?: number;

  @ApiPropertyOptional({
    enum: PaymentStatusEnum,
    description: 'Trạng thái thanh toán',
    example: PaymentStatusEnum.SUCCESSED,
  })
  @IsEnum(PaymentStatusEnum)
  @IsOptional()
  payment_status?: PaymentStatusEnum;
}

export class UpdateStepStatusReqDto {
  @ApiProperty({
    enum: StepStatusEnum,
    description: 'Trạng thái mới của Step',
    example: StepStatusEnum.IN_PROGRESS,
  })
  @IsEnum(StepStatusEnum, { message: 'Trạng thái không hợp lệ' })
  @IsNotEmpty({ message: 'Trạng thái không được để trống' })
  step_status: StepStatusEnum;
}

export class FindByIdAndPatientIdReqDto {
  @ApiProperty({
    description: 'ID của bệnh nhân',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'patient_id phải là UUID' })
  patient_id: string;

  @ApiProperty({
    description: 'ID của Step',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID('4', { message: 'step_id phải là UUID' })
  step_id: string;
}
