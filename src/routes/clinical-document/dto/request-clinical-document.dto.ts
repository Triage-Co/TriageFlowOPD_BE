import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ClinicalDocumentTypeEnum } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateClinicalDocumentReqDto {
  @IsUUID()
  @ApiProperty({
    description: 'ID của phiên khám bệnh liên kết',
    example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  })
  visit_session_id: string;

  @IsEnum(ClinicalDocumentTypeEnum)
  @ApiProperty({
    description: 'Loại tài liệu lâm sàng',
    enum: ClinicalDocumentTypeEnum,
    example: 'PRESCRIPTION',
  })
  document_type: ClinicalDocumentTypeEnum;

  @IsNotEmpty()
  @ApiProperty({
    description: 'Dữ liệu chi tiết dạng JSON của tài liệu',
    example: { medicines: [{ name: 'Paracetamol', dosage: '500mg' }] },
  })
  payload_data: any;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'ID tham chiếu từ HIS (nếu có)',
    required: false,
    example: 'HIS-12345',
  })
  his_reference_id?: string;
}

export class UpdateClinicalDocumentReqDto extends PartialType(CreateClinicalDocumentReqDto) {}
