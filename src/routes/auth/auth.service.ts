import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ForgotPasswordDto,
  RefreshTokenReqDto,
  SignInReqDto,
  SignInReqWithOtpDto,
  SignInWithCitizenIdReqDto,
  SignOutReqDto,
  SignUpReqDto,
  UpdateUserDto,
  VerifyOtpDto,
  VerifyOtpReqDto,
} from './dto/auth-request.dto';
import { SupabaseConfig } from '../../shared/config/supabase.config';
import { SupabaseClient } from '@supabase/supabase-js';
import { BaseResponse } from '../../shared/type/response.type';
import { PrismaConfig } from '../../shared/config/prisma.config';
import {
  RefreshTokenResDto,
  SignInResDto,
  SignUpResDto,
} from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  private supabaseClient: SupabaseClient;
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly prismaConfig: PrismaConfig,
  ) {
    this.supabaseClient = this.supabaseConfig.getClient();
  }

  async signIn(
    signInReqDto: SignInReqDto,
  ): Promise<BaseResponse<SignInResDto>> {
    const { data, error } = await this.supabaseClient.auth.signInWithPassword({
      email: signInReqDto.email,
      password: signInReqDto.password,
    });

    if (error) {
      throw new UnauthorizedException({
        code: 401,
        status: 'error',
        message: 'Email hoặc mật khẩu không chính xác',
        detail: error.message,
      });
    }

    return {
      code: 200,
      message: 'Đăng nhập thành công',
      status: 'success',
      data: {
        token: data.session?.access_token || '',
        refreshToken: data.session?.refresh_token || '',
      },
    };
  }

  async signInWithCitizenId(
    signInWithCitizenIdReqDto: SignInWithCitizenIdReqDto,
  ): Promise<BaseResponse<SignInResDto>> {
    try {
      const user = await this.prismaConfig.users.findUnique({
        where: {
          citizen_id: signInWithCitizenIdReqDto.citizen_id,
        },
        select: {
          email: true,
        },
      });

      if (!user) {
        throw new NotFoundException({
          code: 404,
          status: 'error',
          message: 'Không tìm thấy tài khoản với CMND/CCCD này.',
        });
      }

      const { data, error } = await this.supabaseClient.auth.signInWithPassword(
        {
          email: user.email,
          password: signInWithCitizenIdReqDto.password,
        },
      );

      if (error) {
        throw new UnauthorizedException({
          code: 401,
          status: 'error',
          message: 'Email hoặc mật khẩu không chính xác',
          detail: error.message,
        });
      }

      return {
        code: 200,
        message: 'Đăng nhập thành công',
        status: 'success',
        data: {
          token: data.session?.access_token || '',
          refreshToken: data.session?.refresh_token || '',
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        code: 500,
        status: 'error',
        message:
          'Đã có lỗi hệ thống xảy ra trong quá trình đăng nhập. Vui lòng thử lại sau.',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async sendOtp(
    signInReqWithOtpDto: SignInReqWithOtpDto,
  ): Promise<BaseResponse<any>> {
    try {
      const exitedEmail = await this.prismaConfig.users.findUnique({
        where: {
          email: signInReqWithOtpDto.email,
        },
      });

      if (!exitedEmail) {
        throw new NotFoundException({
          code: 404,
          status: 'error',
          message: 'Email không tồn tại',
        });
      }

      const { error } = await this.supabaseClient.auth.signInWithOtp({
        email: signInReqWithOtpDto.email,
      });

      if (error) {
        throw new UnauthorizedException({
          code: 401,
          status: 'error',
          message: 'Không thể gửi mã OTP. Vui lòng thử lại',
          detail: error.message,
        });
      }
      return {
        code: 200,
        message: 'Gửi OTP thành công',
        status: 'success',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        code: 500,
        status: 'error',
        message:
          'Đã có lỗi hệ thống xảy ra trong quá trình đăng ký. Vui lòng thử lại sau.',
        detail: error instanceof HttpException ? error.message : String(error),
      });
    }
  }

  async verifyOTP(
    verifyOtpReqDto: VerifyOtpReqDto,
  ): Promise<BaseResponse<SignInResDto>> {
    const { data, error } = await this.supabaseClient.auth.verifyOtp({
      email: verifyOtpReqDto.email,
      token: verifyOtpReqDto.otp,
      type: 'magiclink',
    });

    if (error) {
      throw new BadRequestException({
        code: 401,
        status: 'error',
        message: 'Mã OTP không chính xác hoặc đã hết hạn',
        detail: error.message,
      });
    }
    return {
      code: 200,
      message: 'Xác thực OTP thành công',
      status: 'success',
      data: {
        token: data.session?.access_token || '',
        refreshToken: data.session?.refresh_token || '',
      },
    };
  }

  async signUp(
    signUpReqDto: SignUpReqDto,
  ): Promise<BaseResponse<SignUpResDto>> {
    try {
      const exitedUser = await this.prismaConfig.users.findUnique({
        where: {
          citizen_id: signUpReqDto.citizen_id,
        },
      });

      const exitedEmail = await this.prismaConfig.users.findUnique({
        where: {
          email: signUpReqDto.email,
        },
      });

      if (exitedUser) {
        throw new ConflictException({
          code: 409,
          status: 'error',
          message: 'CMND/CCCD đã tồn tại trong hệ thống',
        });
      }

      if (exitedEmail) {
        throw new ConflictException({
          code: 409,
          status: 'error',
          message: 'Email đã tồn tại',
        });
      }

      const { data, error } = await this.supabaseClient.auth.signUp({
        email: signUpReqDto.email,
        password: signUpReqDto.password,
        options: {
          data: {
            full_name: signUpReqDto.fullName,
            dob: signUpReqDto.dob,
            citizen_id: signUpReqDto.citizen_id,
            gender: signUpReqDto.gender,
            role: signUpReqDto.role,
          },
        },
      });

      const dataUser = await this.prismaConfig.users.create({
        data: {
          id: data.user?.id,
          email: signUpReqDto.email,
          full_name: signUpReqDto.fullName,
          dob: signUpReqDto.dob,
          gender: signUpReqDto.gender,
          citizen_id: signUpReqDto.citizen_id,
          role: signUpReqDto.role,
        },
      });

      if (!dataUser) {
        await this.supabaseClient.auth.admin.deleteUser(data.user?.id!);

        throw error;
      }

      if (error) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Đăng ký tài khoản thất bại',
          detail: error.message,
        });
      }

      return {
        code: 201,
        status: 'success',
        message: 'Đăng ký tài khoản thành công',
        data: {
          email: data.user?.email!,
          id: data.user?.id!,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        code: 500,
        status: 'error',
        message:
          'Đã có lỗi hệ thống xảy ra trong quá trình đăng ký. Vui lòng thử lại sau.',
        detail: error instanceof HttpException ? error.message : String(error),
      });
    }
  }

  async signOut(signOutReqDto: SignOutReqDto): Promise<BaseResponse<any>> {
    const { error } = await this.supabaseClient.auth.admin.signOut(
      signOutReqDto.token,
      'local',
    );

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

  async refreshToken(
    refreshTokenReqDto: RefreshTokenReqDto,
  ): Promise<BaseResponse<RefreshTokenResDto>> {
    const { data, error } = await this.supabaseClient.auth.refreshSession({
      refresh_token: refreshTokenReqDto.refreshToken,
    });

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
      status: 'success',
      message: 'Làm mới token thành công',
      data: {
        token: data.session?.access_token!,
        refreshToken: data.session?.refresh_token!,
      },
    };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<BaseResponse<any>> {
    const exitedEmail = await this.prismaConfig.users.findUnique({
      where: {
        email: forgotPasswordDto.email,
      },
    });

    if (!exitedEmail) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Email không tồn tại',
      });
    }

    const { error } = await this.supabaseClient.auth.resetPasswordForEmail(
      forgotPasswordDto.email,
    );

    if (error) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Gửi mã otp không thành công',
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Gửi mã otp thành công',
    };
  }

  async verifyForgot(verifyOtpDto: VerifyOtpDto): Promise<BaseResponse<any>> {
    const { data, error } = await this.supabaseClient.auth.verifyOtp({
      email: verifyOtpDto.email,
      token: verifyOtpDto.otp,
      type: 'recovery',
    });

    if (error || !data.user) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Xác thực otp không thành công',
      });
    }

    const { error: updateError } =
      await this.supabaseClient.auth.admin.updateUserById(data.user.id, {
        password: verifyOtpDto.password,
      });

    if (updateError) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Thay đổi mật khẩu không thành công',
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Lấy lại mật khẩu thành công',
    };
  }

  async getProfile(id: string) {
    try {
      const data = await this.prismaConfig.users.findUnique({
        where: {
          id: id,
        },
      });
      if (!data) {
        throw new NotFoundException(`Không tìm thấy người dùng với id ${id}`);
      }
      return {
        code: 200,
        message: 'Lấy người dùng thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown Error',
        status: 'error',
      };
    }
  }

  async updateProfile(updateUserDto: UpdateUserDto, id: string) {
    try {
      const data = await this.prismaConfig.users.update({
        where: {
          id: id,
        },
        data: {
          dob: updateUserDto.dob,
          full_name: updateUserDto.fullName,
          gender: updateUserDto.gender,
        },
      });
      if (!data) {
        throw new BadRequestException('Không thể cập nhật người dùng');
      }
      const { error } = await this.supabaseClient.auth.admin.updateUserById(
        id,
        {
          user_metadata: {
            full_name: updateUserDto.fullName,
            dob: updateUserDto.dob,
            gender: updateUserDto.gender,
          },
        },
      );

      if (error) {
        throw new BadRequestException('cập nhật người dùng thất bại');
      }

      return {
        code: 200,
        message: 'Cập nhật người dùng thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
        status: 'error',
      };
    }
  }
}
