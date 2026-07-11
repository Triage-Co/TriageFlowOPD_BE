import { Inject, Injectable } from '@nestjs/common';
import { UpdateStaffDto } from './dto/update-staff.dto';
import type { IStaffRepository } from '../../shared/interfaces/i-staff.repository';
import type { IAccountRepository } from '../../shared/interfaces/i-account.repository';
import type { IAuthProvider } from '../../shared/interfaces/i-auth-provider.interface';
import { CreateStaffReqDto } from './dto/req-staff.dto';
import { AuthErrors } from '../../shared/exceptions/auth.exceptions';

@Injectable()
export class StaffService {
  constructor(
    @Inject('IStaffRepository')
    private readonly staffRepository: IStaffRepository,
    @Inject('IAccountRepository')
    private readonly accountRepository: IAccountRepository,
    @Inject('IAuthProvider') private readonly authProvider: IAuthProvider,
  ) {}

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

    const { data: supabaseData, error } = await this.authProvider.signUp(
      email,
      password,
      {
        user_name,
        gender,
        role,
      },
    );

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

    const accountData = await this.accountRepository.create({
      account_id,
      ...accountDto,
    });

    const staffData = await this.staffRepository.create({
      staff_id: account_id,
      ...staffDto,
    });

    return {
      code: 200,
      stauts: 'success',
      message: 'Thành công',
      data: {
        staffData,
        accountData,
      },
    };
  }

  async findAll() {
    const data = await this.staffRepository.findAll();

    return {
      code: 200,
      stauts: 'success',
      message: 'Tìm tất cả nhân viên thành công',
      data: data,
    };
  }

  async findOne(id: string) {
    const data = await this.staffRepository.findById(id);

    return {
      code: 200,
      stauts: 'success',
      message: `Tìm nhân viên vơi id ${id} thành công`,
      data: data,
    };
  }

  async update(id: string, updateStaffDto: UpdateStaffDto) {
    const data = await this.staffRepository.update(id, updateStaffDto);

    return {
      code: 200,
      stauts: 'success',
      message: `Cập nhật nhân viên với id ${id} thành công`,
      data: data,
    };
  }

  async remove(id: string) {
    await this.staffRepository.delete(id);

    return {
      code: 200,
      stauts: 'success',
      message: 'Xóa nhân viên thành công',
    };
  }
}
