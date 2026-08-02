import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VisitSessionService } from './visit-session.service';
import {
  CreateVisitSessionReqDto,
  UpdateVisitSessionReqDto,
} from './dto/request-visit-session.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';

@ApiTags('Visit Session')
@Controller('visit-session')
export class VisitSessionController {
  constructor(private readonly visitSessionService: VisitSessionService) {}

  @Post()
  @roles('DOCTOR', 'NURSE', 'RECEPTIONIST', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[STAFF - ADMIN] Tạo phiên khám bệnh mới',
    description:
      'Endpoint dành cho Nhân viên y tế khởi tạo một phiên khám bệnh mới cho bệnh nhân, ghi nhận lý do khám và các chỉ số sinh tồn ban đầu.',
  })
  @ApiResponse({
    status: 201,
    description: 'Phiên khám bệnh đã được tạo thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu yêu cầu không hợp lệ hoặc thiếu trường bắt buộc.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy bệnh nhân tương ứng với patient_id cung cấp.',
  })
  create(@Body() createDto: CreateVisitSessionReqDto) {
    return this.visitSessionService.create(createDto);
  }

  @Get()
  @roles(
    'DOCTOR',
    'NURSE',
    'RECEPTIONIST',
    'LAB_TECHNICIAN',
    'PHARMACIST',
    'ADMIN',
  )
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[STAFF - ADMIN] Lấy danh sách tất cả phiên khám bệnh',
    description:
      'Endpoint dành cho Nhân viên y tế tra cứu danh sách toàn bộ các phiên khám bệnh trong hệ thống, hỗ trợ lọc theo ID bệnh nhân.',
  })
  @ApiQuery({
    name: 'patient_id',
    required: false,
    description: 'Lọc theo ID bệnh nhân',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách các phiên khám bệnh thành công.',
  })
  findAll(@Query('patient_id') patient_id?: string) {
    return this.visitSessionService.findAll(patient_id);
  }

  @Get('me')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[USER] Lấy các phiên khám bệnh của bản thân',
    description:
      'Endpoint dành cho Bệnh nhân (USER) để tự tra cứu toàn bộ lịch sử các phiên khám bệnh của bản thân dựa trên token đăng nhập.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy các phiên khám bệnh của bản thân thành công.',
  })
  findMySessions(@Req() req: any) {
    const id = req.user.id || req.user.sub;
    return this.visitSessionService.getMySessions(id);
  }

  @Get('patient/:patient_id/latest')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ALL] Lấy phiên khám mới nhất của bệnh nhân',
    description:
      'Endpoint lấy phiên khám mới nhất của một bệnh nhân cụ thể. Nhân viên y tế có thể xem của bất kỳ bệnh nhân nào, Bệnh nhân (USER) chỉ có thể xem của chính mình hoặc người phụ thuộc thuộc tài khoản của họ.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy phiên khám mới nhất thành công.',
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền truy cập vào thông tin bệnh nhân khác.',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên khám nào.' })
  findLatestByPatient(
    @Param('patient_id') patient_id: string,
    @Req() req: any,
  ) {
    return this.visitSessionService.findLatestByPatient(patient_id, req.user);
  }

  @Patch('patient/:patient_id/latest')
  @roles('DOCTOR', 'NURSE', 'RECEPTIONIST', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[STAFF - ADMIN] Cập nhật phiên khám mới nhất của bệnh nhân',
    description:
      'Endpoint dành cho Nhân viên y tế cập nhật thông tin phiên khám mới nhất của bệnh nhân.',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật phiên khám thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên khám nào.' })
  updateLatestByPatient(
    @Param('patient_id') patient_id: string,
    @Body() updateDto: UpdateVisitSessionReqDto,
  ) {
    return this.visitSessionService.updateLatestByPatient(
      patient_id,
      updateDto,
    );
  }

  @Get('patient/:patient_id')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ALL] Lấy danh sách phiên khám theo ID bệnh nhân',
    description:
      'Endpoint lấy toàn bộ các phiên khám của một bệnh nhân cụ thể. Nhân viên y tế có thể xem của bất kỳ bệnh nhân nào, Bệnh nhân (USER) chỉ có thể xem của chính mình hoặc người phụ thuộc thuộc tài khoản của họ.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách phiên khám thành công.',
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền truy cập vào thông tin bệnh nhân khác.',
  })
  findByPatient(@Param('patient_id') patient_id: string, @Req() req: any) {
    return this.visitSessionService.findByPatient(patient_id, req.user);
  }

  @Get(':id')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ALL] Lấy chi tiết phiên khám bệnh theo ID',
    description:
      'Endpoint lấy thông tin chi tiết một phiên khám bệnh. Nhân viên y tế có thể xem mọi phiên khám, nhưng Bệnh nhân (USER) chỉ có thể xem nếu phiên khám đó thuộc về chính họ.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy chi tiết phiên khám bệnh thành công.',
  })
  @ApiResponse({
    status: 403,
    description:
      'Bệnh nhân không có quyền truy cập vào phiên khám của người khác.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy phiên khám với ID được cung cấp.',
  })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.visitSessionService.findOne(id, req.user);
  }

  @Patch(':id')
  @roles('DOCTOR', 'NURSE', 'RECEPTIONIST', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[STAFF - ADMIN] Cập nhật phiên khám bệnh',
    description:
      'Endpoint dành cho Nhân viên y tế cập nhật thông tin phiên khám bệnh (chẩn đoán lâm sàng, chỉ số sinh tồn, bệnh sử, khám thực thể...).',
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật phiên khám bệnh thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy phiên khám bệnh cần cập nhật.',
  })
  update(@Param('id') id: string, @Body() updateDto: UpdateVisitSessionReqDto) {
    return this.visitSessionService.update(id, updateDto);
  }

  @Delete(':id')
  @roles('ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ADMIN] Xóa phiên khám bệnh',
    description:
      'Endpoint giới hạn chỉ dành cho Quản trị viên (ADMIN) để thực hiện xóa bỏ phiên khám bệnh ra khỏi hệ thống.',
  })
  @ApiResponse({ status: 200, description: 'Xóa phiên khám bệnh thành công.' })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy phiên khám bệnh cần xóa.',
  })
  remove(@Param('id') id: string) {
    return this.visitSessionService.remove(id);
  }
}
