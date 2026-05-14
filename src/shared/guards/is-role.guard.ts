import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaConfig } from "../config/prisma.config";
import { User } from "@supabase/supabase-js";
import { ROLES_KEY } from "../decorator/role.decorator";

@Injectable()
export class IsRoleGuard implements CanActivate {

    constructor(private reflector: Reflector, private readonly prismaConfig: PrismaConfig) {
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {

        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass()
        ])

        if (!requiredRoles) {
            return true;
        }

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
            where: { id: user.id },
            select: { role: true }
        });

        if (!exitedUser) {
            throw new ForbiddenException({
                code: 403,
                status: "error",
                message: "Đã xảy ra lỗi khi lấy thông tin vai trò của người dùng"
            });
        }

        const hasRole = requiredRoles.includes(exitedUser.role);

        if (!hasRole) {
            throw new ForbiddenException({
                code: 403,
                status: "error",
                message: "Bạn không có quyền truy cập thông tin này"
            });
        }

        return true;
    }

}