import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { FlowService } from './flow.service';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';
import { IsKioskGuard } from '../../shared/guards/is_kiosk.guard';
import {
  AssignTemplateRequestDto,
  TemplateStepDto,
} from '../template/dto/create-template.dto';

@Controller('flow')
export class FlowController {
  constructor(private readonly flowService: FlowService) {}

  @Get('patient/:patient_id/kiosk')
  @ApiBearerAuth()
  @UseGuards(IsKioskGuard)
  @ApiOperation({
    summary: '[KIOSK] Tìm tất cả lịch sử flow theo Patient ID',
  })
  async findAllByPatientIdInKiosk(@Param('patient_id') patientId: string) {
    return this.flowService.findAllByPatientId(patientId);
  }

  @Get('patient/:patient_id/active/kiosk')
  @ApiBearerAuth()
  @UseGuards(IsKioskGuard)
  @ApiOperation({
    summary: '[KIOSK] Tìm flow đang chạy (IN_PROGRESS) theo Patient ID',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    description:
      'Định dạng ngày (VD: 2024-10-25). Bỏ trống nếu muốn lấy tất cả.',
  })
  async findIsActiveByPatientIdInKiosk(
    @Param('patient_id') patientId: string,
    @Query('date') date?: string,
  ) {
    return this.flowService.findIsActiveByPatientId(patientId, date);
  }

  @Get('patient/:patient_id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({
    summary: '[AUTH] Tìm tất cả lịch sử flow theo Patient ID',
  })
  async findAllByPatientId(@Param('patient_id') patientId: string) {
    return this.flowService.findAllByPatientId(patientId);
  }

  @Get('patient/:patient_id/active')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({
    summary: '[AUTH] Tìm flow đang chạy (IN_PROGRESS) theo Patient ID',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    description:
      'Định dạng ngày (VD: 2024-10-25). Bỏ trống nếu muốn lấy tất cả.',
  })
  async findIsActiveByPatientId(
    @Param('patient_id') patientId: string,
    @Query('date') date?: string,
  ) {
    return this.flowService.findIsActiveByPatientId(patientId, date);
  }

  @Get()
  @roles(
    'ADMIN',
    'DOCTOR',
    'NURSE',
    'LAB_TECHNICIAN',
    'PHARMACIST',
    'RECEPTIONIST',
  )
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({
    summary: '[STAFF - ADMIN] Tìm tất cả flow',
  })
  async findAll() {
    return this.flowService.findAll();
  }

  @Get(':id')
  @roles(
    'ADMIN',
    'DOCTOR',
    'NURSE',
    'LAB_TECHNICIAN',
    'PHARMACIST',
    'RECEPTIONIST',
  )
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({
    summary: '[STAFF - ADMIN]Tìm flow theo step id',
  })
  findOne(@Param('id') id: string) {
    return this.flowService.findOne(id);
  }

  @Post('/assign/:flow_id')
  @ApiBearerAuth()
  @roles('ADMIN', 'DOCTOR')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({
    summary: '[DOCTOR - ADMIN] thêm template vào flow',
  })
  async doctorAssignTemplate(
    @Param('flow_id') flowId: string,
    @Body() template: AssignTemplateRequestDto,
  ) {
    return await this.flowService.addTemplateToFlow(flowId, template.templates);
  }

  @Post('/assign/:flow_id/template/:template_id')
  @ApiBearerAuth()
  @roles('ADMIN', 'DOCTOR')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({
    summary: '[DOCTOR - ADMIN] thêm template vào flow bằng template_id',
  })
  async doctorAssignTemplateById(
    @Param('flow_id') flowId: string,
    @Param('template_id') templateId: string,
  ) {
    return await this.flowService.addTemplateToFlowByTeamplateId(
      flowId,
      templateId,
    );
  }
}
