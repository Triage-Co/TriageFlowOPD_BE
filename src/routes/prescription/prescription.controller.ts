import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PrescriptionService } from './prescription.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { UpdatePrescriptionStatusDto } from './dto/update-prescription-status.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';
import { PrescriptionStatusEnum } from '@prisma/client';

@ApiTags('Prescription')
@Controller('prescription')
export class PrescriptionController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  @Post()
  @roles('DOCTOR', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[DOCTOR - ADMIN] Tạo đơn thuốc mới cho phiên khám',
    description: 'Endpoint dành cho Bác sĩ khởi tạo đơn thuốc gắn liền với 1 phiên khám (Visit_Session).',
  })
  @ApiResponse({ status: 201, description: 'Đơn thuốc đã được tạo thành công.' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc thiếu thông tin thuốc.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên khám hoặc loại thuốc.' })
  @ApiResponse({ status: 409, description: 'Phiên khám này đã có đơn thuốc trước đó.' })
  create(@Body() createDto: CreatePrescriptionDto, @Req() req: any) {
    const staffId = req.user?.staff_id || req.user?.id || req.user?.sub;
    return this.prescriptionService.create(createDto, staffId);
  }

  @Get()
  @roles('DOCTOR', 'PHARMACIST', 'NURSE', 'RECEPTIONIST', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[STAFF - ADMIN] Lấy danh sách tất cả đơn thuốc',
    description: 'Endpoint hỗ trợ tra cứu danh sách đơn thuốc có thể lọc theo patient_id, visit_session_id, status.',
  })
  @ApiQuery({ name: 'patient_id', required: false, description: 'Lọc theo ID bệnh nhân' })
  @ApiQuery({ name: 'visit_session_id', required: false, description: 'Lọc theo ID phiên khám' })
  @ApiQuery({ name: 'status', enum: PrescriptionStatusEnum, required: false, description: 'Lọc theo trạng thái đơn thuốc' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Trang thứ bao nhiêu (mặc định 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Số bản ghi trên trang (mặc định 20)' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách đơn thuốc thành công.' })
  findAll(
    @Query('patient_id') patient_id?: string,
    @Query('visit_session_id') visit_session_id?: string,
    @Query('status') status?: PrescriptionStatusEnum,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.prescriptionService.findAll({ patient_id, visit_session_id, status, page, limit });
  }

  @Get('visit-session/:visit_session_id')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ALL] Lấy đơn thuốc theo ID phiên khám (Visit_Session)',
    description: 'Endpoint giúp lấy thông tin đơn thuốc duy nhất của một phiên khám.',
  })
  @ApiResponse({ status: 200, description: 'Lấy đơn thuốc thành công.' })
  @ApiResponse({ status: 404, description: 'Phiên khám chưa có đơn thuốc.' })
  findByVisitSession(@Param('visit_session_id') visit_session_id: string, @Req() req: any) {
    return this.prescriptionService.findByVisitSession(visit_session_id, req.user);
  }

  @Get(':id')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ALL] Lấy chi tiết đơn thuốc theo ID đơn thuốc',
    description: 'Endpoint lấy chi tiết 1 đơn thuốc. Nhân viên y tế có thể xem mọi đơn thuốc, Bệnh nhân chỉ xem được đơn thuốc của mình.',
  })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết đơn thuốc thành công.' })
  @ApiResponse({ status: 403, description: 'Không có quyền xem đơn thuốc của người khác.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn thuốc.' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.prescriptionService.findOne(id, req.user);
  }

  @Patch(':id/status')
  @roles('PHARMACIST', 'DOCTOR', 'RECEPTIONIST', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[STAFF - ADMIN] Cập nhật trạng thái đơn thuốc',
    description: 'Chuyển trạng thái đơn thuốc: PENDING -> PROCESSING -> PREPARED -> DISPENSED hoặc CANCELLED.',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái đơn thuốc thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn thuốc.' })
  updateStatus(@Param('id') id: string, @Body() statusDto: UpdatePrescriptionStatusDto) {
    return this.prescriptionService.updateStatus(id, statusDto.status);
  }

  @Patch(':id')
  @roles('DOCTOR', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[DOCTOR - ADMIN] Chỉnh sửa nội dung đơn thuốc (Khi đơn ở trạng thái PENDING)',
    description: 'Bác sĩ cập nhật dặn dò hoặc thay đổi danh sách thuốc kê khi đơn thuốc chưa được nhà thuốc xử lý.',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật nội dung đơn thuốc thành công.' })
  @ApiResponse({ status: 400, description: 'Đơn thuốc đã được xử lý, không thể chỉnh sửa.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn thuốc.' })
  update(@Param('id') id: string, @Body() updateDto: UpdatePrescriptionDto) {
    return this.prescriptionService.update(id, updateDto);
  }

  @Delete(':id')
  @roles('DOCTOR', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[DOCTOR - ADMIN] Xóa đơn thuốc',
    description: 'Endpoint dành cho Bác sĩ hoặc Quản trị viên xóa đơn thuốc.',
  })
  @ApiResponse({ status: 200, description: 'Xóa đơn thuốc thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn thuốc cần xóa.' })
  remove(@Param('id') id: string) {
    return this.prescriptionService.remove(id);
  }
}
