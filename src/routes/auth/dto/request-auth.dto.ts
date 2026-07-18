import { Optional } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { GenderTypeEnum } from '@prisma/client';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';

export class CreateAuthDto {}

export class SignUpReqDto {
  @IsString()
  @ApiProperty({
    name: 'user_name',
    example: 'DuongMinh',
  })
  user_name: string;

  @IsEmail()
  @ApiProperty({
    name: 'email',
    example: 'thaingocdg2003@gmail.com',
  })
  email: string;

  @IsString()
  @ApiProperty({
    name: 'password',
    example: 'TriageFlowOpd',
  })
  password: string;

  @IsEnum(GenderTypeEnum)
  @ApiProperty({
    name: 'gender',
    example: 'MALE',
  })
  gender: GenderTypeEnum;

  @Matches(/^(03|05|07|08|09|01[2689])[0-9]{8}$/, {
    message: 'Vui lòng nhập số điện thoại hợp lệ',
  })
  @ApiProperty({
    name: 'phone',
    example: '0947900432',
  })
  @Optional()
  phone?: string;
}

export class SignInWithEmailRequestDto {
  @IsEmail()
  @ApiProperty({
    name: 'email',
    example: 'thaingocdg2003@gmail.com',
  })
  email: string;

  @IsString()
  @ApiProperty({
    name: 'password',
    example: 'TriageFlowOpd',
  })
  password: string;
}

export class SignInWithCitizenIdRequestDto {
  @IsString()
  @ApiProperty({
    name: 'citizen_id',
    example: '08420300798',
  })
  @Matches(/^[0-9]{9}$|^[0-9]{12}$/, {
    message: 'Vui lòng nhập CMND/CCCD hợp lệ.',
  })
  citizen_id: string;

}

export class SignInWithOtpRequestDto {
  @IsEmail()
  @ApiProperty({
    name: 'email',
    example: 'thaingocdg2003@gmail.com',
  })
  email: string;
}

export class VerifyOtpSignInRequestDto {
  @IsEmail()
  @ApiProperty({
    name: 'email',
    example: 'thaingocdg2003@gmail.com',
  })
  email: string;

  @IsString()
  @ApiProperty({
    name: 'otp',
    example: '12345678',
  })
  otp: string;
}

export class ForgotPasswordRequestDto {
  @IsEmail()
  @ApiProperty({
    name: 'email',
    example: 'thaingocdg2003@gmail.com',
  })
  email: string;
}

export class VerifyAndResetPasswordRequestDto {
  @IsEmail()
  @ApiProperty({
    name: 'email',
    example: 'thaingocdg2003@gmail.com',
  })
  email: string;

  @IsString()
  @ApiProperty({
    name: 'otp',
    example: '12345678',
  })
  otp: string;

  @IsString()
  @ApiProperty({
    name: 'new_password',
    example: 'Triageflow',
  })
  new_password: string;
}

export class RefreshTokenRequestDto {
  @ApiProperty({
    name: 'refreshToken',
    example: 'ligtf7n4wyrk',
  })
  @IsNotEmpty({ message: 'Vui Lòng nhập refresh token.' })
  refreshToken: string;
}

export class SignOutReqRequestDto {
  @ApiProperty({
    name: 'token',
    example:
      'eyJhbGciOiJFUzI1NiIsImtpZCI6ImI3MDQ4MWFlLWYyZDktNGUzYy05MTIyLWM0MTc1ZmM4MWM0NyIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL290Z29ibHFnaW9kcGVybWdvbHVhLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MDExNDIzMi0xNWU3LTQ5MzktOTQ4Yi03MzY2MDUyMzYzNDQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc4NzI4NTUxLCJpYXQiOjE3Nzg2NDIxNTEsImVtYWlsIjoidGhhaW5nb2NkZzIwMDM1NTNAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJhZ2UiOjIwLCJlbWFpbCI6InRoYWluZ29jZGcyMDAzNTUzQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiJExrDGoW5nIFRow6FpIE5n4buNYyIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiODAxMTQyMzItMTVlNy00OTM5LTk0OGItNzM2NjA1MjM2MzQ0In0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3Nzg2NDIxNTF9XSwic2Vzc2lvbl9pZCI6IjY4MGJmNzE2LTBhMjktNDQyYy05NmMxLTM2MDFiMzM5ZmUyNiIsImlzX2Fub255bW91cyI6ZmFsc2V9.29l7Zeypaq36XQ9Q63SQ31qsz_ImVVZQoEkJUhG7S1zLg02NL8SMm4K-7wfA6bYvLdDg0tCrEGeLHyeAIxRUBA',
  })
  @IsNotEmpty({ message: 'Vui lòng nhập token.' })
  @IsString({ message: 'Token Phải là một chuỗi ký tự' })
  token: string;
}

export class UpdateUserRequestDto {
  @IsString()
  @ApiProperty({
    name: 'user_name',
    example: 'Dương Minh',
  })
  user_name: string;

  @IsEnum(GenderTypeEnum)
  @ApiProperty({
    name: 'gender',
    example: 'MALE',
  })
  gender: GenderTypeEnum;

  @Matches(/^(03|05|07|08|09|01[2689])[0-9]{8}$/, {
    message: 'Vui lòng nhập số điện thoại hợp lệ',
  })
  @ApiProperty({
    name: 'phone',
    example: '0947900432',
  })
  @Optional()
  phone?: string;

  @IsUrl()
  @ApiProperty({
    name: 'avatar',
    example:
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQeRmIK-W5sIz_tViBzl03LTCe8HJuLk79fzIWmYmxJEQ&s=10',
  })
  @Optional()
  avatar?: string;
}
