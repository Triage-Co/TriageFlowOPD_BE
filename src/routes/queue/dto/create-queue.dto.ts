import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CallPatientDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789' })
  @IsNotEmpty({ message: 'step_id không được để trống' })
  @IsUUID('4', { message: 'step_id phải là định dạng UUID' })
  step_id: string;

  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f0123456789a' })
  @IsNotEmpty({ message: 'room_id không được để trống' })
  @IsUUID('4', { message: 'room_id phải là định dạng UUID' })
  room_id: string;

  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-0123456789ab' })
  @IsNotEmpty({ message: 'staff_id không được để trống' })
  @IsUUID('4', { message: 'staff_id phải là định dạng UUID' })
  staff_id: string;
}
