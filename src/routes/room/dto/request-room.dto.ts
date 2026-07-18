import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ClinicalRoomType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRoomRequestDto {
  @IsString()
  @ApiProperty({
    name: 'room_name',
    example: 'P_1',
  })
  room_name: string;

  @IsEnum(ClinicalRoomType)
  @ApiProperty({
    example: ClinicalRoomType.CONSULTATION,
    enum: ClinicalRoomType,
  })
  room_type: string;

  @IsUUID()
  @IsOptional()
  @ApiPropertyOptional({
    example: '082650f9-be60-48c3-8039-f6d48ad11144',
  })
  physical_room_id?: string;

  @IsUUID()
  @IsOptional()
  @ApiPropertyOptional({
    name: 'specialty_id',
    example: '082650f9-be60-48c3-8039-f6d48ad11144',
  })
  specialty_id?: string;
}

export class UpdateRoomRequestDto extends PartialType(CreateRoomRequestDto) {}
