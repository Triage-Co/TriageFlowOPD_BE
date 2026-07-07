import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CreateStepDto {
  @IsUUID()
  @ApiProperty({
    name: 'flowId',
    example: '31e94b14-a3f6-4426-aa69-8ca4209ce694',
  })
  flowId: string;

  @IsString()
  @ApiProperty({
    name: 'name',
    example: 'Sếp Trung và sếp Duy Có đẹp trai không ạ',
  })
  name: string;

  @IsString()
  @ApiProperty({
    name: 'description',
    example: 'Sếp Trung và sếp Duy quá đẹp trai',
  })
  description: string;
}
