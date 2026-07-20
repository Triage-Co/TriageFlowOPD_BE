import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IStaffRepository } from '../../shared/interfaces/i-staff.repository';
import type { IAccountRepository } from '../../shared/interfaces/i-account.repository';
import type { IAuthProvider } from '../../shared/interfaces/i-auth-provider.interface';
import { CreateStaffReqDto, UpdateStaffReqDto } from './dto/req-staff.dto';
import { AuthErrors } from '../../shared/exceptions/auth.exceptions';
import { Account, Staff } from '@prisma/client';
import { resend } from '../../shared/config/resend.config';
import { getWelcomeEmailHtml } from '../../shared/template/email.template';
import { PrismaService } from '../../shared/config/prisma.service';
import { ResponseType } from '../../shared/types/response.type';
import { StaffResDto } from './dto/res-staff';

@Injectable()
export class StaffService {
  constructor(
    @Inject('IStaffRepository')
    private readonly staffRepository: IStaffRepository,
    @Inject('IAccountRepository')
    private readonly accountRepository: IAccountRepository,
    @Inject('IAuthProvider') private readonly authProvider: IAuthProvider,
    private readonly prismaService: PrismaService,
  ) {}

  private readonly logger = new Logger(StaffService.name);

  async create(
    createStaffReqDto: CreateStaffReqDto,
  ): Promise<ResponseType<StaffResDto>> {
    const {
      license_number,
      email,
      experience_years,
      full_name,
      gender,
      phone,
      role,
      specialty_id,
      user_name,
      password,
    } = createStaffReqDto;

    const accountDto = {
      user_name,
      role,
      gender,
      phone,
      email,
    };

    const staffDto = {
      license_number,
      experience_years,
      full_name,
      specialty_id,
    };

    const existedEmail = await this.accountRepository.findByEmail(email);

    if (existedEmail) throw AuthErrors.EmailExists(email);

    const existedPhone = await this.accountRepository.findByPhone(phone);

    if (existedPhone) throw AuthErrors.PhoneExists(phone);

    const { data: supabaseData, error: supabaseError } =
      await this.authProvider.adminCreateAccount(email, password, {
        email,
        user_name,
        gender,
        role,
        phone,
      });

    if (supabaseError) {
      switch (supabaseError.code) {
        case 'email_not_confirmed': {
          throw AuthErrors.EmailNotConfirmed;
        }
        case 'user_banned': {
          throw AuthErrors.UserBanned;
        }
        default: {
          throw AuthErrors.ProviderError(
            'Không thể đăng ký tài khoản',
            supabaseError.message,
          );
        }
      }
    }

    if (!supabaseData?.user?.id) {
      throw AuthErrors.ProviderError(
        'Lỗi hệ thống',
        'Không lấy được ID người dùng từ hệ thống xác thực',
      );
    }

    const account_id = supabaseData.user.id;

    try {
      const rs = await this.prismaService.$transaction(async (tx) => {
        const accountData = await this.accountRepository.create(
          {
            account_id,
            ...accountDto,
          },
          tx,
        );

        const staffData = await this.staffRepository.create(
          {
            staff_id: account_id,
            ...staffDto,
          },
          tx,
        );

        return {
          ...staffData,
          account: accountData,
        };
      });

      this.sendWelcomeEmailAsync(email, password).catch((e) => {
        this.logger.error(`Lỗi xảy ra khi gửi mail đến ${email}`, e);
      });
      return {
        code: 200,
        status: 'success',
        message: 'Thành công',
        data: rs,
      };
    } catch (error) {
      this.logger.error('Đã xảy ra lỗi đang tiến hành rollback', error);
      try {
        await this.authProvider.deleteAccount(account_id);
      } catch (authErr) {
        this.logger.error(
          `Cảnh báo: Không thể xóa Supabase account ${account_id}`,
          authErr,
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    updateStaffReqDto: UpdateStaffReqDto,
  ): Promise<ResponseType<StaffResDto>> {
    const { role, gender, user_name, phone, ...staffDto } = updateStaffReqDto;
    const isUpdatingAuthInfo = user_name || gender || role || phone;
    let oldAccountData: Account | null = null;
    if (isUpdatingAuthInfo) {
      oldAccountData = await this.accountRepository.findById(id);
      if (!oldAccountData) throw AuthErrors.UserNotFoundById(id);

      const { error } = await this.authProvider.updateUserById(id, {
        user_name,
        gender,
        role,
        phone,
      });
      if (error) {
        this.logger.error(`Supabase update lỗi cho user ${id}`, error);
      }
    }

    try {
      const rs = await this.prismaService.$transaction(async (tx) => {
        let accountData = null;
        if (isUpdatingAuthInfo) {
          accountData = await this.accountRepository.update(
            id,
            { user_name, gender, role, phone },
            tx,
          );
        }
        const staffData =
          Object.keys(staffDto).length > 0
            ? await this.staffRepository.update(id, staffDto, tx)
            : null;

        return { ...staffData, account: accountData };
      });

      return {
        code: 200,
        status: 'success',
        message: `Cập nhật nhân viên với id ${id} thành công`,
        data: rs,
      };
    } catch (error) {
      this.logger.error('đã xảy ra lỗi đang rollback', error);
      if (isUpdatingAuthInfo && oldAccountData) {
        try {
          await this.authProvider.updateUserById(id, {
            user_name: oldAccountData.user_name,
            gender: oldAccountData.gender,
            role: oldAccountData.role,
            phone: oldAccountData.phone,
          });
        } catch (rollbackErr) {
          this.logger.error(
            'Cảnh báo: Rollback Supabase thất bại',
            rollbackErr,
          );
        }
      }
      throw error;
    }
  }

  async findAll(): Promise<ResponseType<StaffResDto[]>> {
    const data = await this.staffRepository.findAll();

    return {
      code: 200,
      status: 'success',
      message: 'Tìm tất cả nhân viên thành công',
      data: data,
    };
  }

  async findOne(id: string): Promise<ResponseType<StaffResDto>> {
    const data = await this.staffRepository.findById(id);

    if (!data) {
      throw AuthErrors.UserNotFoundById(id);
    }

    return {
      code: 200,
      status: 'success',
      message: `Tìm nhân viên vơi id ${id} thành công`,
      data: data,
    };
  }

  private async sendWelcomeEmailAsync(email: string, password: string) {
    const htmlContext = getWelcomeEmailHtml(email, password);
    await resend.emails.send({
      from: 'noreply@triageflow.me',
      to: email,
      subject: 'Chào mừng bạn gia nhập hệ thống',
      html: htmlContext,
    });
  }
}
