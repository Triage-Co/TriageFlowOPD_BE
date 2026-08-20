import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBookingRequestDto {
  @IsUUID('all', { message: 'ID bệnh nhân phải là một UUID hợp lệ' })
  @ApiProperty({
    name: 'patient_id',
    example: '4d70c7b0-5b61-4e51-923d-401d14d6c441',
  })
  patient_id: string;
  @IsUUID('all', { message: 'ID slot khám phải là một UUID hợp lệ' })
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
  @IsUUID('all', { message: 'ID bệnh nhân phải là một UUID hợp lệ' })
  @ApiProperty({
    name: 'patient_id',
    example: '4d70c7b0-5b61-4e51-923d-401d14d6c441',
  })
  patient_id: string;

  @IsString({ message: 'Token phỏng vấn phải là một chuỗi ký tự hợp lệ' })
  @ApiProperty({
    name: 'interview_token',
    example:
      'eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJQYXRpZW50RWR1Y2F0aW9uUmV2aXNpb25zIiwidG9rZW5QYXlsb2FkIjp7ImFnZUJ1bmRsZSI6ImFkdWx0IiwicGF0aWVudEVkdWNhdGlvblJldmlzaW9ucyI6eyJjXzQwNSI6IjUifX0sImlhdCI6MTc4MzEzNjg4NH0.s5hYGQNkK-RZvarSVkLaAL0QH7w7Czaf_PkNeGOqqWA',
  })
  interview_token: string;
}

/**
 * DTO dùng khi bệnh nhân chọn gói khám (Exam_Package) và đặt lịch.
 * Flow sẽ được tạo tự động sau khi thanh toán gói xong.
 */
export class CreateBookingWithPackageDto {
  @IsUUID('all', { message: 'ID bệnh nhân phải là một UUID hợp lệ' })
  @ApiProperty({
    name: 'patient_id',
    example: '4d70c7b0-5b61-4e51-923d-401d14d6c441',
    description: 'ID của bệnh nhân',
  })
  patient_id: string;

  @IsUUID('all', { message: 'ID slot khám phải là một UUID hợp lệ' })
  @ApiProperty({
    name: 'slot_id',
    example: '0135e4ec-01df-41f5-8a26-428e759c7cc6',
    description: 'ID slot khám',
  })
  slot_id: string;

  @IsUUID('all', { message: 'ID gói khám phải là một UUID hợp lệ' })
  @ApiProperty({
    name: 'package_id',
    example: '0135e4ec-01df-41f5-8a26-428e759c7cc6',
    description: 'ID của Exam_Package (gói khám).',
  })
  package_id: string;

  @IsString({
    message: 'URL chuyển hướng (return_url) phải là một chuỗi ký tự hợp lệ',
  })
  @IsOptional()
  @ApiPropertyOptional({
    name: 'return_url',
    example: 'https://triageflow.me/payment/success',
    description: 'URL chuyển hướng sau khi thanh toán thành công (PayOS)',
  })
  return_url?: string;

  @IsString({
    message: 'URL chuyển hướng (cancel_url) phải là một chuỗi ký tự hợp lệ',
  })
  @IsOptional()
  @ApiPropertyOptional({
    name: 'cancel_url',
    example: 'https://triageflow.me/payment/cancel',
    description: 'URL chuyển hướng khi hủy thanh toán (PayOS)',
  })
  cancel_url?: string;
}
