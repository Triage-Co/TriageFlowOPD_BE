import {
  AuthOtpResponse,
  AuthResponse,
  AuthTokenResponse,
  AuthTokenResponsePassword,
  UserResponse,
} from '@supabase/supabase-js';
import { BanReqDto } from '../../routes/account/dto/req-account.dto';
import { SupabaseMetadata } from '../types/supabase-auth.type';

export enum OtpType {
  EMAIL = 'email',
  EMAIL_CHANGE = 'email_change',
  INVITE = 'invite',
  MAGIC_LINK = 'magiclink',
  PHONE_CHANGE = 'phone_change',
  RECOVERY = 'recovery',
  SIGNUP = 'signup',
  SMS = 'sms',
}

export enum SignOutType {
  LOCAL = 'local',
  GLOBAL = 'global',
  OTHERS = 'others',
}

export interface IAuthProvider {
  signUp(email: string, password: string, metadata: any): Promise<AuthResponse>;
  signInWithPassword(
    email: string,
    password: string,
  ): Promise<AuthTokenResponsePassword>;
  signInWithOtp(email: string): Promise<AuthOtpResponse>;
  resetPasswordForEmail(email: string): Promise<any>;
  verifyOtp(email: string, token: string, type: OtpType): Promise<AuthResponse>;
  updateUserById(account_id: string, metadata: any): Promise<any>;
  refreshSession(refresh_token: string): Promise<any>;
  signOut(token: string, type: SignOutType): Promise<any>;
  deleteAccount(accountId: string): Promise<any>;
  adminCreateAccount(
    email: string,
    password: string,
    data: SupabaseMetadata,
  ): Promise<UserResponse>;
  ban(account_id: string, banReqDto: BanReqDto): Promise<any>;
  unBan(account_id: string): Promise<any>;
}
