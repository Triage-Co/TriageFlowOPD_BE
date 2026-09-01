import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { HisService } from './his.service';
import { ImportHisDto, HisWebhookDto } from './dto/his.dto';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';

@ApiTags('HIS Integration (Tích hợp HIS)')
@Controller('his')
export class HisController {
  constructor(private readonly hisService: HisService) {}

  @Post('import/:patient_id')
  @roles('DOCTOR', 'NURSE', 'RECEPTIONIST', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[STAFF - ADMIN] Chủ động import thông tin bệnh án từ HIS cho bệnh nhân',
    description:
      'Endpoint tra cứu thông tin CCCD của bệnh nhân, gọi sang HIS lấy bệnh án mới nhất và đồng bộ vào Visit_Session của TriageFlow.',
  })
  @ApiParam({
    name: 'patient_id',
    description: 'ID của bệnh nhân trong hệ thống TriageFlow',
    example: 'd9b2b3a1-1234-4567-8901-abcdef123456',
  })
  @ApiResponse({
    status: 200,
    description: 'Đồng bộ dữ liệu từ HIS thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy bệnh nhân hoặc hồ sơ HIS tương ứng.',
  })
  async importPatientFromHis(
    @Param('patient_id') patientId: string,
    @Body() dto?: ImportHisDto,
  ) {
    const result = await this.hisService.syncPatientExamFromHis(
      patientId,
      dto?.visit_session_id,
    );

    return {
      code: 200,
      status: 'success',
      message: result
        ? 'Import dữ liệu bệnh án từ HIS thành công'
        : 'Không tìm thấy hồ sơ bệnh án mới nào từ HIS',
      data: result,
    };
  }

  @Post('webhook')
  @ApiOperation({
    summary: 'Webhook nhận thông báo dữ liệu bệnh án mới từ hệ thống HIS',
    description:
      'Hệ thống HIS có thể gọi endpoint này mỗi khi có bệnh án mới để TriageFlow BE tự động cập nhật ngay lập tức.',
  })
  @ApiResponse({
    status: 200,
    description: 'Xử lý webhook thành công.',
  })
  async receiveHisWebhook(@Body() dto: HisWebhookDto) {
    const result = await this.hisService.syncByCitizenIdFromWebhook(
      dto.citizen_id,
    );

    return {
      code: 200,
      status: 'success',
      message: 'Đã nhận và xử lý webhook từ HIS',
      data: result,
    };
  }

  @Get('preview/:citizen_id')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xem trước thông tin bệnh án từ HIS theo số CCCD',
    description:
      'Cho phép xem dữ liệu gốc từ HIS trước khi import hoặc tra cứu lịch sử khám bệnh.',
  })
  @ApiParam({
    name: 'citizen_id',
    description: 'Số CCCD/CMND của bệnh nhân',
    example: '079099123456',
  })
  async previewHisRecord(@Param('citizen_id') citizenId: string) {
    const latest =
      await this.hisService.fetchLatestExamFromHisByCitizenId(citizenId);
    const history =
      await this.hisService.fetchAllExamsFromHisByCitizenId(citizenId);

    return {
      code: 200,
      status: 'success',
      message: 'Lấy thông tin từ HIS thành công',
      data: {
        latest,
        history,
      },
    };
  }
}
