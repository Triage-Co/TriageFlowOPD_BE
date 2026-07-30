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
import { ClinicalDocumentService } from './clinical-document.service';
import {
  CreateClinicalDocumentReqDto,
  UpdateClinicalDocumentReqDto,
} from './dto/request-clinical-document.dto';
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

@ApiTags('Clinical Document')
@Controller('clinical-document')
@UseGuards(IsAuthGuard)
@ApiBearerAuth()
export class ClinicalDocumentController {
  constructor(
    private readonly clinicalDocumentService: ClinicalDocumentService,
  ) {}

  @Post()
  @roles('DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'PHARMACIST', 'ADMIN')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: '[STAFF - ADMIN] Tạo tài liệu lâm sàng mới',
    description:
      'Endpoint dành cho Nhân viên y tế (Bác sĩ, Y tá, Kỹ thuật viên, Dược sĩ, Admin) để đính kèm tài liệu lâm sàng mới (Đơn thuốc, kết quả xét nghiệm, chẩn đoán hình ảnh...) vào một phiên khám.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tài liệu lâm sàng đã được tạo thành công.',
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ.' })
  @ApiResponse({
    status: 404,
    description:
      'Không tìm thấy phiên khám bệnh tương ứng với visit_session_id.',
  })
  create(@Body() createDto: CreateClinicalDocumentReqDto) {
    return this.clinicalDocumentService.create(createDto);
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
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: '[STAFF - ADMIN] Lấy danh sách tất cả tài liệu lâm sàng',
    description:
      'Endpoint dành cho Nhân viên y tế tra cứu toàn bộ danh sách các tài liệu lâm sàng trong hệ thống, có hỗ trợ lọc theo ID phiên khám.',
  })
  @ApiQuery({
    name: 'visit_session_id',
    required: false,
    description: 'Lọc theo ID phiên khám',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách tài liệu lâm sàng thành công.',
  })
  findAll(@Query('visit_session_id') visit_session_id?: string) {
    return this.clinicalDocumentService.findAll(visit_session_id);
  }

  @Get('me')
  @ApiOperation({
    summary: '[USER] Lấy tất cả tài liệu lâm sàng của bản thân',
    description:
      'Endpoint dành cho Bệnh nhân (USER) để tự xem toàn bộ các tài liệu lâm sàng liên quan đến các phiên khám của chính mình.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách tài liệu lâm sàng của bản thân thành công.',
  })
  findMyDocuments(@Req() req: any) {
    const id = req.user.id || req.user.sub;
    return this.clinicalDocumentService.getMyDocuments(id);
  }

  @Get('visit-session/:visit_session_id')
  @ApiOperation({
    summary: '[ALL] Lấy danh sách tài liệu lâm sàng theo ID phiên khám',
    description:
      'Endpoint lấy toàn bộ các tài liệu lâm sàng của một phiên khám cụ thể. Nhân viên y tế có thể xem của bất kỳ phiên khám nào, Bệnh nhân (USER) chỉ có thể xem nếu phiên khám đó thuộc về chính họ.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách tài liệu lâm sàng thành công.',
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền truy cập vào tài liệu của phiên khám này.',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên khám bệnh.' })
  findByVisitSession(
    @Param('visit_session_id') visit_session_id: string,
    @Req() req: any,
  ) {
    return this.clinicalDocumentService.findByVisitSession(
      visit_session_id,
      req.user,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: '[ALL] Lấy chi tiết tài liệu lâm sàng theo ID',
    description:
      'Endpoint lấy chi tiết một tài liệu lâm sàng cụ thể. Nhân viên y tế có quyền xem mọi tài liệu, trong khi Bệnh nhân (USER) chỉ có thể xem tài liệu thuộc phiên khám của chính họ.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy chi tiết tài liệu lâm sàng thành công.',
  })
  @ApiResponse({
    status: 403,
    description:
      'Bệnh nhân không có quyền xem tài liệu lâm sàng của người khác.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy tài liệu lâm sàng với ID được cung cấp.',
  })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.clinicalDocumentService.findOne(id, req.user);
  }

  @Patch(':id')
  @roles('DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'PHARMACIST', 'ADMIN')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: '[STAFF - ADMIN] Cập nhật tài liệu lâm sàng',
    description:
      'Endpoint dành cho Nhân viên y tế sửa đổi nội dung hoặc chi tiết của tài liệu lâm sàng (ví dụ sửa đơn thuốc, cập nhật chỉ số xét nghiệm...).',
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật tài liệu lâm sàng thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy tài liệu lâm sàng cần cập nhật.',
  })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateClinicalDocumentReqDto,
  ) {
    return this.clinicalDocumentService.update(id, updateDto);
  }

  @Delete(':id')
  @roles('DOCTOR', 'ADMIN')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: '[DOCTOR - ADMIN] Xóa tài liệu lâm sàng',
    description:
      'Endpoint giới hạn quyền xóa tài liệu lâm sàng chỉ dành riêng cho Bác sĩ (DOCTOR) và Quản trị viên (ADMIN).',
  })
  @ApiResponse({
    status: 200,
    description: 'Xóa tài liệu lâm sàng thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy tài liệu lâm sàng cần xóa.',
  })
  remove(@Param('id') id: string) {
    return this.clinicalDocumentService.remove(id);
  }
}
