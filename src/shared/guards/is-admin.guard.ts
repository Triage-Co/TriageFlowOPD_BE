import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { User } from "@supabase/supabase-js";
import { PrismaConfig } from "../config/prisma.config";


@Injectable()
export class IsAdminGuard implements CanActivate {

    constructor(private readonly prismaConfig: PrismaConfig) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user: User = request["user"];

        if (!user || !user.id) {
            throw new UnauthorizedException({
                code: 401,
                status: "error",
                message: "Đã xảy ra lỗi khi xác thực người dùng"
            });
        }

        const exitedUser = await this.prismaConfig.users.findUnique({
            where: {
                id: user.id
            },
            select: {
                role: true
            }
        });

        if (!exitedUser) {
            throw new ForbiddenException({
                code: 403,
                status: "error",
                message: "Đã xảy ra lỗi khi lấy thông tin vai trò của người dùng"
            })
        }

        if (exitedUser.role != "ADMIN") {
            throw new ForbiddenException({
                code: 403,
                status: "error",
                message: "Bạn không có quyền truy cập thông tin này"
            })
        } 
    
        return true;
    }

}