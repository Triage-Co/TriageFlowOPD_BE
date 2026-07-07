import { CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '@supabase/supabase-js';
import { AuthErrors } from '../exceptions/auth.exceptions';
import type { IAccountRepository } from '../interfaces/i-account.repository';
import { ROLE_KEYS } from '../decorator/role.decorator';

export class IsRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject('IAccountRepository')
    private readonly accountRepository: IAccountRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<string[]>(ROLE_KEYS, [
      context.getHandler,
      context.getClass,
    ]);

    if (!requiredRole) {
      return true;
    }

    const ctx = context.switchToHttp();
    const request = ctx.getRequest();

    const user: User = request['user'];

    if (!user) {
      throw AuthErrors.Unauthenticated;
    }

    const existedAccount = await this.accountRepository.findById(user.id);
    const role = existedAccount.role;

    if (!role) {
      throw AuthErrors.RoleNotFound;
    }

    const hasRole = requiredRole.includes(role);

    if (!hasRole) {
      throw AuthErrors.ForbiddenRole;
    }

    return true;
  }
}
