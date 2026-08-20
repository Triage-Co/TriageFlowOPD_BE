import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateQuestionLimitDto {
  @ApiProperty({
    description: 'Số câu hỏi tối đa trong một phiên triage',
    example: 5,
    minimum: 1,
    maximum: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  number_of_diagnosis: number;
}
