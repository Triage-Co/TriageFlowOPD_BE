import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsObject } from 'class-validator';

export class InfermedicaCreateTriageConfigDto {
  @IsString()
  @ApiPropertyOptional({
    description: 'Key của rule (ví dụ: DIAGNOSIS_CONFIG)',
    example: 'DIAGNOSIS_CONFIG',
  })
  rule_key: string;

  @IsObject()
  @ApiPropertyOptional({
    description: 'Giá trị cấu hình dạng JSON',
    example: { number_of_diagnosis: 5 },
  })
  rule_value: any;
}

export class InfermedicaUpdateTriageConfigDto extends InfermedicaCreateTriageConfigDto {}
