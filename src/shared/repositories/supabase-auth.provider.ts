import { Injectable } from '@nestjs/common';
import {
  IAuthProvider,
  OtpType,
  SignOutType,
} from '../interfaces/i-auth-provider.interface';
import { SupabaseService } from '../config/supabase.service';

@Injectable()
export class SupabaseAuthProvider implements IAuthProvider {
  constructor(private readonly supabaseService: SupabaseService) {}
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
        phone: data.phone
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
  updateUserById(account_id: string, metadata: any): Promise<any> {
    return this.supabaseService
      .getClient()
      .auth.admin.updateUserById(account_id, {
        user_metadata: {
          ...metadata,
        },
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
