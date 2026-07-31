import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClinicalRoomType, StepTypeEnum } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class TemplateStepDto {
  @IsString()
  @ApiProperty({
    example: 'step_1',
  })
  template_id?: string;

  @IsString()
  @ApiProperty({
    example: 'KHAM_CHUYEN_KHOA',
  })
  service_code: string;

  @IsString()
  @ApiProperty({
    example: 'Khám chuyên khoa Cơ Xương Khớp',
    description: 'Tên của bước khám',
  })
  step_name: string;

  @IsEnum(StepTypeEnum)
  @ApiProperty({
    enum: StepTypeEnum,
    example: StepTypeEnum.PAYMENT,
  })
  step_type?: StepTypeEnum;

  @IsEnum(ClinicalRoomType)
  @ApiProperty({
    enum: ClinicalRoomType,
    example: ClinicalRoomType.CLINICAL_ROOM,
    description: 'Loại phòng khám',
  })
  room_type: ClinicalRoomType;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    example: false,
    description: 'Có yêu cầu thanh toán ở bước này không?',
  })
  requires_payment?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ApiPropertyOptional({
    example: ['step_1'],
    description:
      'Mảng chứa ID của các bước cần hoàn thành trước khi tới bước này',
  })
  depends_on?: string[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TemplateStepDto)
  @ApiPropertyOptional({
    type: [TemplateStepDto],
    description:
      'Danh sách các bước con. Cần hoàn thành hết để bước cha được đánh dấu hoàn thành.',
  })
  sub_steps?: TemplateStepDto[];
}

export class CreateTemplateDto {
  @IsString()
  @ApiProperty({
    name: 'name',
    example: 'Xương khớp',
  })
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateStepDto)
  @ApiProperty({
    type: [TemplateStepDto],
    description: 'Danh sách các bước trong quy trình',
  })
  steps: TemplateStepDto[];
}

export class AssignTemplateRequestDto {
  @ApiProperty({
    type: [TemplateStepDto],
    description: 'Danh sách các template steps',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateStepDto)
  templates: TemplateStepDto[];
}
