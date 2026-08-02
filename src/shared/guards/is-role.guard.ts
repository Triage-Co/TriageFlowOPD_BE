import { CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '@supabase/supabase-js';
import { AuthErrors } from '../exceptions/auth.exceptions';
import type { IAccountRepository } from '../interfaces/i-account.repository';
import { ROLE_KEYS } from '../decorator/role.decorator';
import { RoleTypeEnum } from '@prisma/client';

export class IsRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject('IAccountRepository')
    private readonly accountRepository: IAccountRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<RoleTypeEnum[]>(
      ROLE_KEYS,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRole) {
      return true;
    }

    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    if (!request || !request.user) {
      throw AuthErrors.Unauthenticated;
    }
    const id = request.user.sub || request.user.id;

    if (!id) {
      throw AuthErrors.UserNotFoundById(id);
    }

    const existedAccount = await this.accountRepository.findById(id);

    const role = existedAccount.role;

    if (!role) {
      throw AuthErrors.RoleNotFound;
    }

    const hasRole = requiredRole.includes(role);

    if (!hasRole) {
      throw AuthErrors.ForbiddenRole(requiredRole);
    }

    return true;
  }
}
