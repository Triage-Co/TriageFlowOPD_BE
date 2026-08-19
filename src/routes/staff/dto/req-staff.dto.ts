import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { GenderTypeEnum, RoleTypeEnum } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

const STAFF_ROLES = [
  RoleTypeEnum.LAB_TECHNICIAN,
  RoleTypeEnum.PHARMACIST,
  RoleTypeEnum.DOCTOR,
  RoleTypeEnum.NURSE,
  RoleTypeEnum.RECEPTIONIST,
] as const;

export class CreateStaffReqDto {
  @ApiProperty({
    name: 'user_name',
    example: 'NguyenAn',
    description: 'tên người dùng',
  })
  @IsString()
  @IsNotEmpty()
  user_name: string;

  @ApiProperty({
    name: 'password',
    example: '123456',
    description: 'Mật khẩu người dùng người dùng',
  })
  @IsString()
  @Length(6)
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    name: 'full_name',
    example: 'Nguyễn Văn An',
    description: 'Họ và tên nhân viên',
  })
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @ApiProperty({
    name: 'email',
    example: 'staff@example.com',
    description: 'Email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    name: 'role',
    enum: STAFF_ROLES,
    example: RoleTypeEnum.DOCTOR,
    description: 'Vai trò',
  })
  @IsIn(STAFF_ROLES)
  role: RoleTypeEnum;

  @ApiProperty({
    name: 'gender',
    enum: GenderTypeEnum,
    example: GenderTypeEnum.MALE,
    description: 'Giới tính',
  })
  @IsEnum(GenderTypeEnum)
  gender: GenderTypeEnum;

  @ApiProperty({
    name: 'phone',
    example: '0912345678',
    description: 'Số điện thoại',
  })
  @IsString()
  phone: string;

  @ApiProperty({
    name: 'license_number',
    example: 'VN-123456',
    description: 'Số chứng chỉ hành nghề',
  })
  @IsOptional()
  @IsString()
  license_number?: string;

  @ApiProperty({
    name: 'experience_years',
    example: 5,
    description: 'Số năm kinh nghiệm',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  experience_years?: number;

  @ApiProperty({
    name: 'specialty_id',
    example: '09cdc2fd-43e9-4f5b-971b-85be83f213ad',
    description: 'Mã chuyên khoa',
  })
  @IsUUID()
  @IsOptional()
  specialty_id: string;
}

export class UpdateStaffReqDto extends PartialType(
  OmitType(CreateStaffReqDto, ['email', 'password']),
) {}

export class FindAllStaffQueryDto {
  @ApiPropertyOptional({ description: 'Trang hiện tại' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Số lượng item trên 1 trang',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Trạng thái hoạt động (true/false)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (email, tên)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: STAFF_ROLES, description: 'Vai trò' })
  @IsOptional()
  @IsIn(STAFF_ROLES)
  role?: RoleTypeEnum;
}
