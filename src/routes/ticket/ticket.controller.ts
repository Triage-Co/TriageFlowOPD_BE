import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TicketService } from './ticket.service';
import { TicketNavigateDto } from './dto/ticket-navigate.dto';
import { TicketCheckInDto } from './dto/ticket-check-in.dto';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';

@ApiTags('Ticket')
@Controller('ticket')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Get('patient/:patientId')
  @ApiOperation({
    summary: 'Tra cứu thông tin vé (Ticket) theo Patient ID để in lại vé',
    description:
      'Trả về thông tin chi tiết vé khám (mã ticket, thông tin bệnh nhân, số thứ tự hàng chờ, bước khám hiện tại, các bước khám) theo patient_id để phục vụ in lại vé khi bị mất vé vật lý.',
  })
  @ApiParam({
    name: 'patientId',
    description: 'ID của bệnh nhân (UUID)',
    example: 'd9b2b3a1-1234-5678-90ab-cdef12345678',
  })
  async getTicketByPatientId(@Param('patientId') patientId: string) {
    return this.ticketService.getTicketByPatientId(patientId);
  }

  @Get('by-patient')
  @ApiOperation({
    summary: 'Tra cứu thông tin vé (Ticket) theo query param patient_id',
    description:
      'Trả về thông tin chi tiết vé khám theo query param patient_id để phục vụ in lại vé vật lý.',
  })
  @ApiQuery({
    name: 'patient_id',
    description: 'ID của bệnh nhân (UUID)',
    required: true,
  })
  async getTicketByPatientQuery(@Query('patient_id') patientId: string) {
    return this.ticketService.getTicketByPatientId(patientId);
  }

  @Get(':code')
  @ApiOperation({
    summary: 'Tra cứu thông tin cơ bản của phiếu khám (Ticket)',
    description:
      'Trả về thông tin cơ bản bao gồm tên bệnh nhân, mã ticket, trạng thái lộ trình (flow_status) và bước khám hiện tại.',
  })
  @ApiParam({
    name: 'code',
    description: 'Mã ticket bệnh nhân (VD: V-20260803-0042)',
    example: 'V-20260803-0042',
  })
  async getTicketInfo(@Param('code') code: string) {
    return this.ticketService.getTicketInfo(code);
  }

  @Get(':code/flow-progress')
  @ApiOperation({
    summary: 'Lấy tiến trình chi tiết lộ trình khám bệnh (Flow Progress)',
    description:
      'Trả về danh sách cấu trúc cây tất cả các bước khám (Step), phòng khám, số thứ tự hàng chờ và trạng thái xử lý.',
  })
  @ApiParam({
    name: 'code',
    description: 'Mã ticket bệnh nhân (VD: V-20260803-0042)',
    example: 'V-20260803-0042',
  })
  async getFlowProgress(@Param('code') code: string) {
    return this.ticketService.getFlowProgress(code);
  }

  @Get(':code/navigate')
  @ApiOperation({
    summary: 'Tự động xác định bước khám tiếp theo và tính đường đi',
    description:
      'Tra cứu bước khám cần đến tiếp theo của bệnh nhân (IN_PROGRESS hoặc PENDING sớm nhất), tự động lấy phòng vật lý tương ứng và gọi thuật toán A* để tính tuyến đường tối ưu từ vị trí xuất phát (startType + startId).',
  })
  @ApiParam({
    name: 'code',
    description: 'Mã ticket bệnh nhân (VD: V-20260803-0042)',
    example: 'V-20260803-0042',
  })
  async navigate(
    @Param('code') code: string,
    @Query() query: TicketNavigateDto,
  ) {
    return this.ticketService.navigate(code, query);
  }

  @Get(':code/payment')
  @ApiOperation({
    summary: 'Lấy thông tin danh sách dịch vụ và hóa đơn thanh toán',
    description:
      'Trả về tất cả Service_Order, Invoice và trạng thái thanh toán liên kết với phiếu khám.',
  })
  @ApiParam({
    name: 'code',
    description: 'Mã ticket bệnh nhân (VD: V-20260803-0042)',
    example: 'V-20260803-0042',
  })
  async getPaymentInfo(@Param('code') code: string) {
    return this.ticketService.getPaymentInfo(code);
  }

  @Get(':code/prescription')
  @ApiOperation({
    summary: 'Lấy thông tin đơn thuốc của bệnh nhân',
    description:
      'Trả về chi tiết đơn thuốc, các thuốc được kê, bác sĩ kê đơn và trạng thái cấp phát thuốc.',
  })
  @ApiParam({
    name: 'code',
    description: 'Mã ticket bệnh nhân (VD: V-20260803-0042)',
    example: 'V-20260803-0042',
  })
  async getPrescription(@Param('code') code: string) {
    return this.ticketService.getPrescription(code);
  }

  @Post(':code/check-in')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({
    summary: 'Check-in tự động tại phòng khám/xét nghiệm',
    description:
      'Bệnh nhân quét QR tại kiốt/camera phòng. Hệ thống xác nhận bệnh nhân đã tới phòng, cập nhật trạng thái bước khám sang IN_PROGRESS và phát sóng số thứ tự lên TV phòng.',
  })
  @ApiParam({
    name: 'code',
    description: 'Mã ticket bệnh nhân (VD: V-20260803-0042)',
    example: 'V-20260803-0042',
  })
  async checkIn(
    @Param('code') code: string,
    @Body() body: TicketCheckInDto,
    @Req() req: any,
  ) {
    return this.ticketService.checkIn(code, body, req.user);
  }

  @Get(':code/clinical-results')
  @ApiOperation({
    summary: 'Xem kết quả xét nghiệm và chẩn đoán lâm sàng',
    description:
      'Trả về thông tin chẩn đoán và các tài liệu lâm sàng (Clinical_Document) của phiên khám liên kết với ticket.',
  })
  @ApiParam({
    name: 'code',
    description: 'Mã ticket bệnh nhân (VD: V-20260803-0042)',
    example: 'V-20260803-0042',
  })
  async getClinicalResults(@Param('code') code: string) {
    return this.ticketService.getClinicalResults(code);
  }
}
