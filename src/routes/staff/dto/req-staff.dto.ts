import { ApiProperty } from "@nestjs/swagger";
import { GenderTypeEnum, RoleTypeEnum } from "@prisma/client";
import {
    IsEmail,
    IsEnum,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsString,
    IsUUID,
    Length,
    Min,
} from "class-validator";

const STAFF_ROLES = [
    RoleTypeEnum.ANCILLARY_STAFFS,
    RoleTypeEnum.ANCILLARY_STAFFS,
    RoleTypeEnum.DOCTOR,
    RoleTypeEnum.NURSE,
    RoleTypeEnum.RECEPTIONIST,
] as const

export class CreateStaffReqDto {
    @ApiProperty({
        name: "user_name",
        example: "NguyenAn",
        description: "tên người dùng",
    })
    @IsString()
    @IsNotEmpty()
    user_name: string;

    @ApiProperty({
        name: "password",
        example: "123456",
        description: "Mật khẩu người dùng người dùng",
    })
    @IsString()
    @Length(6)
    @IsNotEmpty()
    password: string;

    @ApiProperty({
        name: "full_name",
        example: "Nguyễn Văn An",
        description: "Họ và tên nhân viên",
    })
    @IsString()
    @IsNotEmpty()
    full_name: string;



    @ApiProperty({
        name: "email",
        example: "staff@example.com",
        description: "Email",
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        name: "role",
        enum: STAFF_ROLES,
        example: RoleTypeEnum.DOCTOR,
        description: "Vai trò",
    })
    @IsIn(STAFF_ROLES)
    role: RoleTypeEnum;

    @ApiProperty({
        name: "gender",
        enum: GenderTypeEnum,
        example: GenderTypeEnum.MALE,
        description: "Giới tính",
    })
    @IsEnum(GenderTypeEnum)
    gender: GenderTypeEnum;

    @ApiProperty({
        name: "phone",
        example: "0912345678",
        description: "Số điện thoại",
    })
    @IsString()
    phone: string;

    @ApiProperty({
        name: "license_number",
        example: "VN-123456",
        description: "Số chứng chỉ hành nghề",
    })
    @IsString()
    license_number: string;

    @ApiProperty({
        name: "experience_years",
        example: 5,
        description: "Số năm kinh nghiệm",
        minimum: 0,
    })
    @IsInt()
    @Min(0)
    experience_years: number;

    @ApiProperty({
        name: "specialty_id",
        example: "09cdc2fd-43e9-4f5b-971b-85be83f213ad",
        description: "Mã chuyên khoa",
    })
    @IsUUID()
    specialty_id: string;
}