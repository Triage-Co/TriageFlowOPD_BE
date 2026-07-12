import { BadRequestException, Injectable } from '@nestjs/common';
import { BanReqDto, CreateAccountDto } from './dto/req-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { PrismaService } from '../../shared/config/prisma.service';
import { SupabaseService } from '../../shared/config/supabase.service';

@Injectable()
export class AccountService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async findAll() {
    const data = await this.prismaService.account.findMany();
    return {
      code: 200,
      status: 'success',
      message: 'Thành công',
      data: data,
    };
  }

  async findOne(id: string) {
    const data = await this.prismaService.account.findUnique({
      where: {
        account_id: id,
      },
    });
    return {
      code: 200,
      status: 'success',
      message: 'Thành công',
      data: data,
    };
  }

  async ban(account_id: string, banReqDto: BanReqDto) {
    let banDuration = '';

    const { hours, minutes } = banReqDto;

    if (hours > 0) banDuration += `${hours}h`;

    if (minutes > 0) banDuration += `${minutes}m`;

    const { data, error } = await this.supabaseService
      .getClient()
      .auth.admin.updateUserById(account_id, {
        ban_duration: banDuration,
      });

    if (error) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Lỗi khi khóa tài khoản: ' + error.message,
      });
    }

    await this.prismaService.account.update({
      where: { account_id },
      data: { is_banned: false },
    });

    return {
      code: 200,
      status: 'success',
      message: `Đã khóa tài khoản trong ${banDuration}`,
      data: data.user.user_metadata,
    };
  }

  async unBan(account_id: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .auth.admin.updateUserById(account_id, {
        ban_duration: 'none',
      });

    if (error) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Lỗi khi mở khóa tài khoản: ' + error.message,
      });
    }

    await this.prismaService.account.update({
      where: { account_id },
      data: { is_banned: false },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Mở khóa tài khoản thành công',
      data: data.user.user_metadata,
    };
  }
}
