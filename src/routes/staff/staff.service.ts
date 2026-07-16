import { Inject, Injectable, Logger } from '@nestjs/common';
import { UpdateStaffDto } from './dto/update-staff.dto';
import type { IStaffRepository } from '../../shared/interfaces/i-staff.repository';
import type { IAccountRepository } from '../../shared/interfaces/i-account.repository';
import type { IAuthProvider } from '../../shared/interfaces/i-auth-provider.interface';
import { CreateStaffReqDto } from './dto/req-staff.dto';
import { AuthErrors } from '../../shared/exceptions/auth.exceptions';
import { Staff } from '@prisma/client';
import { resend } from '../../shared/config/resend.config';
import { getWelcomeEmailHtml } from '../../shared/template/email.template';
import { PrismaService } from '../../shared/config/prisma.service';

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

  async create(createStaffReqDto: CreateStaffReqDto) {
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

    if (existedEmail) {
      throw AuthErrors.EmailExists;
    }

    const { data: supabaseData, error } =
      await this.authProvider.adminCreateAccount({
        email,
        password,
        user_name,
        gender,
        role,
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

    if (!supabaseData?.user?.id) {
      throw AuthErrors.ProviderError(
        'Lỗi hệ thống',
        'Không lấy được ID người dùng từ hệ thống xác thực',
      );
    }

    const account_id = supabaseData.user.id;
    let isLocalAccountCreated = false;

    try {
      const accountData = await this.accountRepository.create({
        account_id,
        ...accountDto,
      });

      isLocalAccountCreated = true;

      const staffData = await this.staffRepository.create({
        staff_id: account_id,
        ...staffDto,
      });

      const htmlContext = getWelcomeEmailHtml(email, password);
      await resend.emails.send({
        from: 'noreply@triageflow.me',
        to: email,
        subject: 'Chào mừng bạn gia nhập hệ thống',
        html: htmlContext,
      });

      return {
        code: 200,
        status: 'success',
        message: 'Thành công',
        data: {
          staffData,
          accountData,
        },
      };
    } catch (error) {
      this.logger.error('Đã xảy ra lỗi đang tiến hành rollback');
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

  async findAll() {
    const data = await this.staffRepository.findAll();

    return {
      code: 200,
      status: 'success',
      message: 'Tìm tất cả nhân viên thành công',
      data: data,
    };
  }

  async findOne(id: string) {
    const data = await this.staffRepository.findById(id);

    return {
      code: 200,
      status: 'success',
      message: `Tìm nhân viên vơi id ${id} thành công`,
      data: data,
    };
  }

  async update(id: string, updateStaffDto: UpdateStaffDto) {
    const { role, gender, user_name, ...staffDto } = updateStaffDto;

    try {
      const rs = await this.prismaService.$transaction(async (tx) => {
        const data: Staff = await this.staffRepository.update(id, staffDto, tx);

        if (user_name || gender || role) {
          await this.accountRepository.update(
            data.staff_id,
            {
              user_name,
              gender,
              role,
            },
            tx,
          );
        }
        const metadata = { user_name, gender, role };

        await this.authProvider.updateUserById(data.staff_id, metadata);

        return data;
      });

      return {
        code: 200,
        status: 'success',
        message: `Cập nhật nhân viên với id ${id} thành công`,
        data: rs,
      };
    } catch (error) {
      this.logger.error('đã xảy ra lỗi đang roleback', error);
      throw error;
    }
  }
}
