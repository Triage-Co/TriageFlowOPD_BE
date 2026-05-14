import { IsEmail, IsEnum, IsNotEmpty, IsNumber, IsPhoneNumber, IsString, Length, Matches, Max, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SignInResDto {
    @ApiProperty()
    token: string;
    @ApiProperty()
    refreshToken: string;
}

export class SignUpResDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    email: string;
}

export class RefreshTokenResDto extends SignInResDto { }
