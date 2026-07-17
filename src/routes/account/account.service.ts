import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { BanReqDto, CreateAccountDto } from "./dto/req-account.dto";
import { PrismaService } from "../../shared/config/prisma.service";
import { SupabaseService } from "../../shared/config/supabase.service";
import type { IAccountRepository } from "../../shared/interfaces/i-account.repository";
import type { IAuthProvider } from "../../shared/interfaces/i-auth-provider.interface";
import { AuthErrors } from "../../shared/exceptions/auth.exceptions";

@Injectable()
export class AccountService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly supabaseService: SupabaseService,
    @Inject("IAccountRepository")
    private readonly accountRepository: IAccountRepository,
    @Inject("IAuthProvider") private readonly authProvider: IAuthProvider,
  ) {}

  async findAll() {
    const data = await this.accountRepository.findAll();

    return {
      code: 200,
      status: "success",
      message: "Lấy danh sách tài khoản hành công",
      data: data,
    };
  }

  async findOne(id: string) {
    const data = await this.accountRepository.findById(id);
    if (!data) {
      throw AuthErrors.UserNotFoundById(id);
    }
    return {
      code: 200,
      status: "success",
      message: `Lấy tài khoản theo id: ${id} thành công`,
      data: data,
    };
  }

  async ban(account_id: string, banReqDto: BanReqDto) {
    const { data, error } = await this.authProvider.ban(account_id, banReqDto);

    if (error) {
      throw AuthErrors.LockAccountFailed(account_id);
    }

    await this.prismaService.account.update({
      where: { account_id },
      data: { is_banned: false },
    });

    return {
      code: 200,
      status: "success",
      message: `Đã khóa tài khoản`,
      data: data.user.user_metadata,
    };
  }

  async unBan(account_id: string) {
    const { data, error } = await this.authProvider.unBan(account_id);

    if (error) {
      throw AuthErrors.UnlockAccountFailed(account_id);
    }

    await this.prismaService.account.update({
      where: { account_id },
      data: { is_banned: false },
    });

    return {
      code: 200,
      status: "success",
      message: "Mở khóa tài khoản thành công",
      data: data.user.user_metadata,
    };
  }
}
