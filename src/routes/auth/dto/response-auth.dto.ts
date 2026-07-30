import { GenderTypeEnum, RoleTypeEnum } from '@prisma/client';

export class signUpResponseDto {
  account_id: string;
  full_name: string;
  citizen_id: string;
  email: string;
  password: string;
  dob?: Date;
  gender: GenderTypeEnum;
  role: RoleTypeEnum;
}
