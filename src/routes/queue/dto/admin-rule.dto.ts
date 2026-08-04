import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ClinicalRoomType,
  QueueRuleTypeEnum,
  StepTypeEnum,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreatePriorityRuleDto {
  @ApiProperty({
    example: 'PEDIATRIC_CUSTOM',
    description: 'Mã định danh duy nhất của rule (in hoa, số, gạch dưới)',
  })
  @IsNotEmpty({ message: 'rule_code không được để trống' })
  @IsString({ message: 'rule_code phải là chuỗi' })
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'rule_code chỉ chứa chữ in hoa, số và dấu gạch dưới',
  })
  rule_code: string;

  @ApiProperty({ example: 'Ưu tiên trẻ em dưới 6 tuổi' })
  @IsNotEmpty({ message: 'name không được để trống' })
  @IsString({ message: 'name phải là chuỗi' })
  name: string;

  @ApiPropertyOptional({ example: 'Cộng thêm 5 điểm cho bệnh nhân nhi' })
  @IsOptional()
  @IsString({ message: 'description phải là chuỗi' })
  description?: string;

  @ApiProperty({ enum: QueueRuleTypeEnum, example: QueueRuleTypeEnum.PATIENT_CATEGORY })
  @IsNotEmpty({ message: 'rule_type không được để trống' })
  @IsEnum(QueueRuleTypeEnum, { message: 'rule_type không hợp lệ' })
  rule_type: QueueRuleTypeEnum;

  @ApiPropertyOptional({ example: 5, description: 'Trọng số ưu tiên (-100 đến 100)' })
  @IsOptional()
  @IsInt({ message: 'weight phải là số nguyên' })
  @Min(-100, { message: 'weight tối thiểu là -100' })
  @Max(100, { message: 'weight tối đa là 100' })
  weight?: number;

  @ApiPropertyOptional({ example: 0.5, description: 'Điểm tăng mỗi phút chờ (0 đến 10)' })
  @IsOptional()
  @Min(0, { message: 'aging_rate tối thiểu là 0' })
  @Max(10, { message: 'aging_rate tối đa là 10' })
  aging_rate?: number;

  @ApiPropertyOptional({ example: 15, description: 'Giới hạn điểm aging tối đa (0 = không giới hạn)' })
  @IsOptional()
  @Min(0, { message: 'max_aging tối thiểu là 0' })
  @Max(100, { message: 'max_aging tối đa là 100' })
  max_aging?: number;

  @ApiPropertyOptional({
    example: { age: { lt: 6 } },
    description: 'Điều kiện áp dụng rule',
  })
  @IsOptional()
  @IsObject({ message: 'conditions phải là object' })
  conditions?: Record<string, any>;

  @ApiPropertyOptional({
    example: { hold_positions: 3 },
    description: 'Tham số bổ sung cho rule (ví dụ MISSED_TURN, REBALANCE)',
  })
  @IsOptional()
  @IsObject({ message: 'params phải là object' })
  params?: Record<string, any>;

  @ApiPropertyOptional({ enum: ClinicalRoomType, example: ClinicalRoomType.CLINICAL_ROOM })
  @IsOptional()
  @IsEnum(ClinicalRoomType, { message: 'room_type không hợp lệ' })
  room_type?: ClinicalRoomType;

  @ApiPropertyOptional({ example: '45a24967-567e-4b67-a0dc-0d73f2052a06' })
  @IsOptional()
  @IsUUID('4', { message: 'specialty_id phải là định dạng UUID' })
  specialty_id?: string;
}

export class UpdatePriorityRuleDto {
  @ApiPropertyOptional({ example: 'Ưu tiên trẻ em dưới 6 tuổi' })
  @IsOptional()
  @IsString({ message: 'name phải là chuỗi' })
  name?: string;

  @ApiPropertyOptional({ example: 'Cập nhật mô tả' })
  @IsOptional()
  @IsString({ message: 'description phải là chuỗi' })
  description?: string;

  @ApiPropertyOptional({ enum: QueueRuleTypeEnum })
  @IsOptional()
  @IsEnum(QueueRuleTypeEnum, { message: 'rule_type không hợp lệ' })
  rule_type?: QueueRuleTypeEnum;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt({ message: 'weight phải là số nguyên' })
  @Min(-100, { message: 'weight tối thiểu là -100' })
  @Max(100, { message: 'weight tối đa là 100' })
  weight?: number;

  @ApiPropertyOptional({ example: 0.5 })
  @IsOptional()
  @Min(0, { message: 'aging_rate tối thiểu là 0' })
  @Max(10, { message: 'aging_rate tối đa là 10' })
  aging_rate?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @Min(0, { message: 'max_aging tối thiểu là 0' })
  @Max(100, { message: 'max_aging tối đa là 100' })
  max_aging?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject({ message: 'conditions phải là object' })
  conditions?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject({ message: 'params phải là object' })
  params?: Record<string, any>;

  @ApiPropertyOptional({ enum: ClinicalRoomType })
  @IsOptional()
  @IsEnum(ClinicalRoomType, { message: 'room_type không hợp lệ' })
  room_type?: ClinicalRoomType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4', { message: 'specialty_id phải là định dạng UUID' })
  specialty_id?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'is_active phải là boolean' })
  is_active?: boolean;
}

export class QueryPriorityRuleDto {
  @ApiPropertyOptional({ enum: QueueRuleTypeEnum })
  @IsOptional()
  @IsEnum(QueueRuleTypeEnum)
  rule_type?: QueueRuleTypeEnum;

  @ApiPropertyOptional({ example: 'true' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ enum: ClinicalRoomType })
  @IsOptional()
  @IsEnum(ClinicalRoomType)
  room_type?: ClinicalRoomType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  specialty_id?: string;
}

export class CreateRoomServiceDto {
  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f0123456789a' })
  @IsNotEmpty({ message: 'room_id không được để trống' })
  @IsUUID('4', { message: 'room_id phải là định dạng UUID' })
  room_id: string;

  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-0123456789ab' })
  @IsNotEmpty({ message: 'service_id không được để trống' })
  @IsUUID('4', { message: 'service_id phải là định dạng UUID' })
  service_id: string;
}

export class UpdateRoomServiceDto {
  @ApiProperty({ example: true })
  @IsNotEmpty({ message: 'is_active không được để trống' })
  @IsBoolean({ message: 'is_active phải là boolean' })
  is_active: boolean;
}
