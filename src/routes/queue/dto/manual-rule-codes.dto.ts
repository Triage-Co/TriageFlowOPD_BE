import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdateManualRuleCodesDto {
  @ApiProperty({
    type: [String],
    example: ['PEDIATRIC_ACUTE', 'QUICK_TASK_INTERLEAVE'],
    description:
      'Danh sách rule_code gắn tay (PATIENT_CATEGORY, QUICK_TASK, RETURNING, TRANSFER). Mảng rỗng để gỡ hết cờ.',
  })
  @IsArray({ message: 'manual_rule_codes phải là mảng' })
  @IsString({ each: true, message: 'Mỗi rule_code phải là chuỗi' })
  manual_rule_codes: string[];
}
