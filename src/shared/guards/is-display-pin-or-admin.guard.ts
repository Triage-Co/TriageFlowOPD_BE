import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom, isObservable } from 'rxjs';
import { RoleTypeEnum } from '@prisma/client';
import type { IAccountRepository } from '../interfaces/i-account.repository';
import { AuthErrors } from '../exceptions/auth.exceptions';
import {
  DISPLAY_PIN_TOKEN_TYPE,
  extractBearerToken,
} from './is-display-pin.guard';

@Injectable()
export class IsDisplayPinOrAdminGuard
  extends AuthGuard('jwt')
  implements CanActivate
{
  constructor(
    private readonly jwtService: JwtService,
    @Inject('IAccountRepository')
    private readonly accountRepository: IAccountRepository,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException({
        message: 'Lỗi xác thực',
        detail: 'Chưa có token trong header',
      });
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      if (payload?.type === DISPLAY_PIN_TOKEN_TYPE) {
        request.user = payload;
        request.authSource = DISPLAY_PIN_TOKEN_TYPE;
        return true;
      }
    } catch {
      // Not a KIOSK_KEY display PIN token — try staff ADMIN JWT
    }

    const result = super.canActivate(context);
    let allowed = false;
    if (typeof result === 'boolean') {
      allowed = result;
    } else if (isObservable(result)) {
      allowed = Boolean(await firstValueFrom(result));
    } else {
      allowed = Boolean(await result);
    }
    if (!allowed) {
      throw AuthErrors.Unauthenticated;
    }

    const user = request.user;
    const id = user?.sub || user?.id;
    if (!id) {
      throw AuthErrors.Unauthenticated;
    }
    const account = await this.accountRepository.findById(id);
    if (!account?.role) {
      throw AuthErrors.RoleNotFound;
    }
    if (account.role !== RoleTypeEnum.ADMIN) {
      throw AuthErrors.ForbiddenRole([RoleTypeEnum.ADMIN]);
    }
    request.authSource = 'ADMIN';
    return true;
  }
}
