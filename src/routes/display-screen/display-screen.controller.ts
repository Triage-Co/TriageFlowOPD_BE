import {
  Body,
  Controller,
  Delete,
  Get,
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
  ApiTags,
} from '@nestjs/swagger';
import { RoleTypeEnum } from '@prisma/client';
import { roles } from '../../shared/decorator/role.decorator';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsDisplayPinOrAdminGuard } from '../../shared/guards/is-display-pin-or-admin.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { DisplayScreenService } from './display-screen.service';
import {
  ChangeDisplayPinDto,
  CreateDisplayScreenDto,
  FindOrCreateClinicDisplayDto,
  FindOrCreatePaymentDisplayDto,
  QueryDisplayScreenDto,
  UpdateDisplayScreenDto,
  VerifyDisplayPinDto,
} from './dto/display-screen.dto';

@ApiTags('Display Screen')
@Controller('display-screen')
export class DisplayScreenController {
  constructor(private readonly displayScreenService: DisplayScreenService) {}

  @Get()
  @ApiOperation({
    summary: '[Public] Danh sách màn hình kiosk/TV (không trả PIN)',
  })
  list(@Query() query: QueryDisplayScreenDto) {
    return this.displayScreenService.list(query);
  }

  @Post('verify-pin')
  @ApiOperation({
    summary: '[Public] Xác thực PIN toàn hệ thống, nhận JWT ngắn hạn cho thiết bị',
  })
  verifyPin(@Body() dto: VerifyDisplayPinDto, @Req() req: { ip?: string; headers?: Record<string, unknown> }) {
    const forwarded = req.headers?.['x-forwarded-for'];
    const clientKey =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : '') ||
      req.ip ||
      'unknown';
    return this.displayScreenService.verifyPin(dto.pin, clientKey);
  }

  @Post('find-or-create/clinic')
  @ApiOperation({
    summary: '[Public] Tìm hoặc tạo TV_CLINIC gắn phòng khám (tương thích /display/room/:roomUuid)',
  })
  findOrCreateClinic(@Body() dto: FindOrCreateClinicDisplayDto) {
    return this.displayScreenService.findOrCreateClinic(dto);
  }

  @Post('find-or-create/payment')
  @ApiOperation({
    summary: '[Public] Tìm hoặc tạo TV_PAYMENT (tương thích /display/payment)',
  })
  findOrCreatePayment(@Body() dto: FindOrCreatePaymentDisplayDto) {
    return this.displayScreenService.findOrCreatePayment(dto);
  }

  @Patch('pin')
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Đổi PIN toàn hệ thống' })
  changePin(@Body() dto: ChangeDisplayPinDto) {
    return this.displayScreenService.changePin(dto);
  }

  @Post()
  @UseGuards(IsDisplayPinOrAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[PIN JWT hoặc ADMIN] Tạo màn hình kiosk/TV',
  })
  create(@Body() dto: CreateDisplayScreenDto) {
    return this.displayScreenService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Public] Chi tiết một màn hình (không gồm PIN)' })
  findOne(@Param('id') id: string) {
    return this.displayScreenService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(IsDisplayPinOrAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[PIN JWT hoặc ADMIN] Cập nhật màn hình (tên, status, settings, room)',
  })
  update(@Param('id') id: string, @Body() dto: UpdateDisplayScreenDto) {
    return this.displayScreenService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(IsDisplayPinOrAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[PIN JWT hoặc ADMIN] Vô hiệu hoá màn hình (DISABLED)',
  })
  remove(@Param('id') id: string) {
    return this.displayScreenService.disable(id);
  }
}
