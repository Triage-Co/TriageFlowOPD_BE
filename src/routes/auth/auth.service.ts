import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ForgotPasswordRequestDto,
  RefreshTokenRequestDto,
  SignInWithCitizenIdRequestDto,
  SignInWithEmailRequestDto,
  SignInWithOtpRequestDto,
  SignOutReqRequestDto,
  SignUpReqDto,
  UpdateUserRequestDto,
  VerifyAndResetPasswordRequestDto,
  VerifyOtpSignInRequestDto,
} from './dto/request-auth.dto';
import type { IAccountRepository } from '../../shared/interfaces/i-account.repository';
import {
  OtpType,
  SignOutType,
} from '../../shared/interfaces/i-auth-provider.interface';
import type { IAuthProvider } from '../../shared/interfaces/i-auth-provider.interface';
import type { IPatientRepository } from '../../shared/interfaces/i-patient.repository';
import type { IStaffRepository } from '../../shared/interfaces/i-staff.repository';
import { AuthErrors } from '../../shared/exceptions/auth.exceptions';
import { JwtService } from '@nestjs/jwt';
import { Patient } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    @Inject('IAccountRepository')
    private readonly accountRepository: IAccountRepository,
    @Inject('IAuthProvider') private readonly authProvider: IAuthProvider,
    @Inject('IPatientRepository')
    private readonly patientRepository: IPatientRepository,
    @Inject('IStaffRepository')
    private readonly staffRepository: IStaffRepository,
    private readonly jwtService: JwtService,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  async signUp(signUpRequestDto: SignUpReqDto) {
    const { user_name, gender, email, password, phone } = signUpRequestDto;
    const { data, error } = await this.authProvider.signUp(email, password, {
      user_name,
      gender,
      role: 'USER',
      phone,
    });

    if (error) {
      switch (error.code) {
        case 'email_not_confirmed': {
          throw AuthErrors.EmailNotConfirmed;
        }
        case 'user_banned': {
          throw AuthErrors.UserBanned;
        }
        default: {
          throw AuthErrors.ProviderError(
            'Không thể đăng ký tài khoản',
            error.message,
          );
        }
      }
    }

    if (!data?.user?.id) {
      throw AuthErrors.ProviderError(
        'Lỗi hệ thống',
        'Không lấy được ID người dùng từ hệ thống xác thực',
      );
    }

    const account_id = data.user.id;
    let isLocalAccountCreated = false;

    try {
      const newAccount = await this.accountRepository.create({
        account_id: account_id,
        email: email,
        user_name: user_name,
        gender: gender,
        phone: phone,
        role: 'USER',
      });

      isLocalAccountCreated = true;

      return {
        code: 200,
        status: 'success',
        message: 'Đăng ký user thành công',
        data: newAccount,
      };
    } catch (error) {
      this.logger.error(
        `Lỗi khi tạo user với email: ${email}, đang rollback`,
        error,
      );

      if (isLocalAccountCreated) {
        try {
          await this.accountRepository.delete(account_id);
        } catch (error) {
          this.logger.error(
            `Không thể xóa người dùng với id: ${account_id}`,
            error,
          );
        }
      }

      try {
        await this.authProvider.deleteAccount(account_id);
      } catch (error) {
        this.logger.error(
          `Không thể xóa tài khoản supabase với id: ${account_id}`,
          error,
        );
      }

      throw error;
    }
  }

  async signInWithEmail(signInWithEmailRequestDto: SignInWithEmailRequestDto) {
    const { email, password } = signInWithEmailRequestDto;

    const { data, error } = await this.authProvider.signInWithPassword(
      email,
      password,
    );

    if (error) {
      switch (error.code) {
        case 'email_not_confirmed':
          throw AuthErrors.EmailNotConfirmed;

        case 'invalid_credentials':
          throw AuthErrors.InvalidCredentials;

        case 'user_banned':
          throw AuthErrors.UserBanned;

        default:
          throw AuthErrors.ProviderError(
            'Đăng nhập không thành công',
            `Đăng nhập không thành công: {${error.code}}`,
          );
      }
    }

    if (!data?.session || !data?.user) {
      throw AuthErrors.ProviderError(
        'Lỗi hệ thống',
        'Không lấy được phiên đăng nhập từ máy chủ xác thực',
      );
    }

    return {
      code: 200,
      status: 'success',
      message: 'đăng nhập thành công',
      data: {
        token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        id: data.user.id,
        ...data.user.user_metadata,
      },
    };
  }

  async SignInWithCitizenId(
    signInWithCitizenIdRequestDto: SignInWithCitizenIdRequestDto,
  ) {
    const existedPatient: Patient =
      await this.patientRepository.findByCitizenId(
        signInWithCitizenIdRequestDto.citizen_id,
      );
    if (!existedPatient) {
      throw AuthErrors.PatientNotFoundByCitizenId(
        signInWithCitizenIdRequestDto.citizen_id,
      );
    }

    const payload = {
      sub: existedPatient.patient_id,
      id: existedPatient.patient_id,
      patient: existedPatient,
    };
    const token = await this.jwtService.signAsync(payload);

    return {
      code: 200,
      status: 'success',
      message: 'Đăng nhập thành công',
      data: {
        token: token,
        patient_id: existedPatient.patient_id,
        citizen_id: existedPatient.citizen_id,
      },
    };
  }

  async signInWithOtp(signInWithOtpRequestDto: SignInWithOtpRequestDto) {
    const { email } = signInWithOtpRequestDto;

    this.authProvider.signInWithOtp(email).catch((error) => {
      this.logger.error(`Gửi OTP thất bại cho email: ${email}`, error.message);
    });

    return {
      code: 200,
      status: 'success',
      message: 'gửi OTP thành công',
    };
  }

  async verifyOtpSignIn(verifyOtpSignInRequestDto: VerifyOtpSignInRequestDto) {
    const { email, otp } = verifyOtpSignInRequestDto;

    const { data, error } = await this.authProvider.verifyOtp(
      email,
      otp,
      OtpType.MAGIC_LINK,
    );

    if (error) {
      throw AuthErrors.VerifyOtpFailed(error.message);
    }

    if (!data?.session || !data?.user) {
      throw AuthErrors.ProviderError(
        'Lỗi hệ thống',
        'Không lấy được phiên đăng nhập sau khi xác thực OTP',
      );
    }

    return {
      code: 200,
      status: 'success',
      message: 'xác thực thành công',
      data: {
        access_token: data?.session?.access_token,
        refresh_token: data?.session?.refresh_token,
        ...data.user?.user_metadata,
      },
    };
  }

  async forgotPassword(forgotPasswordRequestDto: ForgotPasswordRequestDto) {
    const { email } = forgotPasswordRequestDto;

    this.authProvider.resetPasswordForEmail(email).catch((error) => {
      this.logger.error(`Gửi OTP thất bại cho email: ${email}`, error.message);
    });

    return {
      code: 200,
      message: 'Gửi OTP thành công',
      status: 'success',
    };
  }

  async verifyAndResetPassword(
    verifyAndResetPasswordRequestDto: VerifyAndResetPasswordRequestDto,
  ) {
    const { email, otp, new_password } = verifyAndResetPasswordRequestDto;

    const { data, error } = await this.authProvider.verifyOtp(
      email,
      otp,
      OtpType.RECOVERY,
    );

    if (error) {
      throw AuthErrors.VerifyOtpFailed(error.message);
    }

    if (!data?.user?.id) {
      throw AuthErrors.ProviderError(
        'Lỗi hệ thống',
        'Không lấy được thông tin người dùng sau khi xác thực',
      );
    }

    const account_id = data.user.id;

    const { data: updateUserData, error: updateUserError } =
      await this.authProvider.updatePasswordUserById(account_id, new_password);

    if (updateUserError) {
      throw AuthErrors.ResetPasswordFailed(updateUserError.message);
    }

    return {
      code: 200,
      message: 'Cập nhật mật khẩu thành công',
      status: 'success',
      data: updateUserData,
    };
  }

  async refreshToken(refreshTokenRequestDto: RefreshTokenRequestDto) {
    const { refreshToken } = refreshTokenRequestDto;

    const { data, error } =
      await this.authProvider.refreshSession(refreshToken);

    if (error) {
      throw AuthErrors.TokenRefreshFailed;
    }

    if (!data.session) {
      throw AuthErrors.ProviderError(
        'Lỗi hệ thống',
        'Không lấy được phiên đăng nhập từ hệ thống',
      );
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

  async signOut(signOutRequestDto: SignOutReqRequestDto) {
    const { token } = signOutRequestDto;

    const { error } = await this.authProvider.signOut(token, SignOutType.LOCAL);

    if (error) {
      throw AuthErrors.SignOutFailed;
    }

    return {
      code: 200,
      status: 'success',
      message: 'Đăng xuất thành công',
    };
  }

  async getProfile(id: string) {
    const existedAccount = await this.accountRepository.findById(id);

    if (!existedAccount) {
      throw AuthErrors.UserNotFoundById(id);
    }

    return {
      code: 200,
      message: 'Lấy thông tin người dùng thành công',
      status: 'success',
      data: existedAccount,
    };
  }

  async updateProfile(id: string, updateUserRequestDto: UpdateUserRequestDto) {
    const existedAccount = await this.accountRepository.findById(id);

    if (!existedAccount) {
      throw AuthErrors.UserNotFoundById(id);
    }

    const { error } = await this.authProvider.updateUserById(
      id,
      updateUserRequestDto,
    );

    if (error) {
      throw AuthErrors.UpdateProfileFailed(id);
    }

    let isLocalAccountUpdate = false;

    try {
      const data = await this.accountRepository.update(
        id,
        updateUserRequestDto,
      );

      isLocalAccountUpdate = true;

      return {
        code: 200,
        message: 'Cập nhật người dùng thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      this.logger.error(
        `Lỗi khi cập nhật người dùng với id: ${id}. đang roolback`,
        error,
      );

      if (isLocalAccountUpdate) {
        try {
          await this.accountRepository.update(id, existedAccount);
        } catch (error) {
          this.logger.error('Không thể cập nhật người dùng', error);
        }
      }

      try {
        await this.authProvider.updateUserById(id, existedAccount);
      } catch (error) {
        this.logger.error('Không thể cập nhật tài khoảng supabase', error);
      }

      throw error;
    }
  }
}
