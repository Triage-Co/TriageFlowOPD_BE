import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { SupabaseConfig } from "../config/supabase.config";

@Injectable()
export class IsAuthGuard implements CanActivate {

    constructor(private readonly supabaseConfig: SupabaseConfig) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            throw new UnauthorizedException({
                code: 401,
                status: "error",
                message: "Chưa có token trong header."
            });
        }
        const [type, token] = authHeader.split(' ');
        if (type !== 'Bearer' || !token) {
            throw new UnauthorizedException({
                code: 401,
                status: "error",
                message: "Định dạng toke không hợp lệ"
            });
        }
        const { data: { user }, error } = await this.supabaseConfig.getClient().auth.getUser(token);

        if (error || !user) {
            throw new UnauthorizedException({
                code: 401,
                status: "error",
                message: "Token không hợp lệ hoặc đã hết hạn."
            })
        }

        request['user'] = user;

        return true;
    }

}