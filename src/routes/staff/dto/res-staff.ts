import { GenderTypeEnum, RoleTypeEnum } from '@prisma/client';

export interface AccountResDto {
  account_id: string;
  avatar: string;
  user_name: string;
  email: string;
  role: RoleTypeEnum;
  gender: GenderTypeEnum;
  phone: string;
  is_banned: boolean;
}

export class StaffResDto {
  staff_id: string;
  full_name: string;
  license_number: string;
  experience_years: Number;
  specialty_id: string;
  account: AccountResDto;
}
