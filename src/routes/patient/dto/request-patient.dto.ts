import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { GenderTypeEnum } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreatePatientReqDto {
  @IsString()
  @IsOptional()
  @ApiProperty({
    name: 'medical_coverage_id',
    example: 'DN4791234567890',
    description: 'Số bảo hiểm y tế có thể có hoặc không',
  })
  medical_coverage_id?: string;

  @IsDate()
  @Type(() => Date)
  @ApiProperty({
    name: 'dob',
    example: '2003-03-07',
  })
  dob: Date;

  @IsEnum(GenderTypeEnum)
  @ApiProperty({
    name: 'gender',
    example: 'MALE',
  })
  gender: GenderTypeEnum;

  @IsString()
  @ApiProperty({
    name: 'full_name',
    example: 'Dương Minh',
  })
  full_name: string;

  @IsString()
  @ApiProperty({
    name: 'citizen_id',
    example: '084203000798',
  })
  @Matches(/^[0-9]{9}$|^[0-9]{12}$/, {
    message: 'Vui lòng nhập CMND/CCCD hợp lệ.',
  })
  citizen_id: string;
}

export class UpdatePatientReqDto extends PartialType(
  OmitType(CreatePatientReqDto, ['citizen_id', 'medical_coverage_id']),
) {}
