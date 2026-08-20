import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RoleTypeEnum } from '@prisma/client';
import { roles } from '../../shared/decorator/role.decorator';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('Admin Dashboard')
@Controller('admin/dashboard')
@UseGuards(IsAuthGuard, IsRoleGuard)
@roles(RoleTypeEnum.ADMIN)
@ApiBearerAuth()
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      '[ADMIN] Lấy tổng quan số liệu dashboard admin (KPI + phòng đang tải)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy tổng quan dashboard thành công.',
  })
  async getSummary() {
    return await this.adminDashboardService.getSummary();
  }
}
