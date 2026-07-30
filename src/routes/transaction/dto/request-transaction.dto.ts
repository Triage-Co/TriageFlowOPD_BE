import { ApiProperty } from '@nestjs/swagger';
import { TransTypeEnum } from '@prisma/client';
import { IsEnum, IsNumber, IsString, IsUrl, Min } from 'class-validator';

export class CreateTransactionRequestDto {
  @IsEnum(TransTypeEnum, {
    message: 'Transaction type không hợp lệ',
  })
  @ApiProperty({
    name: 'transType',
    enum: TransTypeEnum,
    example: 'APPOINTMENT_PAYMENT',
  })
  transType: TransTypeEnum;

  @IsNumber({}, { message: 'Ammount phải là 1 số' })
  @Min(1000, { message: 'Ammount phải lớn hơn 1000' })
  @ApiProperty({
    name: 'amount',
    example: 2000,
  })
  amount: number;

  @IsString()
  @ApiProperty({
    name: 'clientId',
    example: '75a51e00-b2e7-447a-b39e-7c00a09cf15c',
  })
  clientId: string;

  @IsUrl({}, { message: 'Return url phải là 1 url hợp lệ' })
  @ApiProperty({
    name: 'returnUrl',
    example: 'https://www.youtube.com/shorts/8Y9-C4UYE_g',
  })
  returnUrl: string;

  @IsUrl({}, { message: 'Cancel url url phải là 1 url hợp lệ' })
  @ApiProperty({
    name: 'cancelUrl',
    example: 'https://www.youtube.com/watch?v=TQM8bUHOEuE',
  })
  cancelUrl: string;

  @IsString()
  @ApiProperty({
    name: 'service_order_id',
    example: '97f0a82e-9d22-48ea-8b4e-9f37c35a8bc5',
    required: false,
  })
  service_order_id?: string;
}
