import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';
import { RoleTypeEnum } from '@prisma/client';
import {
  CallPatientDto,
  OverrideQueueDto,
  RefuseQueueDto,
  TransferQueueDto,
  UpdateRoomStatDto,
} from './dto/create-queue.dto';
import { QueueService } from './queue.service';
import { QueueRebalanceService } from './queue-rebalance.service';

@ApiTags('Queue')
@Controller('queue')
export class QueueController {
  constructor(
    private readonly queueService: QueueService,
    private readonly queueRebalanceService: QueueRebalanceService,
  ) {}

  private getUser(req: any) {
    const u = req?.user;
    return {
      id: u?.account_id || u?.id || u?.sub || 'system',
      role: u?.role || 'USER',
    };
  }

  @Post('call-next')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Bác sĩ gọi bệnh nhân tiếp theo vào phòng khám (tự động theo engine hoặc gọi đích danh)',
  })
  @ApiResponse({
    status: 200,
    description: 'Gọi bệnh nhân thành công và phát sóng realtime xuống TV.',
  })
  async callNextPatient(@Body() body: CallPatientDto, @Req() req: any) {
    const { step_id, room_id, staff_id } = body;
    const user = this.getUser(req);
    return await this.queueService.callNextPatient(
      step_id,
      room_id,
      staff_id,
      user,
    );
  }

  @Post('transfer')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bác sĩ chuyển bệnh nhân sang phòng khám / hội chẩn mới',
  })
  @ApiResponse({
    status: 200,
    description: 'Chuyển phòng thành công, cấp số mới và phát sóng realtime.',
  })
  async transferQueue(@Body() body: TransferQueueDto, @Req() req: any) {
    const user = this.getUser(req);
    return await this.queueService.transferQueue(
      body.step_id,
      body.to_room_id,
      body.staff_id,
      user,
    );
  }

  @Post(':queueId/override')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Can thiệp thứ tự hàng chờ (PIN_TOP, MOVE_TO_POSITION, UNPIN)',
  })
  @ApiResponse({
    status: 200,
    description: 'Đã cập nhật vị trí ưu tiên lượt chờ.',
  })
  async overrideQueuePosition(
    @Param('queueId') queueId: string,
    @Body() body: OverrideQueueDto,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return await this.queueService.overrideQueuePosition(queueId, body, user);
  }

  @Post(':queueId/miss')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu bệnh nhân vắng mặt khi gọi (MISSING)' })
  @ApiResponse({ status: 200, description: 'Đã đánh dấu vắng mặt.' })
  async markQueueMissed(@Param('queueId') queueId: string, @Req() req: any) {
    const user = this.getUser(req);
    return await this.queueService.markQueueMissed(queueId, user);
  }

  @Post(':queueId/recall')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gọi lại bệnh nhân vắng mặt vào lại hàng chờ' })
  @ApiResponse({
    status: 200,
    description: 'Đã đưa bệnh nhân quay lại hàng chờ.',
  })
  async recallQueue(@Param('queueId') queueId: string, @Req() req: any) {
    const user = this.getUser(req);
    return await this.queueService.recallQueue(queueId, user);
  }

  @Post(':queueId/complete')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Hoàn thành lượt SERVING tại phòng (Step COMPLETED, đóng queue, sync SO)',
  })
  @ApiResponse({ status: 200, description: 'Đã hoàn thành lượt phục vụ.' })
  async completeServingQueue(
    @Param('queueId') queueId: string,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return await this.queueService.completeServingQueue(queueId, user);
  }

  @Post(':queueId/refuse')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Từ chối lượt SERVING tại phòng (Step DECLINED, đóng queue, sync SO)',
  })
  @ApiResponse({ status: 200, description: 'Đã từ chối lượt phục vụ.' })
  async refuseServingQueue(
    @Param('queueId') queueId: string,
    @Body() body: RefuseQueueDto,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return await this.queueService.refuseServingQueue(
      queueId,
      user,
      body?.reason,
    );
  }

  @Post(':queueId/service-order-details/:detailId/complete')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hoàn thành một Service Order Detail (queue vẫn SERVING)',
  })
  async completeServiceOrderDetail(
    @Param('queueId') queueId: string,
    @Param('detailId') detailId: string,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return await this.queueService.completeServiceOrderDetail(
      queueId,
      detailId,
      user,
    );
  }

  @Post(':queueId/service-order-details/:detailId/refuse')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Từ chối một Service Order Detail → CANCELLED (queue vẫn SERVING)',
  })
  async refuseServiceOrderDetail(
    @Param('queueId') queueId: string,
    @Param('detailId') detailId: string,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return await this.queueService.refuseServiceOrderDetail(
      queueId,
      detailId,
      user,
    );
  }

  @Post(':queueId/service-orders/:orderId/complete')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hoàn thành toàn bộ Service Order (queue vẫn SERVING)',
  })
  async completeServiceOrder(
    @Param('queueId') queueId: string,
    @Param('orderId') orderId: string,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return await this.queueService.completeServiceOrder(queueId, orderId, user);
  }

  @Post(':queueId/service-orders/:orderId/refuse')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Từ chối toàn bộ Service Order → CANCELLED (queue vẫn SERVING)',
  })
  async refuseServiceOrder(
    @Param('queueId') queueId: string,
    @Param('orderId') orderId: string,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return await this.queueService.refuseServiceOrder(queueId, orderId, user);
  }

  @Get('room/:roomId')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xem chi tiết hàng chờ phòng khám dành cho Staff / Doctor',
  })
  @ApiResponse({
    status: 200,
    description:
      'Danh sách chi tiết hàng chờ (serving, waiting, missing, finished).',
  })
  async getRoomQueueView(@Param('roomId') roomId: string, @Req() req: any) {
    const user = this.getUser(req);
    return await this.queueService.getRoomQueueView(roomId, user);
  }

  @Patch('admin/room-stats/:roomId')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @roles(RoleTypeEnum.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin cấu hình thời gian phục vụ mặc định cho phòng khám',
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật thời gian mặc định thành công.',
  })
  async updateRoomDefaultDurationSec(
    @Param('roomId') roomId: string,
    @Body() body: UpdateRoomStatDto,
  ) {
    const updated = await this.queueService.updateRoomDefaultDurationSec(
      roomId,
      body.step_type,
      body.default_duration_sec,
    );
    return {
      code: 200,
      status: 'success',
      message: 'Cập nhật cấu hình thời gian mặc định thành công.',
      data: updated,
    };
  }

  @Get('rebalance/suggestions')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem các gợi ý điều phối chuyển phòng (PENDING)' })
  @ApiResponse({ status: 200, description: 'Danh sách gợi ý điều phối.' })
  async getPendingRebalanceSuggestions(
    @Query('room_id') roomId: string,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return await this.queueRebalanceService.getPendingSuggestions(roomId, user);
  }

  @Post('rebalance/suggestions/:id/confirm')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác nhận thực thi gợi ý chuyển phòng khám' })
  @ApiResponse({
    status: 200,
    description: 'Đã chuyển bệnh nhân sang phòng mới thành công.',
  })
  async confirmRebalanceSuggestion(
    @Param('id') suggestionId: string,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return await this.queueRebalanceService.confirmSuggestion(
      suggestionId,
      user,
    );
  }

  @Post('rebalance/suggestions/:id/reject')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Từ chối gợi ý chuyển phòng khám' })
  @ApiResponse({ status: 200, description: 'Đã từ chối gợi ý.' })
  async rejectRebalanceSuggestion(
    @Param('id') suggestionId: string,
    @Req() req: any,
  ) {
    const user = this.getUser(req);
    return await this.queueRebalanceService.rejectSuggestion(
      suggestionId,
      user,
    );
  }
}
