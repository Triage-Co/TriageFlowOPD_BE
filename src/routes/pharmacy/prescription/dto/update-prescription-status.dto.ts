import { ApiProperty } from '@nestjs/swagger';
import { PrescriptionStatusEnum } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdatePrescriptionStatusDto {
  @ApiProperty({
    enum: PrescriptionStatusEnum,
    description: 'Trạng thái mới của đơn thuốc',
    example: PrescriptionStatusEnum.PROCESSING,
  })
  @IsEnum(PrescriptionStatusEnum)
  @IsNotEmpty()
  status: PrescriptionStatusEnum;
}
