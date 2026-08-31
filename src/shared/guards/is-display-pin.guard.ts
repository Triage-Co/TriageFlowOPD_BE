import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export const DISPLAY_PIN_TOKEN_TYPE = 'DISPLAY_PIN';

export function extractBearerToken(request: {
  headers?: Record<string, unknown>;
}): string | null {
  const authorization = request.headers?.authorization;
  if (typeof authorization !== 'string') return null;
  const [type, token] = authorization.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

@Injectable()
export class IsDisplayPinGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException({
        message: 'Lỗi xác thực thiết bị',
        detail: 'Chưa có token PIN màn hình trong header',
      });
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      if (payload?.type !== DISPLAY_PIN_TOKEN_TYPE) {
        throw new UnauthorizedException({
          message: 'Lỗi xác thực thiết bị',
          detail: 'Token không phải phiên PIN màn hình',
        });
      }
      request.user = payload;
      request.authSource = DISPLAY_PIN_TOKEN_TYPE;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException({
        message: 'Lỗi xác thực thiết bị',
        detail: 'Token PIN không hợp lệ hoặc đã hết hạn',
      });
    }
  }
}
