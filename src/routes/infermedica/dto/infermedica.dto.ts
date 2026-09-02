import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class EvidenceDto {
  @IsString({ message: 'id phải là một chuỗi ký tự' })
  @ApiProperty({
    name: 'id',
    example: 's_3056',
  })
  id: string;

  @IsString({ message: 'choice_id phải là một chuỗi ký tự' })
  @ApiProperty({
    name: 'choice_id',
    example: 'present',
  })
  choice_id: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'name',
    example: 'Diagnosed diabetes',
    required: false,
  })
  name?: string;
}

export class ParseDto {
  @IsString({ message: 'question phải là một chuỗi ký tự' })
  @ApiProperty({
    name: 'question',
    example: 'Tôi bị đau bụng nhưng không sốt',
  })
  question: string;

  @IsNumber({}, { message: 'age phải dạng số' })
  @ApiProperty({
    name: 'age',
    example: 30,
  })
  age: number;

  @IsOptional()
  @IsString()
  @ApiProperty({
    name: 'sex',
    example: 'male',
    required: false,
  })
  sex?: string;
}

export class TriageDto {
  @IsString({ message: 'sex phải là một chuỗi ký tự' })
  @ApiProperty({
    name: 'sex',
    example: 'male',
  })
  sex: string;

  @IsNumber({}, { message: 'age phải dạng số' })
  @ApiProperty({
    name: 'age',
    example: 30,
  })
  @Type(() => Number)
  age: number;

  @IsOptional()
  @ApiProperty({
    name: 'evidence',
    example: [
      {
        id: 's_3055',
        choice_id: 'present',
      },
      {
        id: 's_3056',
        choice_id: 'present',
      },
    ],
  })
  @ValidateNested({ each: true })
  @Type(() => EvidenceDto)
  evidence: EvidenceDto[];
}

export class SearchDto {
  @IsNumber()
  @ApiProperty({
    name: 'age',
    example: 30,
  })
  @Type(() => Number)
  age: number;

  @IsString({ message: 'phrase phải là một chuỗi ký tự' })
  @ApiProperty({
    name: 'phrase',
    example: 'male',
  })
  phrase: string;
}
