import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ServiceOrderStatusEnum } from '@prisma/client';

export class CreateServiceOrderReqDto {
  @IsUUID()
  @ApiProperty({
    example: 'e7f88300-c39a-4821-b6c7-28c6daae313c',
    description: 'Booking liên kết',
  })
  booking_id: string;

  @IsUUID()
  @ApiProperty({
    example: 'e7f88300-c39a-4821-b6c7-28c6daae313c',
    description: 'Bác sĩ/Nhân viên chỉ định',
  })
  assign_by_staff_id: string;

  @IsString()
  @ApiProperty({
    example: "Xét nghiệm máu",
    description: 'Tên của Service Order',
  })
  name: string;

  @IsString()
  @ApiProperty({
    example: "XET_NGHIEM_MAU",
    description: 'Mã của Service Order',
  })
  service_code: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    example: 'e7f88300-c39a-4821-b6c7-28c6daae313c',
    description: 'Mã chuyên khoa [có thể null]',
  })
  specialty_id: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    example: 'e7f88300-c39a-4821-b6c7-28c6daae313c',
    description: 'Phòng chỉ định (nếu có)',
  })
  room_id?: string;

  @IsBoolean()
  @ApiProperty({
    description: 'Dịch vụ có cần thanh toán hay không',
    default: true,
    example: true,
  })
  is_payment: boolean;
}


export class UpdateServiceOrderReqDto extends PartialType(
  CreateServiceOrderReqDto,
) {
  @IsOptional()
  @IsEnum(ServiceOrderStatusEnum)
  @ApiPropertyOptional({
    enum: ServiceOrderStatusEnum,
    description: 'Trạng thái Service Order',
  })
  status?: ServiceOrderStatusEnum;
}

export class QueryServiceOrderReqDto {
  @ApiPropertyOptional({
    name: 'page',
    example: 1,
    description: 'Trang hiện tại',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    name: 'limit',
    example: 10,
    description: 'Số lượng bản ghi mỗi trang',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  limit?: number = 10;
}
