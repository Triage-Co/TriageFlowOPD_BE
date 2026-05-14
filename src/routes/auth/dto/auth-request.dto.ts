import { IsEmail, IsEnum, IsNotEmpty, IsNumber, IsPhoneNumber, IsString, Length, Matches, Max, Min } from "class-validator";
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


export class SignInWithCitizenIdReqDto {
    @ApiProperty({
        name: "citizen_id",
        example: "08420300728"
    })
    @IsNotEmpty({ message: "Vui Lòng nhập CMND/CCCD." })
    @Matches(/^[0-9]{9}$|^[0-9]{12}$/, { message: "Vui lòng nhập CMND/CCCD hợp lệ." }) 
    citizen_id: string;

    @ApiProperty({
        name: "password",
        example: "TriageFlowOPDPassword"
    })
    @IsNotEmpty({ message: "Vui Lòng nhập mật khẩu." })
    @Length(6, 30, { message: "Mật khẩu từ 6 đến 30 ký tự." })
    password: string;
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


    @ApiProperty({
        name: "gender",
        example: "MALE"
    })
    @IsNotEmpty({ message: "Vui Lòng nhập giới tính." })
    @IsEnum(["MALE", "FEMALE"], {
        message: "Giới tính phải là MALE hoặc FEMALE."
    })
    gender: string;


    @ApiProperty({
        name: "citizen_id",
        example: "084203000761"
    })
    @IsNotEmpty({ message: "Vui Lòng nhập CMND/CCCD." })
    @Matches(/^[0-9]{9}$|^[0-9]{12}$/, { message: "Vui lòng nhập CMND/CCCD hợp lệ." })
    citizen_id: string
}




export class RefreshTokenReqDto {
    @ApiProperty({
        name: "refreshToken",
        example: "ligtf7n4wyrk"
    })
    @IsNotEmpty({ message: "Vui Lòng nhập refresh token." })
    refreshToken: string
}

export class SignOutReqDto {
    @ApiProperty(
        {
            name: "token",
            example: "eyJhbGciOiJFUzI1NiIsImtpZCI6ImI3MDQ4MWFlLWYyZDktNGUzYy05MTIyLWM0MTc1ZmM4MWM0NyIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL290Z29ibHFnaW9kcGVybWdvbHVhLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MDExNDIzMi0xNWU3LTQ5MzktOTQ4Yi03MzY2MDUyMzYzNDQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc4NzI4NTUxLCJpYXQiOjE3Nzg2NDIxNTEsImVtYWlsIjoidGhhaW5nb2NkZzIwMDM1NTNAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJhZ2UiOjIwLCJlbWFpbCI6InRoYWluZ29jZGcyMDAzNTUzQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiJExrDGoW5nIFRow6FpIE5n4buNYyIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiODAxMTQyMzItMTVlNy00OTM5LTk0OGItNzM2NjA1MjM2MzQ0In0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3Nzg2NDIxNTF9XSwic2Vzc2lvbl9pZCI6IjY4MGJmNzE2LTBhMjktNDQyYy05NmMxLTM2MDFiMzM5ZmUyNiIsImlzX2Fub255bW91cyI6ZmFsc2V9.29l7Zeypaq36XQ9Q63SQ31qsz_ImVVZQoEkJUhG7S1zLg02NL8SMm4K-7wfA6bYvLdDg0tCrEGeLHyeAIxRUBA"
        }
    )
    @IsNotEmpty({ message: "Vui lòng nhập token." })
    @IsString({ message: "Token Phải là một chuỗi ký tự" })
    token: string;
}




