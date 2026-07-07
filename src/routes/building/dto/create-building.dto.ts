import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Min } from 'class-validator';

export class CreateBuildingDto {
  @IsString()
  @ApiProperty({
    name: 'name',
    example: 'Tòa nhà A',
    description: 'Tên của tòa nhà',
  })
  name: string;

  @IsString()
  @ApiProperty({
    name: 'addressLabel',
    example: 'Cổng chính - Số 1, Đường 2',
    description: 'Địa chỉ hiển thị của tòa nhà',
  })
  addressLabel: string;

  @IsInt()
  @Min(1)
  @ApiProperty({
    name: 'totalFloors',
    example: 5,
    description: 'Tổng số tầng của tòa nhà',
  })
  totalFloors: number;

  @IsUUID()
  @ApiProperty({
    name: 'organizationId',
    example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0',
    description: 'ID của tổ chức sở hữu tòa nhà',
  })
  organizationId: string;
}
