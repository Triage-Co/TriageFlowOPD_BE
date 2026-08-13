import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class CreateTriageConfigDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    description: 'Key của rule (ví dụ: DIAGNOSIS_CONFIG)',
    example: 'DIAGNOSIS_CONFIG',
  })
  rule_key?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  @ApiPropertyOptional({
    description: 'Giá trị cấu hình dạng JSON',
    example: { number_of_diagnosis: 5 },
  })
  rule_value?: any;
}

export class UpdateTriageConfigDto extends CreateTriageConfigDto { }
