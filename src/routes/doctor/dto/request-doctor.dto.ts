import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsUUID } from 'class-validator';

export class CreateDoctorDto {
  @IsUUID()
  @ApiProperty({
    name: 'userId',
    example: '0ed5e33a-c999-4eb4-ab50-b4f1800b37fd',
  })
  userId: string;
  @IsNumber()
  @ApiProperty({
    name: 'specialtyId',
    example: '1',
  })
  specialtyId: number;
  @IsString()
  @ApiProperty({
    name: 'practiceCertificateNumber',
    example: '000001/CT - GPHN',
  })
  practiceCertificateNumber: string;
}
