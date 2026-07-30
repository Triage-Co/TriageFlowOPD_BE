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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
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
    description: 'Endpoint dành cho Bác sĩ khởi tạo đơn thuốc gắn liền với 1 phiên khám (Visit_Session). Tự động khởi tạo Service_Order tương ứng và sinh mã QR đơn thuốc.',
  })
  @ApiResponse({
    status: 201,
    description: 'Đơn thuốc đã được tạo thành công.',
    schema: {
      example: {
        prescription_id: 'a1b2c3d4-e5f6-7890-abcd-1234567890ab',
        prescription_code: 'RX-20260730-8842',
        qr_code: '{"code":"RX-20260730-8842","visit_session_id":"...","service_order_id":"...","total_amount":50000}',
        service_order_id: 'b2c3d4e5-f6a7-8901-bcde-2345678901bc',
        visit_session_id: 'c3d4e5f6-a7b8-9012-cdef-3456789012cd',
        prescribed_by: 'd4e5f6a7-b8c9-0123-defa-4567890123de',
        diagnosis_note: 'Uống thuốc đúng giờ, nghỉ ngơi nhiều và tái khám sau 7 ngày',
        total_amount: 50000,
        status: 'PENDING',
        created_at: '2026-07-30T13:00:00.000Z',
        updated_at: '2026-07-30T13:00:00.000Z',
        prescriptionDetails: [
          {
            prescription_detail_id: 'e5f6a7b8-c9d0-1234-efab-5678901234ef',
            medicine_id: 'f6a7b8c9-d0e1-2345-fabc-6789012345fa',
            quantity: 10,
            dosage_instruction: 'Sáng 1 viên, tối 1 viên sau ăn',
            unit_price: 5000,
            sub_total: 50000,
            medicine: {
              medicine_code: 'MED-PAR-500',
              medicine_name: 'Paracetamol 500mg',
              unit: 'Viên',
            },
          },
        ],
      },
    },
  })
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

  @Get('scan/:code')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ALL] Quét mã QR hoặc tìm theo mã đơn thuốc (prescription_code)',
    description: 'Endpoint cho phép Dược sĩ / Thu ngân quét mã QR hoặc nhập mã đơn thuốc (VD: RX-20260730-8842) để xem thông tin chi tiết đơn thuốc và số tiền.',
  })
  @ApiParam({ name: 'code', description: 'Mã đơn thuốc (RX-YYYYMMDD-XXXX) hoặc chuỗi QR code', example: 'RX-20260730-8842' })
  @ApiResponse({ status: 200, description: 'Tra cứu đơn thuốc theo mã thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn thuốc phù hợp.' })
  findByCode(@Param('code') code: string, @Req() req: any) {
    return this.prescriptionService.findByCode(code, req.user);
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

  @Patch(':id/pay')
  @roles('PHARMACIST', 'RECEPTIONIST', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[STAFF - ADMIN] Xác nhận thanh toán tiền mặt (Offline) tại quầy nhà thuốc',
    description: 'Chuyển đơn thuốc sang trạng thái PROCESSING (đang soạn thuốc), cập nhật Service_Order.payment_status = SUCCESSED và tự động tạo bản ghi Transaction doanh thu.',
  })
  @ApiResponse({ status: 200, description: 'Xác nhận thanh toán offline thành công, đơn thuốc chuyển sang PROCESSING.' })
  @ApiResponse({ status: 400, description: 'Đơn thuốc đã được thanh toán hoặc không ở trạng thái PENDING.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn thuốc.' })
  confirmOfflinePayment(@Param('id') id: string) {
    return this.prescriptionService.confirmOfflinePayment(id);
  }

  @Patch(':id/prepare')
  @roles('PHARMACIST', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[PHARMACIST - ADMIN] Xác nhận đã soạn xong thuốc',
    description: 'Dược sĩ bấm xác nhận đã soạn xong thuốc. Chuyển đơn thuốc sang trạng thái PREPARED và tự động gửi thông báo (Notification) tới ứng dụng của Bệnh nhân.',
  })
  @ApiResponse({ status: 200, description: 'Xác nhận soạn thuốc xong thành công, đã phát thông báo cho bệnh nhân.' })
  @ApiResponse({ status: 400, description: 'Đơn thuốc chưa ở trạng thái PROCESSING (chưa thanh toán).' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn thuốc.' })
  markAsPrepared(@Param('id') id: string) {
    return this.prescriptionService.markAsPrepared(id);
  }

  @Patch(':id/dispense')
  @roles('PHARMACIST', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[PHARMACIST - ADMIN] Xác nhận đã giao thuốc cho bệnh nhân',
    description: 'Dược sĩ bấm xác nhận đã giao thuốc. Chuyển đơn thuốc sang trạng thái DISPENSED, chuyển Service_Order sang COMPLETED và tự động gửi thông báo hoàn thành.',
  })
  @ApiResponse({ status: 200, description: 'Xác nhận giao thuốc thành công, hoàn thành đơn thuốc.' })
  @ApiResponse({ status: 400, description: 'Đơn thuốc chưa ở trạng thái PREPARED.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn thuốc.' })
  markAsDispensed(@Param('id') id: string) {
    return this.prescriptionService.markAsDispensed(id);
  }

  @Patch(':id/status')
  @roles('PHARMACIST', 'DOCTOR', 'RECEPTIONIST', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[STAFF - ADMIN] Cập nhật trực tiếp trạng thái đơn thuốc',
    description: 'Cho phép cập nhật thủ công trạng thái đơn thuốc.',
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
    description: 'Bác sĩ cập nhật dặn dò hoặc thay đổi danh sách thuốc kê khi đơn thuốc chưa được thanh toán/xử lý.',
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
