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
  signUp(email: string, password: string, metadata: any): Promise<any>;
  signInWithPassword(email: string, password: string): Promise<any>;
  signInWithOtp(email: string): Promise<any>;
  resetPasswordForEmail(email: string): Promise<any>;
  verifyOtp(email: string, token: string, type: OtpType): Promise<any>;
  updateUserById(account_id: string, data: any): Promise<any>;
  refreshSession(refresh_token: string): Promise<any>;
  signOut(token: string, type: SignOutType): Promise<any>;
  deleteAccount(accountId: string): Promise<any>;
}
