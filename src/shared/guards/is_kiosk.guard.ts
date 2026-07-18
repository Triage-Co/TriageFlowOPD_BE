import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class IsKioskGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const authorization = request.headers.authorization;
    console.log(authorization);
    if (!authorization) {
      throw new UnauthorizedException({
        detail: 'Chưa có token trong header',
        message: 'Lỗi xác thực người dùng',
      });
    }

    const [type, token] = authorization.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException({
        message: 'Định dạng token không hợp lệ',
        detail: 'Định dạng token phải là Bearer token',
      });
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request['user'] = payload;
    } catch (error) {
      throw new UnauthorizedException({
        message: 'Xác thực thất bại',
        detail: 'Token không hợp lệ hoặc đã hết hạn',
      });
    }

    return true;
  }
}
