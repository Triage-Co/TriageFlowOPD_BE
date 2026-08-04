import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleTypeEnum } from '@prisma/client';
import { roles } from '../../shared/decorator/role.decorator';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import {
  CreatePriorityRuleDto,
  CreateRoomServiceDto,
  QueryPriorityRuleDto,
  UpdatePriorityRuleDto,
  UpdateRoomServiceDto,
} from './dto/admin-rule.dto';
import { QueueAdminService } from './queue-admin.service';

@ApiTags('Queue Admin')
@Controller('queue/admin')
@UseGuards(IsAuthGuard, IsRoleGuard)
@roles(RoleTypeEnum.ADMIN)
@ApiBearerAuth()
export class QueueAdminController {
  constructor(private readonly queueAdminService: QueueAdminService) {}

  // ─── Priority Rules CRUD ──────────────────────────────────────────────────

  @Get('rules')
  @ApiOperation({ summary: '[ADMIN] Lấy danh sách quy tắc ưu tiên hàng chờ' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách rule thành công.' })
  async getRules(@Query() query: QueryPriorityRuleDto) {
    return await this.queueAdminService.getRules(query);
  }

  @Post('rules')
  @ApiOperation({ summary: '[ADMIN] Tạo mới quy tắc ưu tiên hàng chờ' })
  @ApiResponse({ status: 201, description: 'Tạo quy tắc ưu tiên thành công.' })
  async createRule(@Body() dto: CreatePriorityRuleDto) {
    return await this.queueAdminService.createRule(dto);
  }

  @Patch('rules/:ruleId')
  @ApiOperation({ summary: '[ADMIN] Cập nhật quy tắc ưu tiên hàng chờ' })
  @ApiResponse({ status: 200, description: 'Cập nhật quy tắc thành công.' })
  async updateRule(
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdatePriorityRuleDto,
  ) {
    return await this.queueAdminService.updateRule(ruleId, dto);
  }

  @Delete('rules/:ruleId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Tắt (soft-delete) quy tắc ưu tiên hàng chờ' })
  @ApiResponse({ status: 200, description: 'Đã tắt quy tắc ưu tiên thành công.' })
  async deleteRule(@Param('ruleId') ruleId: string) {
    return await this.queueAdminService.deleteRule(ruleId);
  }

  // ─── Room-Service Mapping CRUD ──────────────────────────────────────────

  @Get('room-services')
  @ApiOperation({ summary: '[ADMIN] Lấy danh sách phân công dịch vụ cho phòng' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách phân công thành công.' })
  async getRoomServices(
    @Query('room_id') roomId?: string,
    @Query('service_id') serviceId?: string,
  ) {
    return await this.queueAdminService.getRoomServices(roomId, serviceId);
  }

  @Post('room-services')
  @ApiOperation({ summary: '[ADMIN] Tạo phân công dịch vụ cho phòng' })
  @ApiResponse({ status: 201, description: 'Tạo phân công dịch vụ thành công.' })
  async createRoomService(@Body() dto: CreateRoomServiceDto) {
    return await this.queueAdminService.createRoomService(dto);
  }

  @Patch('room-services/:id')
  @ApiOperation({ summary: '[ADMIN] Cập nhật trạng thái phân công dịch vụ phòng' })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái phân công thành công.' })
  async updateRoomService(
    @Param('id') id: string,
    @Body() dto: UpdateRoomServiceDto,
  ) {
    return await this.queueAdminService.updateRoomService(id, dto);
  }

  @Delete('room-services/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Xóa phân công dịch vụ phòng' })
  @ApiResponse({ status: 200, description: 'Xóa phân công thành công.' })
  async deleteRoomService(@Param('id') id: string) {
    return await this.queueAdminService.deleteRoomService(id);
  }

  // ─── Default Duration Stats & Heatmap ─────────────────────────────────────

  @Get('room-stats')
  @ApiOperation({ summary: '[ADMIN] Xem cấu hình thời gian phục vụ phòng khám' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách cấu hình thời gian thành công.' })
  async getRoomStats(@Query('room_id') roomId?: string) {
    return await this.queueAdminService.getRoomStats(roomId);
  }

  @Get('heatmap')
  @ApiOperation({ summary: '[ADMIN] Lấy dữ liệu snapshot heatmap hàng chờ toàn bệnh viện' })
  @ApiResponse({ status: 200, description: 'Dữ liệu snapshot heatmap hàng chờ.' })
  async getHeatmapData() {
    return await this.queueAdminService.getHeatmapData();
  }
}
