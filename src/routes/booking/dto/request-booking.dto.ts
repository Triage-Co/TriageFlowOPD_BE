import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CreateBookingRequestDto {
  @IsUUID()
  @ApiProperty({
    name: 'patient_id',
    example: '4d70c7b0-5b61-4e51-923d-401d14d6c441',
  })
  patient_id: string;
  @IsUUID()
  @ApiProperty({
    name: 'slot_id',
    example: '0135e4ec-01df-41f5-8a26-428e759c7cc6',
  })
  slot_id: string;
}

export class UpdateBookingRequestDto extends PartialType(
  CreateBookingRequestDto,
) {}

export class BookingSpecialtyDto {
  @IsUUID()
  @ApiProperty({
    name: 'patient_id',
    example: '4d70c7b0-5b61-4e51-923d-401d14d6c441',
  })
  patient_id: string;

  @IsString()
  @ApiProperty({
    name: 'interview_token',
    example:
      'eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJQYXRpZW50RWR1Y2F0aW9uUmV2aXNpb25zIiwidG9rZW5QYXlsb2FkIjp7ImFnZUJ1bmRsZSI6ImFkdWx0IiwicGF0aWVudEVkdWNhdGlvblJldmlzaW9ucyI6eyJjXzQwNSI6IjUifX0sImlhdCI6MTc4MzEzNjg4NH0.s5hYGQNkK-RZvarSVkLaAL0QH7w7Czaf_PkNeGOqqWA',
  })
  interview_token: string;
}
