import { BadRequestException, ConflictException, HttpException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { RefreshTokenReqDto, RefreshTokenResDto, SignInReqDto, SignInReqWithOtpDto, SignInResDto, SignOutReqDto, SignUpReqDto, SignUpResDto, VerifyOtpReqDto } from './dto/auth.dto';
import { SupabaseConfig } from '../../shared/config/supabase.config';
import { SupabaseClient } from '@supabase/supabase-js';
import { BaseResponse } from '../../shared/type/response.type';
import { PrismaConfig } from '../../shared/config/prisma.config';

@Injectable()
export class AuthService {
  private supabaseClient: SupabaseClient;
  constructor(private readonly supabaseConfig: SupabaseConfig, private readonly prismaConfig: PrismaConfig) {
    this.supabaseClient = this.supabaseConfig.getClient();
  }

  async signIn(signInReqDto: SignInReqDto): Promise<BaseResponse<SignInResDto>> {

    const { data, error } = await this.supabaseClient.auth.signInWithPassword({
      email: signInReqDto.email,
      password: signInReqDto.password
    })

    if (error) {
      throw new UnauthorizedException({
        code: 401,
        status: "error",
        message: "Email hoặc mật khẩu không chính xác",
        detail: error.message
      });
    }

    return {
      code: 200,
      message: "Đăng nhập thành công",
      status: "success",
      data: {
        token: data.session?.access_token || "",
        refreshToken: data.session?.refresh_token || ""
      }
    }

  }

  async sendOtp(signInReqWithOtpDto: SignInReqWithOtpDto): Promise<BaseResponse<any>> {

    const { error } = await this.supabaseClient.auth.signInWithOtp({
      email: signInReqWithOtpDto.email
    });

    if (error) {
      throw new UnauthorizedException({
        code: 401,
        status: "error",
        message: "Không thể gửi mã OTP. Vui lòng thử lại",
        detail: error.message
      });
    }
    return {
      code: 200,
      message: "Gửi OTP thành công",
      status: "success",
    }
  }



  async verifyOTP(verifyOtpReqDto: VerifyOtpReqDto): Promise<BaseResponse<SignInResDto>> {
    const { data, error } = await this.supabaseClient.auth.verifyOtp({
      email: verifyOtpReqDto.email,
      token: verifyOtpReqDto.otp,
      type: "magiclink"
    });

    if (error) {
      throw new BadRequestException({
        code: 401,
        status: "error",
        message: "Mã OTP không chính xác hoặc đã hết hạn",
        detail: error.message
      });
    }
    return {
      code: 200,
      message: "Xác thực OTP thành công",
      status: "success",
      data: {
        token: data.session?.access_token || "",
        refreshToken: data.session?.refresh_token || ""
      }
    }
  }

  async signUp(signUpReqDto: SignUpReqDto): Promise<BaseResponse<SignUpResDto>> {
    try {
      const exitedUser = await this.prismaConfig.users.findUnique({
        where: {
          citizen_id: signUpReqDto.citizen_id
        }
      })

      if (exitedUser) {
        throw new ConflictException({
          code: 409,
          status: "error",
          message: "CMND/CCCD đã tồn tại trong hệ thống.",
        })
      }

      const { data, error } = await this.supabaseClient.auth.signUp({
        email: signUpReqDto.email,
        password: signUpReqDto.password,
        options: {
          data: {
            full_name: signUpReqDto.fullName,
            age: signUpReqDto.age,
            citizen_id: signUpReqDto.citizen_id,
            gender: signUpReqDto.gender
          }
        }
      })


      if (error) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Đăng ký thất bại',
          detail: error.message,
        });
      }

      return {
        code: 201,
        status: 'success',
        message: 'Đăng ký tài khoản thành công',
        data: {
          email: data.user?.email!,
          id: data.user?.id!
        }
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        code: 500,
        status: 'error',
        message: 'Đã có lỗi hệ thống xảy ra trong quá trình đăng ký. Vui lòng thử lại sau.',
        detail: error instanceof HttpException ? error.message : String(error),
      });
    }
  }

  async signOut(signOutReqDto: SignOutReqDto): Promise<BaseResponse<any>> {
    const { error } = await this.supabaseClient.auth.admin.signOut(signOutReqDto.token, "local");

    if (error) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Đăng xuất thất bại',
        detail: error.message,
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Đăng xuất thành công',
    };
  }


  async refreshToken(refreshTokenReqDto: RefreshTokenReqDto):
    Promise<BaseResponse<RefreshTokenResDto>> {

    const { data, error } = await this.supabaseClient.auth.refreshSession({
      refresh_token: refreshTokenReqDto.refreshToken
    })

    if (error) {
      throw new UnauthorizedException({
        code: 401,
        status: 'error',
        message: 'Phiên đăng nhập đã hết hạn hoặc refresh token không hợp lệ',
        detail: error.message,
      });
    }

    return {
      code: 200,
      status: "success",
      message: "Làm mới token thành công",
      data: {
        token: data.session?.access_token!,
        refreshToken: data.session?.refresh_token!
      }
    }
  }
}
