import { IsEmail, IsNotEmpty, IsNumber, IsPhoneNumber, IsString, Length, Max, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";


export class SignInReqDto {
    @ApiProperty({
        name: "email",
        example: "TriageFlowOPD@gmail.com"
    })
    @IsNotEmpty({ message: "Vui Lòng nhập email." })
    @IsEmail({}, { message: "Địa chỉ email không hợp lệ." })
    email: string;

    @ApiProperty({
        name: "password",
        example: "TriageFlowOPDPassword"
    })
    @IsNotEmpty({ message: "Vui Lòng nhập mật khẩu." })
    @Length(6, 30, { message: "Mật khẩu từ 6 đến 30 ký tự." })
    password: string;
}

export class SignInResDto {
    @ApiProperty()
    token: string;
    @ApiProperty()
    refreshToken: string;
}

export class SignInReqWithOtpDto {

    @ApiProperty({
        name: "email",
        example: "TriageFlowOPD@gmail.com"
    })
    @IsNotEmpty({ message: "Vui Lòng nhập email." })
    @IsEmail({}, { message: "Địa chỉ email không hợp lệ." })
    email: string;
}

export class VerifyOtpReqDto {
    @ApiProperty({
        name: "email",
        example: "TriageFlowOPD@gmail.com"
    })
    @IsNotEmpty({ message: "Vui Lòng nhập email." })
    @IsEmail({}, { message: "Địa chỉ email không hợp lệ." })
    email: string;

    @ApiProperty({
        name: "otp",
        example: "83868386"
    })
    @IsNotEmpty({ message: "Vui Lòng nhập mã OTP." })
    @Length(8, 8, { message: "OTP Phải 8 ký tự." })
    otp: string;
}

export class SignUpReqDto {
    @ApiProperty({
        name: "email",
        example: "TriageFlowOPD@gmail.com"
    })
    @IsNotEmpty({ message: "Vui Lòng nhập email." })
    @IsEmail({}, { message: "Địa chỉ email không hợp lệ." })
    email: string;

    // @IsNotEmpty({ message: "Vui Lòng nhập số điện thoại." })
    // @IsPhoneNumber("VN", { message: "Số điện thoại không hợp lệ" })
    // phone: string;

    @ApiProperty({
        name: "fullName",
        example: "Duy Trung"
    })
    @IsNotEmpty({ message: "Vui Lòng nhập họ và tên." })
    fullName: string;

    @ApiProperty({
        name: "age",
        example: 18
    })
    @IsNumber({}, { message: "Số tuổi không hợp lệ." })
    @Min(18, { message: "Tuổi phải từ 18 đến 100." })
    @Max(100, { message: "Tuổi phải từ 18 đến 100" })
    age: number;


    @ApiProperty({
        name: "password",
        example: "TriageFlowOPDPassword"
    })
    @IsNotEmpty({ message: "Vui Lòng nhập mật khẩu." })
    @Length(6, 30, { message: "Mật khẩu từ 6 đến 30 ký tự." })
    password: string;
}


export class SignUpResDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    email: string;
}

export class RefreshTokenReqDto {
    @ApiProperty({
        name: "refreshToken",
        example: "ligtf7n4wyrk"
    })
    @IsNotEmpty({ message: "Vui Lòng nhập refresh token." })
    refreshToken: string
}

export class RefreshTokenResDto extends SignInResDto { }