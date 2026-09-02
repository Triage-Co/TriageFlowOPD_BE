import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { QueryPatientBillingDto } from './dto/query-patient-billing.dto';
import { InvoiceService } from './invoice.service';
import { orGuard } from '../../shared/guards/orGuards';
import { IsKioskGuard } from '../../shared/guards/is_kiosk.guard';

@ApiTags('Invoice')
@Controller('invoice')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  findAll() {
    return this.invoiceService.findAll();
  }

  @Get('patient/:patient_id/booking/:booking_id')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[USER / STAFF] Chi tiết hóa đơn theo lần khám',
    description:
      'Trả về các đơn dịch vụ, line items hóa đơn và giao dịch của một booking. Bệnh nhân (USER) chỉ xem được hồ sơ mình sở hữu.',
  })
  @ApiParam({ name: 'patient_id', description: 'ID bệnh nhân' })
  @ApiParam({ name: 'booking_id', description: 'ID lần khám / booking' })
  @ApiOkResponse({ description: 'Lấy chi tiết hóa đơn lần khám thành công.' })
  @ApiResponse({ status: 403, description: 'Không có quyền xem hồ sơ này.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lần khám.' })
  getPatientVisitBilling(
    @Param('patient_id', ParseUUIDPipe) patientId: string,
    @Param('booking_id', ParseUUIDPipe) bookingId: string,
    @Req() req: { user: { sub?: string; id?: string } },
  ) {
    return this.invoiceService.getPatientVisitBilling(
      patientId,
      bookingId,
      req.user,
    );
  }

  @Get('patient/:patient_id')
  @UseGuards(orGuard(IsAuthGuard, IsKioskGuard))
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[USER / STAFF] Tổng hợp hóa đơn bệnh nhân theo lần khám',
    description:
      'Danh sách đơn dịch vụ nhóm theo lần khám (booking), kèm summary tổng nợ / đã thanh toán. Bệnh nhân (USER) chỉ xem được hồ sơ mình sở hữu.',
  })
  @ApiParam({ name: 'patient_id', description: 'ID bệnh nhân' })
  @ApiOkResponse({
    description: 'Lấy tổng hợp hóa đơn bệnh nhân thành công.',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền xem hồ sơ này.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ bệnh nhân.' })
  getPatientBilling(
    @Param('patient_id', ParseUUIDPipe) patientId: string,
    @Query() query: QueryPatientBillingDto,
    @Req() req: { user: { sub?: string; id?: string } },
  ) {
    return this.invoiceService.getPatientBilling(patientId, query, req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoiceService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.invoiceService.remove(id);
  }
}
