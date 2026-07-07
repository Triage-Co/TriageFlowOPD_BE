import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CreateFlowDto {
  @IsString()
  @ApiProperty({
    name: 'name',
    example: 'Sếp trung với sếp Duy có đẹp trai không ạ',
  })
  name: string;

  @IsUUID()
  @ApiProperty({
    name: 'userId',
    example: '3258e2eb-83fe-442b-96be-0e2b36245d89',
  })
  userId: string;
}
