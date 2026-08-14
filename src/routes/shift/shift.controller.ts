import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ShiftService } from './shift.service';
import {
  CreateShiftRequestDto,
  UpdateShiftRequestDto,
} from './dto/request-shift.dto';
import { BulkWeeklyShiftDto } from './dto/bulk-weekly-shift.dto';
import { BulkImportShiftDto } from './dto/bulk-import-shift.dto';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';
import { RoleTypeEnum } from '@prisma/client';

@ApiTags('Shift')
@Controller('shift')
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  private getUser(req: any) {
    const u = req?.user;
    return {
      id: u?.account_id || u?.id || u?.sub || 'system',
      role: u?.role || 'USER',
    };
  }

  @Get('me')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách ca trực cá nhân của Staff đăng nhập' })
  @ApiQuery({ name: 'date', required: false, description: 'Ngày cần tra cứu (YYYY-MM-DD), mặc định hôm nay' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách ca trực thành công.' })
  async findMyShifts(@Req() req: any, @Query('date') dateStr?: string) {
    const user = this.getUser(req);
    return await this.shiftService.findMyShifts(user.id, dateStr);
  }

  @Post()
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @roles(RoleTypeEnum.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Tạo ca trực mới' })
  create(@Body() createShiftRequestDto: CreateShiftRequestDto) {
    return this.shiftService.create(createShiftRequestDto);
  }

  @Post('bulk-weekly')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @roles(RoleTypeEnum.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ADMIN] Tạo hàng loạt ca trực theo tuần cho nhiều phòng/nhân viên',
  })
  @ApiResponse({ status: 201, description: 'Tạo ca trực theo tuần thành công.' })
  bulkWeekly(@Body() bulkWeeklyShiftDto: BulkWeeklyShiftDto) {
    return this.shiftService.bulkWeekly(bulkWeeklyShiftDto);
  }

  @Post('bulk-import')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @roles(RoleTypeEnum.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ADMIN] Tạo hàng loạt ca trực từ danh sách đã import (CSV/Excel)',
  })
  @ApiResponse({ status: 201, description: 'Tạo ca trực từ file import thành công.' })
  bulkImport(@Body() bulkImportShiftDto: BulkImportShiftDto) {
    return this.shiftService.bulkImport(bulkImportShiftDto);
  }

  @Get()
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách tất cả ca trực' })
  findAll() {
    return this.shiftService.findAll();
  }

  @Get(':id')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy chi tiết ca trực theo ID' })
  findOne(@Param('id') id: string) {
    return this.shiftService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @roles(RoleTypeEnum.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Cập nhật ca trực (regenerate slot nếu đổi giờ/ngày)' })
  update(@Param('id') id: string, @Body() updateShiftRequestDto: UpdateShiftRequestDto) {
    return this.shiftService.update(id, updateShiftRequestDto);
  }

  @Delete(':id')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @roles(RoleTypeEnum.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Xóa ca trực' })
  remove(@Param('id') id: string) {
    return this.shiftService.remove(id);
  }
}
