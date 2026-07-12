import { ApiProperty } from '@nestjs/swagger';
import { StepStatusEnum } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class CreateParentStepReqDto {
  @IsUUID()
  @ApiProperty({
    name: 'flow_id',
    example: '',
  })
  flow_id: string;

  @IsUUID()
  @ApiProperty({
    name: 'room_id',
    example: '',
  })
  room_id: string;

  @IsEnum(StepStatusEnum)
  @ApiProperty({
    name: 'step_status',
    example: '',
  })
  step_status: string;

  @IsUUID()
  @ApiProperty({
    name: 'staff_id',
    example: '',
  })
  staff_id: string;
}
export class CreateSubStepReqDto {
  @IsUUID()
  @ApiProperty({
    name: 'parent_step_id',
    example: '',
  })
  parent_step_id: string;

  @IsUUID()
  @ApiProperty({
    name: 'room_id',
    example: '',
  })
  room_id: string;

  @IsEnum(StepStatusEnum)
  @ApiProperty({
    name: 'step_status',
    example: '',
  })
  step_status: string;

  @IsUUID()
  @ApiProperty({
    name: 'staff_id',
    example: '',
  })
  staff_id: string;
}

export class CreateDependencyReqDto {
  @IsUUID()
  @ApiProperty({
    name: 'waiting_step_id',
    description: 'ID của bước đang phải chờ (bước theo sau)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  waiting_step_id: string;

  @IsUUID()
  @ApiProperty({
    name: 'required_step_id',
    description: 'ID của bước điều kiện (bước phải hoàn thành trước)',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  required_step_id: string;
}