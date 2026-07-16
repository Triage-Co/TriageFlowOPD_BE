import { Injectable } from '@nestjs/common';
import {
  IAuthProvider,
  OtpType,
  SignOutType,
} from '../interfaces/i-auth-provider.interface';
import { SupabaseService } from '../config/supabase.service';
import { BanReqDto } from '../../routes/account/dto/req-account.dto';

@Injectable()
export class SupabaseAuthProvider implements IAuthProvider {
  constructor(private readonly supabaseService: SupabaseService) {}
  ban(account_id: string, banReqDto: BanReqDto): Promise<any> {
    let banDuration = '';

    const { hours, minutes } = banReqDto;

    if (hours > 0) banDuration += `${hours}h`;

    if (minutes > 0) banDuration += `${minutes}m`;

    return this.supabaseService
      .getClient()
      .auth.admin.updateUserById(account_id, {
        ban_duration: banDuration,
      });
  }
  unBan(account_id: string): Promise<any> {
    return this.supabaseService
      .getClient()
      .auth.admin.updateUserById(account_id, {
        ban_duration: 'none',
      });
  }
  adminCreateAccount(data: any): Promise<any> {
    return this.supabaseService.getClient().auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        gender: data.gender,
        role: data.role,
        user_name: data.user_name,
        email: data.email,
        phone: data.phone,
      },
    });
  }

  signUp(email: string, password: string, metadata: any): Promise<any> {
    return this.supabaseService.getClient().auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          ...metadata,
        },
      },
    });
  }
  signInWithPassword(email: string, password: string): Promise<any> {
    return this.supabaseService.getClient().auth.signInWithPassword({
      email: email,
      password: password,
    });
  }
  signInWithOtp(email: string): Promise<any> {
    return this.supabaseService.getClient().auth.signInWithOtp({
      email: email,
    });
  }
  resetPasswordForEmail(email: string): Promise<any> {
    return this.supabaseService.getClient().auth.resetPasswordForEmail(email);
  }
  verifyOtp(email: string, token: string, type: OtpType): Promise<any> {
    return this.supabaseService.getClient().auth.verifyOtp({
      email: email,
      token: token,
      type: type,
    });
  }
  updateUserById(
    account_id: string,
    metadata?: any,
    email?: string,
    password?: string,
  ): Promise<any> {
    return this.supabaseService
      .getClient()
      .auth.admin.updateUserById(account_id, {
        ...(email && { email: email }),
        ...(password && {
          password: password,
        }),
        ...(metadata &&
          Object.keys(metadata).length > 0 && { user_metadata: metadata }),
      });
  }
  refreshSession(refresh_token: string): Promise<any> {
    return this.supabaseService.getClient().auth.refreshSession({
      refresh_token: refresh_token,
    });
  }
  signOut(token: string, type: SignOutType): Promise<any> {
    return this.supabaseService.getClient().auth.admin.signOut(token, type);
  }
  deleteAccount(accountId: string): Promise<any> {
    return this.supabaseService.getClient().auth.admin.deleteUser(accountId);
  }
}
