import { SetMetadata } from '@nestjs/common';
import { RoleTypeEnum } from '@prisma/client';

export const ROLE_KEYS = 'roles';
export const roles = (...roles: RoleTypeEnum[]) =>
  SetMetadata(ROLE_KEYS, roles);
