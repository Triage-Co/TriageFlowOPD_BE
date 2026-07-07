import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';

@Injectable()
export class IsAuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException({
        detail: 'Chưa có token trong header',
        message: 'Lỗi xác thực',
      });
    }

    const [type, token] = authorization.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException({
        message: 'Định dạng token không hợp lệ',
        detail: 'Định dạng token phải là Bearer token',
      });
    }
    const {
      data: { user },
      error,
    } = await this.supabaseService.getClient().auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException({
        message: 'Token không hợp lệ hoặc đã hết hạn.',
        detail: error?.message,
      });
    }

    request['user'] = user;

    return true;
  }
}
